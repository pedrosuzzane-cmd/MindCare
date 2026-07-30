# MindCare 🧠

A mental wellness mobile & web application built with **Expo (SDK 51)**, **React Native**, **Firebase**, and **Google Gemini AI**.

## Features

- 📓 **Journaling** — Daily journal entries with mood tracking and AI-powered suggestions
- 🤖 **AI Helper** — Gemini-powered mental wellness assistant
- 📅 **Mood Calendar** — Visual mood tracking over time
- 🏆 **Achievements** — Gamified wellness milestones
- ⏰ **Daily Reminders** — Customizable notification schedules
- 👥 **Peer Messages** — Anonymous peer support messaging
- 🛡️ **Admin Panel** — User management and content moderation
- 📊 **Self-Assessment** — Periodic wellness check-ins

## Tech Stack

| Layer             | Technology                        |
| ----------------- | --------------------------------- |
| **Framework**     | Expo SDK 51 (React Native 0.74.5) |
| **Routing**       | Expo Router (file-based)          |
| **Backend**       | Node.js + Express                 |
| **AI**            | Google Gemini AI                  |
| **Auth & DB**     | Firebase Auth + Firestore         |
| **Notifications** | Expo Notifications                |
| **Media**         | Cloudinary                        |
| **Build**         | EAS Build (Android APK / Web)     |

---

## 📋 Prerequisites

Before you begin, ensure you have installed:

- **Node.js** v18+ (recommended: v20.x)
- **npm** v9+
- **Watchman** (for macOS — `brew install watchman`)
- **Android Studio** (for Android emulator) — [Download](https://developer.android.com/studio)
- **Expo Go** app on your phone (optional, for quick testing)
- **EAS CLI** for production builds:
  ```bash
  npm install -g eas-cli
  ```

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/pedrosuzzane-cmd/MindCare.git
cd MindCare
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Install Backend Dependencies

```bash
cd backend
npm install
cd ..
```

### 4. Configure Environment Variables

The project uses two `.env` files:

#### Root `.env` (Frontend — required)

Create or update `./.env`:

```env
# API
EXPO_PUBLIC_API_URL=https://mindcare-api-wcqr.onrender.com
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key

# Cloudinary
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name

# Firebase
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Gemini backend key
GEMINI_API_KEY=your_gemini_api_key

# EAS
EAS_PROJECT_ID=your_eas_project_id
```

#### Backend `.env` (Backend server — required)

Create or update `./backend/.env`:

```env
AI_BACKEND_URL=http://localhost:3000
GEMINI_API_KEY=your_gemini_api_key

# Firebase (same as frontend)
EXPO_PUBLIC_FIREBASE_API_KEY="..."
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
EXPO_PUBLIC_FIREBASE_PROJECT_ID="..."
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET="..."
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
EXPO_PUBLIC_FIREBASE_APP_ID="..."
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID="..."
```

> ⚠️ **Security:** Never commit `.env` files to version control. The `.gitignore` already excludes them.

---

## 🌐 Running on Web

```bash
# From the project root:
npx expo start --web
```

This starts the Expo dev server. Open the URL shown in the terminal (usually `http://localhost:8081`) in your browser.

**Troubleshooting:**

- If you see `getReactNativePersistence is not a function`, ensure you're on the latest code — this was fixed with a platform check in `constants/firebase.ts`
- Web builds use in-memory Firebase auth persistence (no AsyncStorage needed)

---

## 📱 Running on Android (Development)

### Option A: Expo Go (Quickest)

1. Install **Expo Go** from the Google Play Store
2. Run:
   ```bash
   npx expo start
   ```
3. Scan the QR code with the Expo Go app

> ⚠️ **Limitations:** Expo Go does not support all native modules (e.g., custom notifications, certain Firebase features).

### Option B: Android Emulator

1. Open Android Studio → **Virtual Device Manager**
2. Create/start an Android emulator (API 34 recommended)
3. Run:
   ```bash
   npx expo start --android
   ```

### Option C: Physical Device via USB

1. Enable **USB Debugging** on your Android device
2. Connect via USB
3. Run:
   ```bash
   npx expo start --android
   ```

---

## 📦 Building for Production (Android APK)

### Using EAS Build (Cloud)

1. **Login to EAS:**

   ```bash
   eas login
   ```

2. **Configure the project** (first time only):

   ```bash
   eas build:configure
   ```

3. **Build an APK for development:**

   ```bash
   eas build --platform android --profile development
   ```

4. **Build a preview APK:**

   ```bash
   eas build --platform android --profile preview
   ```

   The APK will be downloadable from the EAS dashboard.

5. **Build a production APK:**
   ```bash
   eas build --platform android --profile production
   ```

### Build Profiles (from `eas.json`)

| Profile       | Type               | Use Case                   |
| ------------- | ------------------ | -------------------------- |
| `development` | Development client | Testing during development |
| `preview`     | Internal APK       | Sharing with testers       |
| `production`  | Release APK        | Play Store submission      |

> 💡 **Note:** The `expo-build-properties` plugin is pre-configured in `app.config.js` with `compileSdkVersion: 34`, `targetSdkVersion: 34`, and Kotlin 1.9.24 to fix known EAS build issues.

---

## 🖥️ Running the Backend Server

```bash
cd backend
node server.js
```

The backend server starts on `http://localhost:3000` by default (configurable via `AI_BACKEND_URL` in `.env`).

**Available backend routes:**

- `POST /api/chat` — AI chat endpoint (Gemini/GROQ)
- `POST /api/send-otp` — Send OTP for password reset
- `POST /api/verify-otp` — Verify OTP

---

## 🧪 Project Structure

```
MindCare/
├── app/                    # Expo Router pages (file-based routing)
│   ├── (admin)/            # Admin panel routes
│   ├── (student)/          # Student routes
│   ├── auth/               # Authentication screens
│   └── _layout.tsx         # Root layout
├── backend/                # Express backend server
│   ├── server.js
│   └── .env
├── components/             # Reusable UI components
│   ├── admin/
│   ├── chat/
│   ├── student/
│   └── ui/
├── constants/              # Firebase config & theme
│   └── firebase.ts
├── hooks/                  # Custom React hooks
│   ├── AuthContext.tsx
│   ├── useChat.ts
│   ├── useJournal.ts
│   └── ...
├── services/               # Business logic & API services
│   ├── geminiService.ts
│   ├── journalService.ts
│   ├── chatService.ts
│   └── ...
├── types/                  # TypeScript type definitions
├── utils/                  # Utility functions
├── app.config.js           # Dynamic Expo config
├── app.json                # Static Expo config
├── eas.json                # EAS Build profiles
└── .env                    # Frontend environment variables
```

---

## ❗ Troubleshooting

| Problem                                                     | Solution                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `compileSdkVersion is not specified` during EAS build       | ✅ Fixed — the `expo-build-properties` plugin in `app.config.js` sets it to 34 |
| `Could not get unknown property 'release'` during EAS build | ✅ Fixed — Kotlin version pinned to `1.9.24` in `expo-build-properties`        |
| `getReactNativePersistence is not a function` on web        | ✅ Fixed — Added `Platform.OS === "web"` check in `constants/firebase.ts`      |
| `auth/already-initialized` during hot reload                | Handled — falls back to `getAuth(app)` gracefully                              |
| Module not found errors                                     | Run `npm install` in both root and `backend/` directories                      |
| EAS build fails                                             | Ensure you're logged in (`eas login`) and the project is configured            |

---

## 📄 License

This project is for educational/wellness purposes.
