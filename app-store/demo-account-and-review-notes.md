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

Give the shop a permanent licence with 1000 scan credits:

```bash
node scripts/grant_license.js --phone 9999999999 --apply --credits 1000
```

Then scan `sample-tag-GR10286.jpg` (in this folder) once from the gallery, so
History and Wishlist show something.

## 4. App Review Information (App Store Connect → your version)

**Sign-in required:** Yes

- **User name:** `9999999999`
- **Password:** `OTP 123456, then MPIN 1234`

**Notes** (paste as is; about 3,700 characters, under App Store Connect's
4,000 limit):

> WHAT THE APP DOES
> MRPscan is a business tool for GST-registered jewellery shops in India. The
> shop photographs the price tag on a piece of jewellery; the app reads the tag
> (weights, karat, diamonds, colour stones) and calculates the piece's selling
> price (MRP) from live gold rates and the shop's own labour and wastage
> settings, then makes a GST invoice for the shop's customer.
>
> HOW TO SIGN IN
> Tap Login, enter 9999999999 and tap Send code. No SMS is sent to this demo
> number: enter the code 123456, then the MPIN 1234.
>
> HOW TO TRY A SCAN
> Tap Scanner in the bottom bar. Tap the picture icon at the lower right of
> the camera frame, choose the attached image "sample-tag-GR10286.jpg" (or
> point the camera at it on another screen), then tap "Calculate directly".
> The result card shows the reading and the MRP; "Generate Invoice" makes the
> invoice. 24/7 in the bottom bar is a voice assistant for help with the app
> (it asks for permission before the first call).
>
> CREDITS AND THE LICENCE (business accounts only)
> - Who can have an account: only a GST-registered business. Sign-up requires
>   the business's GSTIN, which is verified against India's GST register before
>   the account is created. The business owner then adds staff logins with
>   their own permissions. Individuals and consumers cannot sign up.
> - Licence: each business (each GSTIN) buys a one-time application licence
>   directly from Amitaash IT Solutions Pvt. Ltd., with a GST tax invoice
>   issued to that business. A new business can first try the app for 7 days
>   with 10 trial credits, free; starting the trial involves no payment.
> - Credits: scanning is billed per use. Each completed tag scan deducts a
>   processing charge of about Rs 0.70 (the cost of reading the tag) from the
>   business account's prepaid balance; one credit equals one rupee. The
>   licence includes 1,000 credits. The balance belongs to the business and is
>   shared by its staff.
> - Recharging credits: when the balance runs low, the business tops it up
>   with an amount it chooses (at least 50 credits), credited one rupee to one
>   credit, with 18% GST charged on top (500 credits are invoiced at Rs 590).
>   A business on its licence, or still in its free trial, may recharge; after
>   the trial ends it must take the licence first. Recharges are bought and
>   invoiced like the licence, outside this app.
> - Referral credits: a business earns 50 bonus credits when another business
>   it invited signs up, and 500 when that business takes a licence. These are
>   credited automatically; nothing is bought in the app to earn them.
> - Where these are bought: outside this iOS app. They are sold by Amitaash IT
>   Solutions directly to the registered business, which is invoiced as a
>   business. The iOS app offers nothing for sale: no prices, no purchase or
>   recharge buttons, no links, and no instructions on where to pay. It only
>   shows the business account's current credits, licence status and its
>   statement of past charges, the way a company's account page would.
> - Why no In-App Purchase: the app is sold only to organisations (registered
>   businesses) for use by their staff, as described in guideline 3.1.3(c)
>   (Enterprise Services); and the iOS app is a free companion to that paid
>   business service with no purchasing or calls to action, as in 3.1.3(f).
>   The jewellery prices shown in the app (MRP, invoices) are for physical
>   goods the shop sells to its customers in person; no payment for them is
>   taken in the app.
>
> DEMO ACCOUNT
> The demo account is a demo business ("MRPscan Demo Jewellers") with a
> licence and over 1,000 credits, so every feature can be tried without any
> payment.
>
> Contact during review: info@mrpscan.com

**Attachment:** `sample-tag-GR10286.jpg`

### If Apple asks about payments (Resolution Center reply)

Paste and send as is if a reviewer raises guideline 3.1.1 (In-App Purchase):

> Thank you for the review. MRPscan is sold only to registered businesses, not
> to consumers, and nothing can be bought in the iOS app.
>
> 1. Accounts are business accounts. Creating an account requires the
>    business's GSTIN (its Indian GST registration), verified against the GST
>    register before the account exists. A person without a registered
>    business cannot sign up. The owner adds staff logins with their own
>    permissions, and all staff share the business's account.
> 2. The business buys a one-time licence for its GSTIN, and prepaid usage
>    credits for tag scanning (each scan costs about Rs 0.70 in processing),
>    directly from Amitaash IT Solutions Pvt. Ltd. The business is invoiced as
>    a business, with a GST tax invoice. This is the model in guideline
>    3.1.3(c), Enterprise Services: the app is sold directly to organisations
>    for use by their employees.
> 3. When its balance runs low, the business recharges the same way: it
>    chooses an amount (at least 50 credits, one credit per rupee, 18% GST on
>    top) and pays Amitaash IT Solutions outside the iOS app, receiving a GST
>    tax invoice. Credits are a balance of the business account, used only to
>    pay for its scan processing.
> 4. The iOS app contains no purchasing: no prices, no purchase or recharge
>    buttons, no external links or instructions about where to buy. It shows
>    only the business account's current balance, licence status and past
>    charges, the same information as a company account statement. In that
>    respect it is also a free stand-alone companion to the paid business
>    service, as in guideline 3.1.3(f).
> 5. The prices shown in the app's main feature are the selling prices of
>    physical jewellery that the shop sells to its customers in person
>    (guideline 3.1.3(e)); the app takes no payment for them.
>
> If any screen still reads as an offer to buy, please tell us which one and
> we will change it straight away.

Keep the app matching these words: if the owner decides to keep showing
credits in rupees ("Wallet Balance ₹…") on iPhone, the notes above already
explain it as the business account's balance; the safer option (status update,
decision 1) is to show the number of credits only.

## 5. During review, and after

- Keep the server (EC2) and `jmd.mrpscan.com` running.
- Don't change the demo shop's MPIN or delete its data until the app is
  approved. If Apple tries Delete Account (it works with OTP 123456 too), sign
  up again as in step 2 and re-run step 3.
- After approval, empty `REVIEW_LOGIN_PHONE` and `REVIEW_LOGIN_OTP` and restart
  the backend; set them again for the next review.
