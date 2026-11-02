# MRPscan — App Store checklist (what is left for you)

The app side is done (iPhone-only build, permission texts, privacy manifest,
no buying on iPhone, Privacy Policy in Settings, voice consent, demo login).
These steps are yours, in this order.

## 1. Deploy the servers first

Apple's reviewer uses the live servers, so they must run the new code.

- **Backend (appapi.mrpscan.com).** It is running commit `008cfb7` (checked
  31 Oct). Deploy the latest `main` (up to `98673a4`: the demo login, the
  faster scans and the new indexes). Then add to `backend/.env` and restart:

  ```
  REVIEW_LOGIN_PHONE=9999999999
  REVIEW_LOGIN_OTP=123456
  ```

- **Ask AI voice agent (prathamai.mrpscan.com).** Deploy `Dynamic Voice Agent`
  commit `b435795`, so an iPhone caller is never told prices or how to pay.

- Make the demo shop and give it the licence: see
  `demo-account-and-review-notes.md`.

## 2. Add three things to the privacy policy (mrpscan.com/privacy-policy)

Apple checks that the policy names who gets the data (rule 5.1.2(i)).
Add under "Jewellery Images and AI/OCR Processing" and a new section:

> **AI service providers.** Tag photos you scan are sent to OpenAI, which reads
> the tag's text and figures for us. When you use the Ask AI voice assistant,
> what you say during the call is sent to Deepgram (speech to text), OpenAI
> (the answer) and ElevenLabs (the spoken reply). The app asks for your
> permission before the first call.
>
> **Deleting your account.** You can delete your login inside the app:
> Settings → Delete Account, confirmed with an OTP sent to your phone.
>
> **Other service providers.** MSG91 sends the OTP to your phone, PDFMonkey
> makes the invoice PDF, and a GST verification service checks the GSTIN you
> enter.

## 3. App Store Connect → App Privacy

Tracking: **No** (the app has no ads or analytics SDK). For each type below:
collected **Yes**, linked to the user **Yes**, used for tracking **No**,
purpose **App Functionality**.

| Apple category | Data type | Why |
| --- | --- | --- |
| Contact Info | Phone Number | sign-in and OTP |
| Contact Info | Name | owner and employee names, invoice customers |
| Contact Info | Physical Address | shop address (GST), invoice customers |
| Contact Info | Email Address | invoice email to a customer (only if used) |
| User Content | Photos or Videos | tag photos |
| User Content | Audio Data | Ask AI voice assistant |
| User Content | Other User Content | invoices, wishlist, masters |
| Identifiers | User ID | account ID |
| Purchases | Purchase History | licence and credit history shown in the app |
| Other Data | Other Data Types | GSTIN |

## 4. App Store Connect → App Information and version

- **Privacy Policy URL:** https://mrpscan.com/privacy-policy
- **Support URL:** https://mrpscan.com/support
- **Category:** Business. **Age rating:** answer "None" to every question (4+).
- **Price:** Free. No In-App Purchases.
- **App Review Information:** demo account and notes from
  `demo-account-and-review-notes.md`.
- **Export compliance:** already answered in the build
  (`ITSAppUsesNonExemptEncryption = false`).

## 5. Build, test, submit

From `mrpscan-app/frontend`:

```bash
npx eas-cli build -p ios --profile production
```

```bash
npx eas-cli submit -p ios --latest
```

Install it from TestFlight on an iPhone and check: demo login (9999999999 →
123456 → 1234), a scan from the gallery, an invoice, Settings → Privacy
Policy, the Ask AI call (consent prompt first), and that no screen shows a
price, Purchase or Recharge. Take the screenshots there (6.9" iPhone,
1320 × 2868), then **Add for Review**.
