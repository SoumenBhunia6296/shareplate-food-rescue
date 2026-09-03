# SharePlate - NGO & Waste Food Management

A full-stack prototype with a React.js frontend and a Node.js/Express backend for collecting surplus-food donations and coordinating food rescue.

## Implemented modules

- Dashboard and community impact metrics
- Food-donor surplus listing with priority and best-before time
- Pickup scheduling and recipient matching
- FEFO-style inventory view
- Recipient registration and requirements
- Volunteer registration, role, availability and hours
- Live impact and distribution-readiness reports
- Persistent local JSON data store and REST API

## Run

1. Create a file named `.env` beside `package.json`, using `.env.example` as the template.
2. Set `MONGODB_URI` to your MongoDB Atlas connection string or a local MongoDB URI, and set a strong `JWT_SECRET`.

```powershell
npm install
npm run build
npm start
```

Open http://127.0.0.1:5000.

For development with live React refresh, run `npm run dev`. For the production-style Node server, build first with `npm run build`, then run `npm start`.

The Express API stores users, donations, recipients, and volunteers in MongoDB. A donation is sent to the API and instantly updates the React dashboard, inventory, pickup board, and reports.

## Accounts and roles

Users can create an account as a food donor, NGO coordinator, recipient organisation, or volunteer. After sign-in, the navigation is restricted to the appropriate role workspace. Passwords are hashed with bcrypt, and API access uses time-limited JWT tokens.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/data` | Get all operational data |
| GET | `/api/dashboard` | Get dashboard metrics |
| POST | `/api/donations` | Create a food donation |
| PATCH | `/api/donations/:id` | Schedule pickup or assign recipient |
| DELETE | `/api/donations/:id` | Remove a donation |
| POST / DELETE | `/api/recipients` | Manage recipient organisations |
| POST / DELETE | `/api/volunteers` | Manage volunteers |

## Next production steps

Authentication and role-based access, a database (MongoDB/MySQL), automated expiration alerts, map routing, email/SMS notifications, and file uploads are the remaining infrastructure pieces needed for a deployed multi-user system.
