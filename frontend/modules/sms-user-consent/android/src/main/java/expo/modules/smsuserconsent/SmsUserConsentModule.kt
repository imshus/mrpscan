package expo.modules.smsuserconsent

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.Signature
import android.os.Build
import android.util.Base64
import android.util.Log
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.charset.StandardCharsets
import java.security.MessageDigest

private const val TAG = "SmsUserConsent"

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

    // The 11-character code Google's zero-tap SMS Retriever matches against.
    // Put it at the end of the OTP SMS template and the code fills with no
    // tap at all; it changes with the signing key, never at runtime.
    Function("getAppHash") {
      appHashes().firstOrNull() ?: ""
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
    // null sender = accept a code from any number. The task fails quietly on
    // devices whose Play services refuse it (missing, stale, or an OEM build),
    // and a swallowed failure looks exactly like "nothing appeared" — so it is
    // surfaced as an event the JS side can fall back on.
    SmsRetriever.getClient(context).startSmsUserConsent(null)
      .addOnFailureListener { error ->
        sendEvent(
          EVENT_ERROR,
          mapOf("error" to (error.message ?: "Could not start SMS user consent")),
        )
      }

    // Google's zero-tap path runs alongside consent: when the SMS template
    // ends with this app's 11-character hash, the broadcast carries the whole
    // message and no dialog is needed. Costs nothing when the hash is absent —
    // it just times out quietly. The hash is logged so it can be read off
    // `adb logcat` and pasted into the MSG91 template.
    Log.i(TAG, "Zero-tap app hash(es): " + appHashes().joinToString(","))
    SmsRetriever.getClient(context).startSmsRetriever()
      .addOnFailureListener { error ->
        Log.w(TAG, "startSmsRetriever failed: " + (error.message ?: "unknown"))
      }

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
            // Zero-tap retriever first: when the template carries the app
            // hash, the message itself is in the broadcast and no dialog is
            // needed at all.
            val directMessage = extras.getString(SmsRetriever.EXTRA_SMS_MESSAGE)
            if (directMessage != null) {
              sendEvent(EVENT_RECEIVED, mapOf("message" to directMessage))
              return
            }

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

  /**
   * Google's AppSignatureHelper algorithm: SHA-256 over "package signature",
   * first 9 bytes, base64, first 11 characters. One hash per signing cert.
   */
  private fun appHashes(): List<String> {
    return try {
      val packageName = context.packageName
      val pm = context.packageManager
      val signatures: List<Signature> = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        val info = pm.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
        val signingInfo = info.signingInfo
        when {
          signingInfo == null -> emptyList()
          signingInfo.hasMultipleSigners() -> signingInfo.apkContentsSigners.toList()
          else -> signingInfo.signingCertificateHistory.toList()
        }
      } else {
        @Suppress("DEPRECATION")
        pm.getPackageInfo(packageName, PackageManager.GET_SIGNATURES).signatures?.toList()
          ?: emptyList()
      }

      signatures.mapNotNull { signature ->
        try {
          val digest = MessageDigest.getInstance("SHA-256")
          digest.update("$packageName ${signature.toCharsString()}".toByteArray(StandardCharsets.UTF_8))
          Base64.encodeToString(digest.digest().copyOfRange(0, 9), Base64.NO_PADDING or Base64.NO_WRAP)
            .substring(0, 11)
        } catch (error: Exception) {
          Log.w(TAG, "Could not hash a signing certificate: " + (error.message ?: "unknown"))
          null
        }
      }
    } catch (error: Exception) {
      Log.w(TAG, "Could not read signing certificates: " + (error.message ?: "unknown"))
      emptyList()
    }
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
