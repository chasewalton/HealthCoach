# HealthCoach

HealthCoach is a patient-facing web app that helps people understand their last clinic visit and prepare for their next appointment.

The app now runs on:
- `frontend/`: Vite + vanilla JS
- `functions/`: Firebase Cloud Functions v2 + Express
- Firebase Auth: email/password
- Firestore: users, profiles, records, sessions, admin config

## Prerequisites

- Node.js 22+ recommended
- Firebase CLI
- Access to the `healthcoach-bidmc` Firebase project

## Frontend setup

Copy the frontend env example and fill in the Firebase web config from the Firebase console:

```bash
cp frontend/.env.example frontend/.env.local
```

Set `BACKEND_URL` to the deployed Hosting origin for local Vite development:

```bash
BACKEND_URL=https://healthcoach-bidmc.web.app
```

## Backend secrets

Set Cloud Functions secrets in Firebase Secret Manager:

```bash
firebase functions:secrets:set OPENROUTER_API_KEY
firebase functions:secrets:set ADMIN_PASSWORD
```

## Development

Install dependencies:

```bash
npm install
cd frontend && npm install && cd ..
cd functions && npm install && cd ..
```

Run the frontend locally against the live Firebase backend:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Firebase Auth must allow `localhost` as an authorized domain for local sign-in.

## Build

Build both the Cloud Functions bundle and the frontend:

```bash
npm run build
```

Or build them separately:

```bash
npm run build:functions
npm run build:frontend
```

## Deploy

Deploy Hosting, Functions, Firestore rules, and indexes together:

```bash
firebase deploy
```

## Firestore shape

- `users/{uid}`: `email`, `username`, `displayName`, `createdAt`
- `profiles/{uid}`: patient profile fields
- `usernames/{username}`: reserved username -> uid mapping
- `records/{autoId}`: uploaded SOAP note history
- `sessions/{id}`: saved conversations
- `admin/prompts`: prompt overrides
- `admin/defaultNote`: demo SOAP note

## Notes

- Email is the only login credential.
- Username is still a first-class app identifier and is reserved transactionally in Firestore.
- The default demo note and prompt overrides are lazily seeded into Firestore from the checked-in seed constants in `functions/src/lib/seeds.ts`.
- Data Connect example artifacts in `dataconnect/` are unchanged and not part of the live app path.
