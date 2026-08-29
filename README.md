# MRPscan

Jewellery tag scanning platform — Node.js/Express backend + React Native (Expo) frontend.

## Structure

```
backend/    Node.js + Express + MongoDB + Redis API
frontend/   React Native (Expo Router) mobile app
```

## Status

Pre-launch. This repo is a clean working copy assembled for the team taking the project forward
independently — backend will be hosted on AWS with a fresh database and the team's own API keys
(no data or credentials carried over). The frontend's onboarding flow (splash/login/signup/OTP/GST)
is being redesigned; other screens still reflect the original build and will be replaced
incrementally.

## Backend setup

```
cd backend
npm install
```

Required environment variables (see `backend/src/config/env.js` for the full list): MongoDB URI,
Redis URL, JWT secrets, and API keys for Gemini, OpenAI, MSG91 (SMS OTP), Razorpay, and Masters
India (GST verification). Create fresh accounts for each — do not reuse the original developer's
credentials.

```
npm run dev
```

## Frontend setup

```
cd frontend
npm install
npx expo start
```

See `backend/FUNCTIONAL_ENDPOINTS.md` and `backend/REST_APIS.md` for the API contract.
