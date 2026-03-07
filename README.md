# 🚀 LIFE-APP: Pi Network Full-Stack Integration

## 📌 Description

A production-ready template for building Pi Network applications using React, Vite, Tailwind CSS, and Vercel Serverless Functions. This project eliminates the need for third-party tunneling like `ngrok` by running everything directly on Vercel.

## ✨ Features

- **Frontend**: React + Vite + TypeScript
- **UI**: Styled with Tailwind CSS
- **Backend**: Secure Vercel Serverless Functions (`/api/pay-test-user` & `/api/complete-payment`)
- **Pi SDK**: Integrated with the latest Pi SDK v2
- **A2U Payments**: App-to-User payment flow fully implemented
- **Domain Verification**: `public/validation-key.txt` contains both Testnet and Mainnet keys so a single deployment satisfies both Pi app verifications simultaneously

## 📁 Project Structure

```
LIFE-APP/
├── api/
│   ├── pay-test-user.ts       # A2U payment: create → submit → complete
│   └── complete-payment.ts    # Completes an incomplete/pending payment
├── src/
│   └── components/
│       └── PiPayment.jsx      # Pi payment UI component
├── public/
│   └── validation-key.txt     # Pi domain verification keys
├── .env.example               # Environment variables template
└── vercel.json                # Vercel configuration
```

## 🛠️ Setup & Deployment (Vercel)

### 1. Import the Repository
Go to [Vercel](https://vercel.com/) and import this GitHub repository.

### 2. Environment Variables
During the Vercel setup, open the **Environment Variables** section and add:

| Variable | Description |
|---|---|
| `PI_NETWORK` | `testnet` or `mainnet` |
| `PI_API_KEY_TESTNET` | API key from Pi Developer Portal (Testnet app) |
| `PI_API_KEY_MAINNET` | API key from Pi Developer Portal (Mainnet app) |
| `PI_APP_WALLET_SEED` | Secret seed starting with `S` from your Pi wallet |

> ⚠️ **Never commit your real `.env` values to GitHub.**

### 3. Deploy
Click the **Deploy** button. Done!

## 🔌 Pi Developer Portal Configuration

Once deployed on Vercel, copy your new domain (e.g., `https://your-app.vercel.app`) and configure your Pi App:

- **App URL**: `https://your-app.vercel.app`
- **Backend URL**: `https://your-app.vercel.app`
- Click **Verify Domain** for **both** your Testnet app and your Mainnet app — the hosted `validation-key.txt` contains both keys so each Pi verification bot finds the string it expects.

## 🔗 API Endpoints

### `POST /api/pay-test-user`
Initiates a full A2U (App-to-User) payment flow.

**Request body:**
```json
{ "uid": "user_pi_uid_here" }
```

**Response:**
```json
{ "success": true, "txid": "...", "paymentId": "..." }
```

### `POST /api/complete-payment`
Completes a pending/incomplete payment detected during authentication.

**Request body:**
```json
{ "paymentId": "...", "txid": "..." }
```

**Response:**
```json
{ "success": true, "txid": "..." }
```

## 💻 Local Development

```bash
npm install
npm run dev
```

> **Note:** For the Pi SDK to work properly, test the app via the Pi Browser pointing to your live Vercel URL.

## 🔒 Security Notes

- Rate limiting is applied to all API endpoints (in-memory — replace with [Upstash Redis](https://upstash.com/) in production)
- Double-spend protection is enforced both in-memory and by the Pi Network API
- API keys are selected automatically based on `PI_NETWORK` environment variable
- Error details are only exposed in `development` mode
