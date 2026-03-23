# HealthCoach — Codex Instructions

## Project Overview
HealthCoach is a patient-facing web app that helps users understand their last clinic visit (SOAP note review) and prepare for their next appointment (structured interview). The frontend is a Vite-powered modular vanilla JS application. The backend is a single Firebase Cloud Function (`functions/src/index.ts`) that serves all `/api/*` routes through Express.

## Architecture
- **Frontend**: `frontend/` — Vite + vanilla JS ES modules. Entry point: `frontend/src/main.js`.
- **Backend**: `functions/src/` — Firebase Cloud Functions v2, one `api` onRequest function with Express routing.
- **Database**: Firestore — `users`, `profiles`, `usernames`, `records`, `sessions`, plus `admin/prompts` and `admin/defaultNote`.
- **AI**: OpenRouter (gpt-5.2 default) via the Node `openai` SDK. Secret from `OPENROUTER_API_KEY`.
- **Auth**: Firebase Auth email/password on the frontend. API requests send Firebase ID tokens as `Authorization: Bearer <token>`.
- **State**: Centralized `state.js` module with pub/sub.
- **Default SOAP note**: Seeded from `functions/src/lib/seeds.ts` into `admin/defaultNote` on first access.

## Tech Stack
- **Frontend**: Vanilla JS (ES2022+), Vite, ES modules, Three.js ambient landing background
- **Backend**: Firebase Cloud Functions v2, Express 4, TypeScript
- **Auth/DB**: Firebase Auth + Firestore
- **AI**: OpenRouter through the `openai` package
- Fonts: **Plus Jakarta Sans** (UI) + **Lora** (hero headings)

## Frontend Architecture

### Directory Structure
```text
frontend/
  index.html
  package.json
  vite.config.js
  .env.example
  src/
    firebase.js           # Firebase app + auth initialization
    main.js               # App bootstrap + auth-state hydration
    state.js              # Centralized state + pub/sub
    router.js             # showScreen()
    api/
      client.js           # fetch wrapper + bearer token injection
      auth.js             # Firebase Auth helpers
      profile.js
      record.js
      chat.js
      sessions.js
      admin.js
    components/
      screens/
      modals/
      chat/
    utils/
    styles/
```

### Component Pattern
Each component exports:
- `render()` — returns HTML string
- `init()` — attaches DOM event listeners
- `setCallbacks(cbs)` — optional cross-component callbacks

All event handlers use `addEventListener`; never inline handlers.

### State Management
`state.js` exports a plain `state` object with `on(key, fn)`, `set(key, value)`, and `emit(key)` for pub/sub.

### API Layer
`api/client.js` provides `apiRequest(method, path, body)` with shared error handling and Firebase ID-token injection. Domain modules wrap route-specific behavior.

## Backend Architecture

### Cloud Functions Layout
```text
functions/src/
  index.ts                # Express app exported as api onRequest
  middleware.ts           # verifyAuth() bearer-token middleware
  routes/
    profile.ts            # GET/PUT /api/profile
    record.ts             # GET/POST/DELETE /api/record
    chat.ts               # POST /api/chat and /api/summary
    sessions.ts           # CRUD /api/sessions
    admin.ts              # POST/PUT /api/admin/prompts
  lib/
    firebaseAdmin.ts
    http.ts
    openrouter.ts
    prompts.ts
    seeds.ts
    users.ts
```

### API Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profile` | Return `{ user, profile }` for the current Firebase user |
| PUT | `/api/profile` | Update profile fields; can claim `username` only if unset |
| GET | `/api/record` | Get newest custom SOAP note or the demo note |
| POST | `/api/record` | Upload a custom note |
| DELETE | `/api/record` | Reset to the demo note |
| POST | `/api/chat` | OpenRouter chat completion |
| POST | `/api/summary` | Generate visit summary |
| GET | `/api/sessions` | List up to 20 recent sessions |
| POST | `/api/sessions` | Create or update a session |
| GET | `/api/sessions/<id>` | Fetch one session |
| DELETE | `/api/sessions/<id>` | Delete one session |
| POST | `/api/admin/prompts` | Fetch merged prompts with admin password |
| PUT | `/api/admin/prompts` | Save prompt overrides with admin password |

## App Screens
1. **Auth** (`#screen-auth`) — sign in with email/password; register with username, display name, language, email, password
2. **Landing** (`#screen-landing`) — dashboard chat + history
3. **Chat** (`#screen-chat`) — SOAP review, prep, or combined flow

## Chat Flows

### Review Mode
4 sections: What Brought You In -> What Was Found -> What It Means -> Your Plan

### Prepare Mode
4 sections: What Matters -> 6-Month Health -> Getting It Right -> Wrap-Up

### Combined Mode
4 sections: Your Last Visit -> What Matters Most -> What's Changed -> Wrap-Up

### Emergency Detection
`processUserInput()` in `ChatScreen.js` must keep the emergency-keyword check at the very top before any API request. Emergency detection remains disabled in review and combined modes.

## Key UI Components
- **Sign out** — landing avatar and chat header button; calls Firebase `signOut()`
- **Note Modal** — paste custom SOAP note or reset to the demo note
- **Summary Modal** — structured visit summary download/email actions
- **History Drawer** — recent conversation list
- **Version Badge** — bottom-right release label

## State Object
```js
state = {
  user: null,                  // { uid, email, username, displayName }
  profile: {},                 // Firestore-backed profile fields
  chatMode: null,              // 'review' | 'prepare' | 'combined'
  chatPath: null,              // 'guided'
  messages: [],
  sessions: [],
  soapSection: 0,
  prepSection: 0,
  isTyping: false,
  patientRecord: null,
  patientRecordIsDefault: true,
  currentSessionId: null,
  lastSummary: null,
}
```

## Development
```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..
cd functions && npm install && cd ..

# Frontend dev against the live Firebase backend
cp frontend/.env.example frontend/.env.local
npm run dev

# Build everything
npm run build
```

`frontend/.env.local` should point `BACKEND_URL` at `https://healthcoach-bidmc.web.app` and include the `VITE_FIREBASE_*` values from the Firebase console.

## Deploy
```bash
firebase functions:secrets:set OPENROUTER_API_KEY
firebase functions:secrets:set ADMIN_PASSWORD
firebase deploy
```

Add `localhost` to Firebase Auth authorized domains for local sign-in.

## Conventions
- Keep frontend route calls relative (`/api/...`) and let Vite/Firebase handle routing.
- Use `var(--token-name)` for colors and spacing; do not hardcode new hex values in components.
- Prefer `display: flex` over `grid` for single-axis layouts.
- All interactive elements must remain keyboard-navigable with 44px minimum tap targets.
- Error copy should stay gentle and non-blaming.
- Username is immutable after first claim and must stay unique via the `usernames` reservation collection.
