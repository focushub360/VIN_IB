# Web Portal & Backend Implementation Plan

## Objective
Create a web portal for vehicle inspection management within the current project.

## Structure
*   **`/backend`**: Node.js/Express server (REST API).
*   **`/portal`**: React/Vite web application.
*   **`/app`**: Existing Mobile App (will be updated to connect to backend).

## Backend Features
*   **Auth**: Super Admin, Tenant, Mechanic login.
*   **DB**: SQLite (local file) for Users and Inspections.
*   **Storage**: Local file storage for images.

## Portal Features
*   **Super Admin**: Manage Tenants.
*   **Tenant**: Manage Mechanics, View Inspection Photos.

## Mobile Features
*   **Login**: Mechanic login.
*   **Upload**: Send captured data to server.
