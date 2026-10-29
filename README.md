# MoveMate

MoveMate is a responsive React logistics workspace for comparing shipment options,
booking shipments, and tracking their progress. The Vite frontend talks to a local
Node.js API. Prices and transit times are planning estimates, not live carrier rates.

## Run locally

Install Node.js 22.12 or newer, then install dependencies and start both development
servers:

```powershell
npm.cmd install
npm.cmd run dev
```

Open <http://127.0.0.1:5173>. The React development server proxies API requests to
the backend at <http://127.0.0.1:8000>. Use this instead of VS Code Live Server;
Live Server does not compile React or JSX.

To create and serve a production build:

```powershell
npm.cmd run build
npm.cmd start
```

Then open <http://127.0.0.1:8000>. The backend serves the compiled app from `dist/`.
Set `PORT` or `HOST` environment variables to change the backend's default address.
Set `DATABASE_PATH` to use a different SQLite file.

## Features

- Responsive workspace dashboard with shipment activity, status summaries, and a
  shipment-volume chart.
- Quote comparison across road, rail, air, and sea transport.
- Account registration, sign-in, and sign-out.
- Authenticated shipment booking, shipment list, and shipment detail views.
- Public tracking lookup by tracking number.
- Local SQLite persistence for accounts, quotes, shipments, and sessions.

## API

- `GET /api/health` checks server availability.
- `POST /api/quotes` validates shipment details and returns planning estimates.
- `POST /api/register`, `POST /api/login`, `POST /api/logout`, and `GET /api/me`
  provide local account and session handling.
- `GET /api/shipments`, `POST /api/shipments`, and `GET /api/shipments/:id`
  provide authenticated, user-scoped shipment management.
- `GET /api/track/:code` returns public tracking information.

Accounts (including salted password hashes), quotes, booked shipments, and hashed
session tokens are stored in the SQLite database at `data/movemate.sqlite`. Existing
`data/users.json` and `data/shipments.json` files are imported automatically on
startup; the original JSON files are left untouched. The `data/` directory is
excluded from version control.

This is a local-development backend, not a production authentication or live carrier
pricing service. Before deploying publicly, use a managed database and session store,
HTTPS, production-grade authentication protections, and a real shipping-rate provider.
"# move-mate" 
