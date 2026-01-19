
# 🚀 Fast Comand SM - Logistics Management System

An integrated system for managing shipping operations, orders, and inventory, built using React and Supabase.

## 📋 Requirements

*   Node.js (Version 18 or later)
*   Supabase account (for database and authentication)
*   **For Mobile Version:** Android Studio installed on your machine.

## 🛠️ Installation & Setup (GitHub)

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-username/fast-comand-sm.git
    cd fast-comand-sm
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables (.env):**
    *   **CRITICAL:** The application relies on environment variables to connect to your database.
    *   Create a new file in the root directory named `.env`.
    *   Copy the keys from your Supabase project dashboard (Project Settings -> API).
    
    **Example content for `.env`:**
    ```env
    VITE_SUPABASE_URL=YOUR_SUPABASE_URL
    VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
    ```

4.  **Run Locally:**
    ```bash
    npm run dev
    ```

## ☁️ Deployment

You can easily deploy the app on **Vercel**, **Netlify**, or **Cloudflare Pages**.
Ensure you add the `Environment Variables` in the hosting dashboard with the same names as in the `.env` file.

---

## 📱 Build APK (Android)

To convert the project into an Android app:

1.  Build the web version:
    ```bash
    npm run build
    ```
2.  Sync Capacitor files:
    ```bash
    npx cap sync
    ```
3.  Open Android Studio:
    ```bash
    npx cap open android
    ```

---

## 🗄️ Database Setup (First Time)

When running the app with a fresh Supabase project:
1.  The login screen will appear.
2.  If tables are missing, an error message will guide you.
3.  Log in with Admin credentials (or sign up a new user via Supabase dashboard manually if needed).
4.  Navigate to **Settings > Users > Database Setup**.
5.  Copy the SQL code and execute it in the **Supabase SQL Editor**.

---
Copyright © 2024
