# VIN_IB Inspector System

A multi-platform Vehicle Identification Number (VIN) inspection and management system consisting of:
1. **Backend Server** (`/backend`): Node.js, Express, SQLite, OCR & Gemini AI services.
2. **Web Portal** (`/portal`): React + Vite management dashboard for Super Admins and Tenants.
3. **Mobile App** (Root / `/app`): Expo & React Native app for Mechanics to capture VIN inspections.

---

## Prerequisites

Before running the project locally, ensure you have installed:
- [Node.js](https://nodejs.org/) (v18 or higher recommended) & `npm`
- [Expo Go](https://expo.dev/go) on your mobile device (iOS/Android), or an Android Emulator / iOS Simulator
- (Optional) A Google Gemini API key if you plan to use AI-based VIN extraction/verification

---

## Project Architecture & Ports

| Component | Directory | Default URL / Port | Technology |
| :--- | :--- | :--- | :--- |
| **Backend API** | `./backend` | `http://localhost:3000` | Node.js, Express, SQLite |
| **Web Portal** | `./portal` | `http://localhost:5173` | React, Vite, TypeScript |
| **Mobile App** | Root (`./`) | Expo Dev Tools / Port `8081` | Expo, React Native |

---

## Step-by-Step Local Setup

Run each component in a separate terminal window or tab.

### 1. Start the Backend Server

The backend manages authentication, SQLite database storage, image uploads, and inspection validation.

1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   - Create a `.env` file (or copy from `.env.example`):
     ```bash
     cp .env.example .env
     ```
   - Add your Gemini API key (optional for core features, required for AI OCR):
     ```env
     GEMINI_API_KEY=your_gemini_api_key_here
     ```
4. Start the server:
   - For development (with auto-reload):
     ```bash
     npm run dev
     ```
   - Or start standard:
     ```bash
     npm start
     ```
5. Server will run at **`http://localhost:3000`**.

> **Default Super Admin Credentials:**
> - **Username:** `admin`
> - **Password:** `admin123`

---

### 2. Start the Web Portal

The web portal enables Super Admins to manage Tenants and Tenants to manage Mechanics and review inspection data.

1. Open a second terminal and navigate to the `portal` directory:
   ```bash
   cd portal
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to **`http://localhost:5173`**.
5. Log in with the default credentials (`admin` / `admin123`).
6. **Set up initial accounts for testing:**
   - As Super Admin (`admin`), create a **Tenant**.
   - Log out and log in using the newly created Tenant account.
   - As Tenant, create a **Mechanic** account (these credentials will be used to log into the mobile app).

---

### 3. Run the Mobile App

The mobile application is used by mechanics to scan VINs, take photos, capture GPS location, and submit inspection records.

1. Open a third terminal in the project root directory (`FE_VIN`):
   ```bash
   npm install
   ```
2. **Configure API URL for your device/environment:**
   Open `app/services/api.ts` and set `DEV_URL` / `API_URL` based on where you are running the app:
   - **Physical Device (Expo Go):** Set to your computer's local network IP address (must be on the same Wi-Fi network):
     ```typescript
     const DEV_URL = 'http://<YOUR_LOCAL_IP>:3000/api';
     ```
   - **Android Emulator:** Use Android's localhost alias:
     ```typescript
     const DEV_URL = 'http://10.0.2.2:3000/api';
     ```
   - **iOS Simulator:**
     ```typescript
     const DEV_URL = 'http://localhost:3000/api';
     ```
3. Start Expo:
   ```bash
   npx expo start
   ```
4. Run the app:
   - **On Android/iOS Device:** Scan the QR code using the Expo Go app (Android) or the default Camera app (iOS).
   - **On Android Emulator:** Press `a` in the terminal.
   - **On iOS Simulator:** Press `i` in the terminal.
   - **On Web (Preview):** Press `w` in the terminal.
5. Log in using the **Mechanic credentials** created from the Web Portal.

---

## Troubleshooting

- **Mobile App Cannot Connect to Backend / Network Error:**
  - Ensure your phone and development computer are on the same Wi-Fi network.
  - Verify that `DEV_URL` in `app/services/api.ts` uses your computer's actual local IPv4 address (e.g., `http://192.168.x.x:3000/api` or `http://10.x.x.x:3000/api`) rather than `localhost`.
  - Ensure your firewall permits incoming connections on port `3000`.
- **Uploaded Images Not Displaying in Portal:**
  - Verify the backend is running; uploaded files are served statically from `http://localhost:3000/uploads`.
- **Database Reset:**
  - The SQLite database is located at `backend/database.sqlite`. If you need to re-initialize tables and seed data, you can delete `backend/database.sqlite` and restart the backend server.

