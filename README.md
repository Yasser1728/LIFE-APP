# LIFE-APP: Pi Network Full-Stack Integration

> 🌐 [English](#english) | [العربية](#arabic)

---

<a name="english"></a>
## 🇬🇧 English

### Description

A production-ready template for building Pi Network applications using **React**, **Vite**, **Tailwind CSS**, and **Vercel Serverless Functions**. This project provides a complete full-stack integration with the Pi Network ecosystem — no `ngrok` or custom server required.

### Features

- 🚀 **Full-stack Pi Network integration** — Frontend + Serverless Backend in one repo.
- 🔐 **Secure payment flow** (Approve & Complete) via `api.minepi.com/v2`.
- ⚡ **No `ngrok` required** — deployed entirely on Vercel with zero infrastructure management.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS |
| Backend | Vercel Serverless Functions (TypeScript) |
| Deployment | Vercel |

### Deployment on Vercel

1. **Import** this repository into [Vercel](https://vercel.com).
2. In the **"Environment Variables"** section of your project settings, add:
   - **Key**: `PI_API_KEY`
   - **Value**: your actual API key from the [Pi Developer Portal](https://developers.minepi.com)
3. Click **Deploy**.

Your app will be live on a `*.vercel.app` domain in seconds.

### Pi Developer Portal Setup

After deploying, configure your app in the Pi Developer Portal:

- Set your **App URL** and **Backend URL** to your new `*.vercel.app` domain.
- The **domain verification file** (`public/validation-key.txt`) is included in the repository. Replace its contents with your actual validation key from the Pi Developer Portal.

### Environment Variables

Copy `.env.example` to `.env.local` for local development:

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `PI_API_KEY` | Your Pi Network API key from the Pi Developer Portal |

---

<a name="arabic"></a>
## 🇸🇦 العربية

### الوصف

قالب جاهز للإنتاج لبناء تطبيقات شبكة Pi باستخدام **React** و**Vite** و**Tailwind CSS** و**Vercel Serverless Functions**. يوفر هذا المشروع تكاملاً كاملاً مع نظام Pi Network — دون الحاجة إلى `ngrok` أو خادم مخصص.

### المميزات

- 🚀 **تكامل كامل مع Pi Network** — واجهة أمامية + خلفية بدون خادم في مستودع واحد.
- 🔐 **تدفق دفع آمن** (موافقة وإتمام) عبر `api.minepi.com/v2`.
- ⚡ **لا حاجة لـ `ngrok`** — نشر كامل على Vercel بدون إدارة بنية تحتية.

### النشر على Vercel

1. **استيراد** هذا المستودع إلى [Vercel](https://vercel.com).
2. في قسم **"Environment Variables"** من إعدادات مشروعك، أضف:
   - **المفتاح**: `PI_API_KEY`
   - **القيمة**: مفتاح API الخاص بك من [بوابة Pi للمطورين](https://developers.minepi.com)
3. اضغط على **Deploy**.

سيكون تطبيقك متاحاً على نطاق `*.vercel.app` في ثوانٍ.

### إعداد بوابة Pi للمطورين

بعد النشر، قم بتهيئة تطبيقك في بوابة Pi للمطورين:

- اضبط **App URL** و**Backend URL** على نطاق `*.vercel.app` الجديد الخاص بك.
- ملف التحقق من النطاق (`validation-key.txt`) مضمن بالفعل في مجلد `public` — استبدل محتواه بمفتاح التحقق الخاص بك من البوابة.

### متغيرات البيئة

انسخ `.env.example` إلى `.env.local` للتطوير المحلي:

```bash
cp .env.example .env.local
```

| المتغير | الوصف |
|---------|-------|
| `PI_API_KEY` | مفتاح Pi Network API من بوابة Pi للمطورين |

---

## License

MIT
