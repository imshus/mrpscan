# MRPscan — UI/UX Design Mockup

This is a **static, click-through HTML/CSS/JS prototype** of the MRPscan app's screens and flows — cream/red brand theme, Android phone-frame mockup. It is a **design reference only** (no real backend, no real auth) meant to guide the actual React Native implementation in `frontend/`.

## How to preview

No build step needed — it's plain HTML/CSS/JS.

```bash
cd design-mockup
python -m http.server 8103
```

Then open `http://localhost:8103` in a browser (resize to a phone-width viewport, e.g. 375×812, for the intended look).

## What's covered

- **Onboarding**: Splash → Login → Signup + phone OTP → GST verification → success → Home
- **Forgot User ID / Forgot Password** flows (OTP-based)
- **Home / Dashboard**: trial/license tile, live date/time, MCX + Gold(24K) rate cards, **Bhaw tile** (see API section below), floating bottom nav (Home / Scanner / Pratham AI)
- **Scanner flow**: Capture (camera/upload) → Processing → Review (editable Gold/Diamond/Labour breakdown) → Final Result → Generate Invoice
- **Settings** (hamburger menu): Dashboard Settings (rate-card visibility toggles), Masters → Rates, Business Profile, Wishlist, full Employee Manager (list/add/permissions/password/detail)

Screens are hidden `<section class="screen">` elements toggled by class in `script.js`; there's no router — every screen already exists in the DOM.

## Live Bhaw (gold rate) integration

The Home screen's **Bhaw tile** is already wired to a real, working API — this is the exact contract to implement in the real app:

```
GET https://17gdivfex7.execute-api.ap-south-1.amazonaws.com/bhaw

Response 200 (application/json):
{
  "source": "jmd_patil",
  "name": "JMD Patil",
  "cash_bhaw": -2500,      // can be null if not yet updated by that vendor
  "rtgs_bhaw": 2900,       // can be null
  "updated_at": "2026-08-27T11:52:12+0530"
}
```

- This always returns whichever vendor is currently "active" — that selection is controlled elsewhere (a separate internal admin dashboard), MRPscan only ever needs this one **read-only** GET.
- Poll every 30s while the Home screen is visible.
- If `cash_bhaw` / `rtgs_bhaw` is `null`, show `—` instead of a number (see `formatBhaw()` in `script.js`).
- See `script.js` (search for `BHAW_URL`) for the full working reference implementation, including the separate admin-only endpoints used just to demo source-switching in this mockup (not needed in the real app).

## Notes for implementation

- All screen content for Settings-menu screens (Dashboard Settings, Masters, Employee Manager, etc.) was built by reading the actual screen files in `frontend/app/dashboard/**` — field names, labels, and flow order match the real app; only the visual theme differs (cream/red instead of the old dark-green placeholder branding).
- Several Settings-menu items are intentionally **not yet built** here (Password Manager, Credits & Subscription, Market Rates edit screens, Inventory, Invoice Preview) — ask before assuming a screen doesn't exist in the real app just because it's missing from this mockup.
