# Razorpay setup for MRPscan

MRPscan takes payments in two places, and both already run through Razorpay:

| Screen | What is paid | Server order endpoint |
|---|---|---|
| Purchase Licence | the one-time application licence (bonus wallet credits are added) | `POST /api/v1/payments/orders/application` |
| Credits & Subscription | credit recharge (quick amounts or a custom amount) | `POST /api/v1/payments/orders/credits` |

Both follow the same secure sequence:

1. The app asks the server for an order. The server creates it at Razorpay with auto-capture and returns the order id, amount and the **Key ID** to use.
2. The app opens the Razorpay checkout with that order.
3. The app sends the payment id and signature to `POST /api/v1/payments/verify`. The server checks the signature with the Key Secret, fetches the payment from Razorpay, and applies the licence or credits only when Razorpay reports the payment as **captured**. Applying is idempotent, so a repeated verify never double-credits.
4. A cancelled or failed checkout is recorded via `POST /api/v1/payments/mark-failure` and never activates anything.
5. Independently, Razorpay calls the webhook `POST /api/v1/webhooks/razorpay`. Its signature is checked with the Webhook Secret, each event id is processed once, and `payment.captured`, `payment.failed` and `refund.processed` update the same records. This is what activates a payment if the phone lost connection right after paying.

## What to do in the Razorpay dashboard

1. **Activate the account (KYC).** Account & Settings → Account activation. Until activation is complete only test mode works. Submit the business PAN, bank account, and the signatory's ID.
2. **Business website and app.** Account & Settings → Website & app settings (also asked during activation).
   - Website: `https://amitaash.com`. The page must be reachable and describe the business; a landing page with the product name, contact details, and links to a privacy policy, terms, and a refund/cancellation policy is what the reviewers look for.
   - App: choose "Android app", give the package name `com.amitaashitsolutions` and, once the Play listing is live, its Play Store URL. Until then you can submit the APK/bundle for review if the dashboard asks for it.
3. **API keys.** Account & Settings → API keys.
   - Test keys (`rzp_test_…`) are what the app and server use today.
   - After activation, click **Generate live key**. You get a live **Key ID** (`rzp_live_…`) and a live **Key Secret** shown once. Store the secret in a password manager immediately.
4. **Webhook.** Account & Settings → Webhooks → Add new webhook.
   - URL: `https://amitaash.com/api/v1/webhooks/razorpay`
   - Secret: type a long random string (this is the Webhook Secret; it is not the Key Secret).
   - Active events: `payment.captured`, `payment.failed`, `refund.processed`. (`order.paid` is optional.)
   - Create it separately for test mode and live mode; each mode has its own webhook list.
5. **Checkout branding** (optional). Account & Settings → Checkout: upload the logo and set the brand colour. The app already sets the name "MRPscan" and the brand colour on the checkout.

## Where the keys go

Never paste a Key Secret or Webhook Secret into chat, email, or a ticket. They belong only in the server's environment file.

Server (`backend/.env` on the server, then restart the API):

```
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=<live key secret>
RAZORPAY_WEBHOOK_SECRET=<the secret you typed when creating the webhook>
```

App (`frontend/.env`, baked into the APK/bundle at build time):

```
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
```

The server sends its Key ID with every order, and the app uses that one first, so switching the server to live keys takes effect on installed phones immediately; the app value is only a fallback. Rebuild the app anyway before the Play release so the fallback matches.

## What to share for the integration

- The live **Key ID** only (`rzp_live_…`). It is a publishable identifier and is safe to share.
- Confirmation that the webhook is created with the URL above and which events are ticked.
- Nothing else. The Key Secret and Webhook Secret must be entered by you on the server.

## Testing before going live

In test mode, Razorpay's checkout accepts test instruments:

- UPI: `success@razorpay` succeeds, `failure@razorpay` fails.
- Cards: `4111 1111 1111 1111` (any future expiry, any CVV) succeeds.
- Netbanking: pick any bank; the test page offers Success and Failure buttons.

Check each of these once with test keys:

1. Purchase Licence → pay → the licence activates and bonus credits appear.
2. Credits & Subscription → recharge → the wallet balance increases once, even if verify is retried.
3. Start a payment and press back: nothing activates, and Payment History shows the failed attempt.
4. Dashboard → Webhooks → the webhook shows deliveries with 200 responses.

## Going live

1. Activation approved, live keys generated, live webhook created.
2. Update the server `.env` with the three live values and restart the API.
3. Update `EXPO_PUBLIC_RAZORPAY_KEY_ID` in `frontend/.env`, then build the Play bundle with `npm run build:aab`.
4. Make one real small recharge (₹1 is allowed) and confirm the wallet updates and the webhook delivery is 200.
5. Keep the test keys for staging; never mix test and live between the app and the server: an order created with live keys cannot be paid with a test Key ID, and the checkout shows "Key ID mismatch".
