# 🚀 LIFE-APP: Pi Network Full-Stack Integration

## 📌 Description
A production-ready template for building Pi Network applications using React, Vite, Tailwind CSS, and Vercel Serverless Functions. This project eliminates the need for third-party tunneling like `ngrok` by running everything directly on Vercel.

## ✨ Features
- **Frontend**: React + Vite + TypeScript.
- **UI**: Styled with Tailwind CSS.
- **Backend**: Secure Vercel Serverless Functions (`/api/approve-payment` & `/api/complete-payment`).
- **Pi SDK**: Integrated with the latest Pi SDK v2.
- **Domain Verification**: `public/validation-key.txt` contains both Testnet and Mainnet keys so a single deployment satisfies both Pi app verifications simultaneously.

## 🛠️ Setup & Deployment (Vercel)
This project is designed to be deployed directly to Vercel in less than 2 minutes.

1. **Import the Repository**: Go to [Vercel](https://vercel.com/) and import this GitHub repository.
2. **Environment Variables**: During the Vercel setup, open the "Environment Variables" section.
   - Add a new variable named `PI_API_KEY`.
   - Paste your API key from the Pi Developer Portal.
3. **Deploy**: Click the Deploy button.

## 🔌 Pi Developer Portal Configuration
Once deployed on Vercel, copy your new domain (e.g., `https://your-app.vercel.app`) and configure your Pi App:
- **App URL**: `https://your-app.vercel.app`
- **Backend URL**: `https://your-app.vercel.app`
- Click **Verify Domain** for **both** your Testnet app and your Mainnet app — the hosted `validation-key.txt` contains both keys so each Pi verification bot finds the string it expects.

## 💻 Local Development
To run the project locally:
```bash
npm install
npm run dev
```
*(Note: For the Pi SDK to work properly, it is highly recommended to test the app via the Pi Browser pointing to your live Vercel URL).*