# MRPscan — App Store demo account and review notes

Demo account: number **9999999999**, OTP **123456**, MPIN **1234**.

## 1. Turn on the demo number (server, EC2)

Add these two lines to the server's `backend/.env` and restart the backend:

```
REVIEW_LOGIN_PHONE=9999999999
REVIEW_LOGIN_OTP=123456
```

From then on 9999999999 gets OTP 123456 on the OTP screen, and no SMS is
sent. Every other number works as before. The server needs this commit
(the one that adds `REVIEW_LOGIN_PHONE`) deployed.

## 2. Make the demo shop (you, in the app)

1. Tap **Sign up**, enter **9999999999**, then OTP **123456**.
2. Fill the shop details. Use a real GSTIN the company may use for a demo shop
   (the GST check needs a valid one, not already registered) and a shop name
   like "MRPscan Demo Jewellers".
3. Set the MPIN to **1234**.
4. Dashboard Settings → Choose a Bullion → keep **JMD Patil**.

Log in once to check: **9999999999** → OTP section → **123456** → MPIN **1234**.

## 3. Fill it with sample data and credits (on the server, after step 2)

Run from the `backend` folder. Each command first runs as a dry run and only
writes with `--apply`.

```bash
node scripts/seed_review_demo.js --phone 9999999999
```

```bash
node scripts/seed_review_demo.js --phone 9999999999 --apply
```

That adds labour codes LB-01…LB-06, wastage codes WS-05/08/10/12 and item
codes GR (Gold Ring) and LR (Ladies Ring).

Give the shop scan credits for the reviewer (a licence with its bonus credits):

```bash
node scripts/grant_license.js --phone 9999999999 --apply
```

Then scan `sample-tag-GR10286.jpg` (in this folder) once from the gallery, so
History and Wishlist show something.

## 4. App Review Information (App Store Connect → your version)

**Sign-in required:** Yes

- **User name:** `9999999999`
- **Password:** `OTP 123456, then MPIN 1234`

**Notes** (paste as is):

> MRPscan is a business tool for Indian jewellery shops. It reads the price tag
> on a piece of jewellery (gross/net weight, karat, diamond and colour-stone
> details) with the camera and calculates its selling price (MRP) from live
> gold rates and the shop's own labour and wastage settings.
>
> To sign in: tap Log In, enter the phone number 9999999999 and tap Get OTP.
> No SMS is sent to this demo number: enter the OTP 123456. Then enter the
> MPIN 1234.
>
> To try the main feature: Home → Scan → Upload → choose the attached image
> "sample-tag-GR10286.jpg" (or point the camera at it on a screen) → Calculate.
> The review card shows the reading and the MRP; Generate Invoice creates a GST
> invoice.
>
> The app does not sell anything on iPhone. Shops' licences and scan credits
> are managed outside the app.

**Attachment:** `sample-tag-GR10286.jpg`

## 5. During review, and after

- Keep the server (EC2) and `jmd.mrpscan.com` running.
- Don't change the demo shop's MPIN or delete its data until the app is
  approved. If Apple tries Delete Account (it works with OTP 123456 too), sign
  up again as in step 2 and re-run step 3.
- After approval, empty `REVIEW_LOGIN_PHONE` and `REVIEW_LOGIN_OTP` and restart
  the backend; set them again for the next review.
