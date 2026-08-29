package expo.modules.smsuserconsent

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val CONSENT_REQUEST_CODE = 51789
private const val EVENT_RECEIVED = "onSmsReceived"
private const val EVENT_ERROR = "onSmsError"

/**
 * Wraps Google's SMS User Consent API.
 *
 * Unlike the SMS Retriever API this needs no 11-character app hash in the
 * message and imposes no 140-byte limit — it shows a one-tap system dialog
 * instead. That is the only option that works with DLT-approved OTP templates
 * we cannot freely reformat.
 */
class SmsUserConsentModule : Module() {
  private var receiver: BroadcastReceiver? = null

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context unavailable")

  override fun definition() = ModuleDefinition {
    Name("SmsUserConsent")

    Events(EVENT_RECEIVED, EVENT_ERROR)

    Function("startListening") {
      stop()
      start()
    }

    Function("stopListening") {
      stop()
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != CONSENT_REQUEST_CODE) return@OnActivityResult

      if (payload.resultCode == Activity.RESULT_OK) {
        val message = payload.data?.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE)
        if (message != null) {
          sendEvent(EVENT_RECEIVED, mapOf("message" to message))
        } else {
          sendEvent(EVENT_ERROR, mapOf("error" to "Consent granted but the message was empty"))
        }
      } else {
        sendEvent(EVENT_ERROR, mapOf("error" to "User denied the SMS consent dialog"))
      }
    }

    OnDestroy {
      stop()
    }
  }

  private fun start() {
    // null sender = accept a code from any number.
    SmsRetriever.getClient(context).startSmsUserConsent(null)

    val smsReceiver = object : BroadcastReceiver() {
      override fun onReceive(receiverContext: Context?, intent: Intent?) {
        // An exception escaping onReceive kills the whole process, so this body
        // is wrapped defensively: a failed OTP read must degrade to manual entry.
        try {
          handleBroadcast(intent)
        } catch (error: Throwable) {
          sendEvent(EVENT_ERROR, mapOf("error" to (error.message ?: "Failed to read the OTP SMS")))
        }
      }

      private fun handleBroadcast(intent: Intent?) {
        if (intent?.action != SmsRetriever.SMS_RETRIEVED_ACTION) return

        val extras = intent.extras ?: return

        // NB: the typed Bundle.getParcelable(key, Class) overload MUST NOT be used
        // here. On Android 13 it runs
        //   clazz.isAssignableFrom(creator.getClass().getEnclosingClass())
        // and every GMS SafeParcelable creator (Status -> StatusCreator/zzb) is a
        // TOP-LEVEL class, so getEnclosingClass() is null and the platform NPEs
        // inside Parcel.readParcelableCreatorInternal. The untyped read passes
        // clazz = null, skipping that check entirely.
        @Suppress("DEPRECATION")
        val status = extras.get(SmsRetriever.EXTRA_STATUS) as? Status

        when (status?.statusCode) {
          CommonStatusCodes.SUCCESS -> {
            @Suppress("DEPRECATION")
            val consentIntent = extras.get(SmsRetriever.EXTRA_CONSENT_INTENT) as? Intent

            val activity = appContext.currentActivity
            if (consentIntent != null && activity != null) {
              try {
                activity.startActivityForResult(consentIntent, CONSENT_REQUEST_CODE)
              } catch (error: Exception) {
                sendEvent(EVENT_ERROR, mapOf("error" to (error.message ?: "Could not show consent dialog")))
              }
            }
          }

          CommonStatusCodes.TIMEOUT -> {
            sendEvent(EVENT_ERROR, mapOf("error" to "Timed out waiting for the OTP SMS"))
          }
        }
      }
    }

    val filter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(smsReceiver, filter, SmsRetriever.SEND_PERMISSION, null, Context.RECEIVER_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      context.registerReceiver(smsReceiver, filter, SmsRetriever.SEND_PERMISSION, null)
    }
    receiver = smsReceiver
  }

  private fun stop() {
    receiver?.let {
      try {
        context.unregisterReceiver(it)
      } catch (_: IllegalArgumentException) {
        // Already unregistered.
      }
    }
    receiver = null
  }
}
