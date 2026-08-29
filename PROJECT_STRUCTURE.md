# Project Structure

Quick map of this repo — mainly for whoever's picking up the **backend** (deploying to AWS).

```
mrpscan-app/
│
├── backend/                          ← START HERE for backend/AWS work
│   ├── .env.example                  copy to .env, fill in your own keys
│   ├── package.json                  npm install && npm run dev  (main: src/server.js)
│   ├── FUNCTIONAL_ENDPOINTS.md       full API reference — payloads, responses, error cases
│   ├── REST_APIS.md                  endpoint list
│   ├── SERVICES.md                   what each service module does
│   │
│   └── src/
│       ├── server.js                 entry point — starts the HTTP server
│       ├── app.js                    Express app setup (middleware, route mounting)
│       │
│       ├── config/
│       │   ├── env.js                validates & exports every required env var — read this first
│       │   └── db.js                 MongoDB connection
│       │
│       ├── routes/                   URL → controller wiring, one file per feature
│       │   ├── auth.routes.js          login, register, OTP, GST verify
│       │   ├── scan.routes.js          tag scanning flow
│       │   ├── employee.routes.js
│       │   ├── invoice.routes.js
│       │   ├── payment.routes.js
│       │   ├── rate.routes.js          gold/diamond/stone rates
│       │   ├── settings.routes.js
│       │   ├── subscription.routes.js
│       │   ├── wishlist.routes.js
│       │   └── temp.routes.js
│       │
│       ├── controllers/              request handling — one file per route file above
│       ├── services/                 business logic (this is where most of the real work is)
│       │   ├── auth.service.js
│       │   ├── otp.service.js          MSG91 SMS OTP
│       │   ├── gst.service.js          Masters India GST verification
│       │   ├── gemini.service.js       Gemini Vision — tag scan → structured data
│       │   ├── openai.service.js       fallback/alt AI provider
│       │   ├── razorpay.service.js     payments
│       │   ├── billing.service.js      scan-based billing/credits
│       │   ├── rateCalculation.service.js
│       │   ├── mcx.service.js          live gold/commodity rate fetching
│       │   └── ... (rest are feature-specific, named to match)
│       │
│       ├── models/                   Mongoose schemas — one per collection
│       ├── middleware/               auth, RBAC, rate limiting, upload handling, error handling
│       ├── validators/               request payload validation (Joi)
│       ├── repositories/             OTP storage abstraction
│       ├── redis/                    Redis client setup
│       ├── prompts/                  the actual prompt sent to Gemini/OpenAI for tag scanning
│       ├── utils/                    small shared helpers
│       └── uploads/                  scanned tag images land here at runtime (gitignored)
│
│   ├── scripts/                      one-off/admin scripts (create_super_admin.js, billing reconciliation)
│   └── tests/                        node --test suite
│
├── frontend/                         React Native (Expo Router) app — being redesigned, browse if curious
│   ├── .env.example
│   ├── app/                          screens (login/, register/, dashboard/)
│   ├── components/                   UI components, grouped by feature
│   ├── store/                        Redux state
│   └── constants/api.ts              ← where EXPO_PUBLIC_API_URL is read (point this at your AWS backend)
│
├── docs/                             API contracts, DB design notes, prompt notes
└── README.md
```

## Fastest path to running the backend locally

```bash
cd backend
cp .env.example .env      # then fill in your MongoDB/Redis/API keys
npm install
npm run dev                # nodemon src/server.js — restarts on file changes
```

Server starts on `PORT` from `.env` (defaults to 3000). Hit `GET /` — you should see
`Jewellery Tag Backend is running`.
