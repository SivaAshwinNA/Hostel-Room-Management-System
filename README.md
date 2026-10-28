# Hostel Room Management System

This package restores the project without the student room-change request feature.
It keeps the existing admin room management, AC/Non-AC facility, student registration,
admin allocation by registration number, vacating, and student allocation dashboard.

## Structure
- frontend/: React + Vite app
- backend/: Express + MongoDB API

## Setup
1. Install Node.js.
2. Open a terminal in `backend` and run `npm install`.
3. Copy `.env.example` to `.env` and fill in the MongoDB URI, JWT secret, and port as documented there.
4. Start backend using the script in `backend/package.json`.
5. In another terminal, go to `frontend`, run `npm install`, then `npm run dev`.
6. Use the frontend URL shown by Vite.

No room-change request model or routes are included.
