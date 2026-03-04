# HealthCoach — Claude Code Instructions

## Project Overview
HealthCoach is a patient-facing web app that helps users understand their last clinic visit (SOAP note review) and prepare for their next appointment (structured interview). The frontend is a single HTML file (`index.html`); the backend is a Flask app (`app.py`) that serves it and all `/api/*` routes.

## Architecture
- **Frontend**: `index.html` — all HTML, CSS, and JavaScript. Async `fetch` calls to `/api/*`.
- **Backend**: `app.py` — Flask app serving `index.html` at `/` and REST endpoints at `/api/*`.
- **Database**: SQLite at `data/healthcoach.db` — 4 tables: `users`, `profiles`, `records`, `sessions`.
- **AI**: OpenAI `gpt-4o` via the `openai` Python SDK. API key from `OPENAI_API_KEY` env var.
- **Auth**: Flask sessions (server-side cookie). Passwords hashed with `bcrypt`.
- **State**: Plain JS `state` object in-browser; persisted to SQLite via API calls.
- **Deployment**: Render Python web service with gunicorn (`render.yaml` at repo root).
- **Default SOAP note**: `data/default_note.json` — used when no user-uploaded note exists.

## Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS (ES2020+)
- **Backend**: Python 3.11, Flask 3, gunicorn
- **AI**: openai SDK (gpt-4o)
- **Auth**: bcrypt, Flask sessions
- **DB**: sqlite3 (stdlib)
- Fonts: **Plus Jakarta Sans** (UI) + **Lora** (hero headings) via Google Fonts
- No npm, no bundler

## Design System

### Colors (CSS custom properties)
```
--teal-500: #0E9F8C   ← primary brand
--teal-600: #0A7A6E   ← hover/active
--teal-700: #0A6259   ← dark accents
--coral-500: #FF6B6B  ← accent / CTAs
--neutral-50: #FAFAF9 ← page background
```

### Typography
- Body: Plus Jakarta Sans, 16px base, 1.6 line-height
- Headings: Lora italic for hero text
- Never exceed 2 font families

### Spacing
- 8px base grid: 4, 8, 12, 16, 24, 32, 48, 64, 96
- Border radii variables: `--radius-sm` (8px) → `--radius-full` (9999px)

## App Screens
1. **Auth** (`#screen-auth`) — sign in / register via `/api/auth/register` and `/api/auth/login`
2. **Landing** (`#screen-landing`) — personalized greeting, two mode CTAs, note card, recent chats
3. **Chat** (`#screen-chat`) — OpenAI-powered SOAP Review or Next Visit Prep

## Chat Flows

### Review Mode (SOAP)
4 sections: Subjective → Objective → Assessment → Plan
- `SOAP_SECTIONS` constant; section pills + progress advance via `updateProgressHeuristic()`
- Each turn calls `POST /api/chat` with full message history + patient record

### Prepare Mode
4 sections: What Matters → 6-Month Health → Getting It Right → Wrap-Up
- `PREP_SECTIONS` constant; same async flow as review mode

### Emergency Detection
`processUserInput()` checks for emergency keywords (chest pain, suicidal, etc.) **before** making any API call — entirely frontend.

## Key Modals & UI Components
- **Profile Modal** (`#modal-profile`) — name, DOB, gender, literacy, AI model preference; saves to `/api/profile`
- **Note Modal** (`#modal-note`) — paste custom SOAP note or reset to demo; saves to `/api/record`
- **Summary Modal** (`#modal-summary`) — structured visit summary; can download as .txt or .json
- **History Drawer** (`#drawer-history`) — slide-in left drawer; sessions fetched from `/api/sessions`
- **Note Card** (landing screen) — shows "Demo Note Active" or "Custom Note Active"

## State Object
```js
state = {
  user: null,                  // { username, displayName }
  profile: {},                 // health profile fields (synced from /api/profile)
  chatMode: null,              // 'review' | 'prepare'
  messages: [],                // { role, content }[]
  sessions: [],                // fetched from /api/sessions
  soapSection: 0,
  prepSection: 0,
  isTyping: false,
  authMode: 'signin',
  patientRecord: null,         // SOAP note object from /api/record
  patientRecordIsDefault: true,
  currentSessionId: null,      // UUID for active chat session
}
```

## API Routes (`app.py`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| GET  | `/api/auth/me` | Current session info |
| GET  | `/api/profile` | Get profile |
| PUT  | `/api/profile` | Update profile |
| GET  | `/api/record` | Get SOAP note (custom or default) |
| POST | `/api/record` | Upload custom note |
| POST | `/api/chat` | OpenAI chat completion |
| GET  | `/api/sessions` | List sessions |
| POST | `/api/sessions` | Save/update session |
| GET  | `/api/sessions/<id>` | Get single session |

## Development
```bash
# Install dependencies
pip install -r requirements.txt

# Run Flask backend (serves index.html + API)
python app.py
# Open http://localhost:5000

# Set env vars for full functionality
export OPENAI_API_KEY=sk-...
export FLASK_SECRET_KEY=your-secret
```

## Deployment (Render)
Configured via `render.yaml`. The site deploys as a **Render Python web service** using gunicorn.
- Service name: `healthcoach-ai-bidmc` → URL: `healthcoach-ai-bidmc.onrender.com`
- Set `OPENAI_API_KEY` manually in Render dashboard (not in `render.yaml`)
- Persistent disk at `/opt/render/project/src/data` (requires paid plan; free tier uses ephemeral storage)

> Note: Render free-tier URLs follow `{service-name}.onrender.com`. Custom domains
> under `render.com` are not supported — only `onrender.com` subdomains or
> externally owned custom domains (e.g. `healthcoach.ai`) configured via Render's
> custom domain settings.

## Conventions
- Keep all code in `index.html` — do not split into separate files unless scope grows significantly
- CSS: organized in labeled sections (`DESIGN TOKENS`, `RESET`, `LAYOUT`, etc.)
- JS: organized in labeled sections (`STATE`, `AUTH`, `SCREENS`, `CHAT`, etc.)
- Use `var(--token-name)` for all colors and spacing — never hardcode hex in component styles
- Prefer `display: flex` over `grid` for single-axis layouts
- All interactive elements must be keyboard-navigable (min 44px touch target)
- Error messages: gentle, non-blaming tone (healthcare UX standard)
- Emergency-keyword check must remain at the top of `processUserInput()`

## Skill
The `.skills/frontend-design/SKILL.md` skill is active for this project. Use it when redesigning or building new UI components.
