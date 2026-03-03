# HealthCoach — Claude Code Instructions

## Project Overview
HealthCoach is a patient-facing web app that helps users understand their last clinic visit (SOAP note review) and prepare for their next appointment (structured interview). It is a **single-file static HTML app** — no build step, no framework, no backend. Everything lives in `index.html`.

## Architecture
- **Single file**: `index.html` contains all HTML, CSS, and JavaScript.
- **No build tooling**: Open in browser directly or serve with any static file server.
- **No backend**: Auth is mock in-memory, chat responses are scripted flows (not live AI calls yet).
- **State**: Plain JS object (`state`) — not persisted across page reloads.
- **Deployment**: Render static site (`render.yaml` at repo root).

## Tech Stack
- Vanilla HTML/CSS/JS (ES2020+)
- Fonts: **Plus Jakarta Sans** (UI) + **Lora** (hero headings) via Google Fonts
- No npm, no bundler, no dependencies to install

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
1. **Auth** (`#screen-auth`) — sign in / register with mock in-memory user DB
2. **Landing** (`#screen-landing`) — personalized greeting, two mode CTAs, recent chats
3. **Chat** (`#screen-chat`) — SOAP Review or Next Visit Prep flow with scripted responses

## Chat Flows

### Review Mode (SOAP)
4 sections: Subjective → Objective → Assessment → Plan
- `SOAP_SECTIONS` constant, `reviewFlow[]` array, `reviewStep` counter
- Progress bar advances per section (25% → 50% → 75% → 100%)

### Prepare Mode
4 sections: What Matters → 6-Month Health → Getting It Right → Wrap-Up
- `PREP_SECTIONS` constant, `prepFlow[]` array, `prepStep` counter

### Emergency Detection
`processUserInput()` checks for emergency keywords (chest pain, suicidal, etc.) before routing to flow handlers.

## Key Modals & UI Components
- **Profile Modal** (`#modal-profile`) — name, DOB, gender, conditions, medications, AI model preference
- **Summary Modal** (`#modal-summary`) — structured visit summary; can download as .txt or .json
- **History Drawer** (`#drawer-history`) — slide-in left drawer listing past sessions

## State Object
```js
state = {
  user: null,           // { username, displayName }
  profile: {},          // health profile fields
  chatMode: null,       // 'review' | 'prepare'
  messages: [],         // { role, content, chips? }[]
  sessions: [],         // completed sessions (in-memory)
  soapSection: 0,
  prepSection: 0,
  isTyping: false,
  authMode: 'signin',
}
```

## Development
```bash
# Serve locally (any of these work)
open index.html
python3 -m http.server 8080
npx serve .
```

No install step needed.

## Deployment (Render)
Configured via `render.yaml`. The site deploys as a **Render Static Site**.
- Service name: `healthcoach-ai-bidmc` → URL: `healthcoach-ai-bidmc.onrender.com`
- Publish directory: `.` (repo root, serves `index.html`)
- No build command required

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
