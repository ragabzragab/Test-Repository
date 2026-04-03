Test-Repository
===============

A Node.js web application with two main features:

1. **OpenAI API Demo** — interactive UI for the top 10 OpenAI APIs
2. **Contract Management System** — full CRUD contract tracker with dashboard, search, and CSV export

---

## Setup

```bash
npm install
cp .env.example .env   # then add your OPENAI_API_KEY
npm start              # production
npm run dev            # development (auto-restart)
```

Server runs at `http://localhost:3000` (configurable via `PORT` in `.env`).

---

## Contract Management System

Navigate to **`/contracts.html`** after starting the server.

### Features

- **Dashboard** — live stats: total, active, expiring soon, expired, draft count, total value
- **Expiring alerts** — banner highlights contracts expiring within 30 days (orange → red by urgency)
- **Contracts table** — sortable columns, search by title/number/party, filter by status and type
- **Add / Edit contracts** — modal form with full field set and multi-party support
- **Auto-expiry** — active contracts past their end date are automatically marked expired
- **CSV export** — download all visible contracts as a spreadsheet
- **Validation** — both client-side (with inline error messages) and server-side

### Contract Fields

| Field | Description |
|-------|-------------|
| Title | Contract name (required) |
| Contract # | Auto-generated: `CNT-YEAR-###` |
| Type | service, employment, vendor, lease, NDA, partnership, other |
| Status | draft → pending → active → expired / terminated |
| Parties | Multiple parties with name, role, and email |
| Dates | Start date and end date |
| Value | Monetary value + currency (USD, EUR, GBP, CAD, AUD, JPY) |
| Tags | Free-form comma-separated labels |
| Description / Notes | Long-form text fields |
| Renewal Reminder | Days before end date to highlight for renewal |

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/contracts` | List all — supports `?status=`, `?type=`, `?search=` |
| `POST` | `/api/contracts` | Create a contract |
| `GET` | `/api/contracts/stats` | Dashboard statistics |
| `GET` | `/api/contracts/expiring` | Contracts expiring soon (`?days=30`) |
| `GET` | `/api/contracts/:id` | Get a single contract |
| `PUT` | `/api/contracts/:id` | Update a contract |
| `DELETE` | `/api/contracts/:id` | Delete a contract |

### Data Storage

Contracts are stored in `data/contracts.json` (created automatically on first run). This file is excluded from git — the `data/` directory is tracked via `data/.gitkeep`.

---

## OpenAI API Demo

Navigate to **`/`** after starting the server. Supports:

1. Chat Completions
2. Single-turn Responses
3. Vision (image analysis)
4. Image Generation
5. Image Editing
6. Image Variations
7. Speech-to-Text
8. Text-to-Speech
9. Embeddings
10. Moderations

Set your `OPENAI_API_KEY` in `.env` or paste it directly in the browser (stored in `localStorage`).
