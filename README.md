# Meeting Room Management System

A lightweight Node.js web app for managing meeting rooms and reservations.

## Features
- Create and list rooms with capacity and amenities.
- Create, list, and cancel bookings.
- Prevent double-booking for the same room/time range.
- Capacity validation for bookings.
- Dashboard metrics for room and booking utilization.

## Run locally
```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

## API endpoints
- `GET /api/rooms`
- `POST /api/rooms`
- `DELETE /api/rooms/:id`
- `GET /api/bookings?date=YYYY-MM-DD`
- `POST /api/bookings`
- `DELETE /api/bookings/:id`
- `GET /api/dashboard`
- `GET /api/health`
