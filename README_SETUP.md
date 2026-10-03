# VIN Inspector System Setup

This project now contains three components:
1.  **Mobile App** (`/app`)
2.  **Web Portal** (`/portal`)
3.  **Backend Server** (`/backend`)

## 1. Start the Backend
The backend handles authentication and data storage (SQLite).

1.  Open a terminal.
2.  Navigate to `backend`: `cd backend`
3.  Install dependencies (if not done): `npm install`
4.  Start the server: `node server.js`
    *   Server runs on `http://localhost:3000`
    *   **Default Super Admin**: Username: `admin`, Password: `admin123`

## 2. Start the Web Portal
The portal allows Super Admins and Tenants to manage the system.

1.  Open a new terminal.
2.  Navigate to `portal`: `cd portal`
3.  Install dependencies: `npm install`
4.  Start development server: `npm run dev`
5.  Open browser at `http://localhost:5173`
6.  Login with `admin` / `admin123`.

## 3. Run the Mobile App
The mobile app is for Mechanics to capture data.

1.  Open a new terminal.
2.  Run Expo: `npx expo start`
3.  **Login Flow**:
    *   You must first create a **Tenant** and a **Mechanic** via the Web Portal.
    *   Log in to the Web Portal as `admin`. Create a Tenant.
    *   Log out and log in as the new Tenant. Create a Mechanic.
    *   Use the Mechanic credentials to log in to the Mobile App.

## Troubleshooting
*   **Images not showing?** Ensure the backend is running. The portal loads images from `http://localhost:3000/uploads`.
*   **Mobile App Login Failed?** Ensure your device/emulator can reach the backend.
    *   Android Emulator uses `10.0.2.2` to reach localhost.
    *   Physical devices need your PC's IP address in `app/services/api.ts` instead of `localhost`.
