# MRPscan — App Store demo account and review notes

## 1. Make the demo shop (you, on your phone)

Use a real Indian mobile number you control and keep with you during review
(a spare SIM is best). Don't use your personal number.

1. Install the app (or the TestFlight build) and tap **Sign up**.
2. Enter the demo number, then the OTP that arrives by SMS.
3. Fill the shop details. Use a real GSTIN the company may use for a demo shop
   (the GST check needs a valid one) and a shop name like "MRPscan Demo Jewellers".
4. Set the 4-digit MPIN. Write it down: Apple needs it.
5. Dashboard Settings → Choose a Bullion → keep **JMD Patil**.

## 2. Fill it with sample data and credits (on this computer, after step 1)

Run from the `backend` folder. Each command first runs as a dry run and only
writes with `--apply`.

```bash
node scripts/seed_review_demo.js --phone <demo number>
```

```bash
node scripts/seed_review_demo.js --phone <demo number> --apply
```

That adds labour codes LB-01…LB-06, wastage codes WS-05/08/10/12 and item
codes GR (Gold Ring) and LR (Ladies Ring).

Give the shop scan credits for the reviewer (a licence with its bonus credits):

```bash
node scripts/grant_license.js --phone <demo number> --apply
```

Then open the app with the demo number and scan `sample-tag-GR10286.jpg` (in
this folder) once from the gallery, so History and Wishlist show something.

## 3. App Review Information (App Store Connect → your version)

**Sign-in required:** Yes

- **User name:** `<demo number>` (10 digits, India)
- **Password:** `MPIN <your 4 digits>`

**Notes** (paste and fill in):

> MRPscan is a business tool for Indian jewellery shops. It reads the price tag
> on a piece of jewellery (gross/net weight, karat, diamond and colour-stone
> details) with the camera and calculates its selling price (MRP) from live
> gold rates and the shop's own labour and wastage settings.
>
> To sign in: enter the demo number above, tap Get OTP, then enter the OTP.
> The OTP is sent by SMS to an Indian number; please message us in the
> Resolution Center and we will reply with the OTP right away (we will be
> available during review, IST). After the OTP, enter the MPIN above.
>
> To try the main feature: Home → Scan → Upload → choose the attached image
> "sample-tag-GR10286.jpg" (or point the camera at it on a screen) → Calculate.
> The review card shows the reading and the MRP; Generate Invoice creates a GST
> invoice.
>
> The app does not sell anything on iPhone. Shops' licences and scan credits
> are managed outside the app.

**Attachment:** `sample-tag-GR10286.jpg`

## 4. During review

- Keep the demo phone on and check App Store Connect / the Resolution Center
  a few times a day; reply with the OTP as soon as Apple asks.
- Keep the server (EC2) and `jmd.mrpscan.com` running.
- Don't change the demo shop's MPIN or delete its data until the app is approved.
