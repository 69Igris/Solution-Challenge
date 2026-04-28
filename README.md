# SANKALP — संकल्प

> **India's AI Conductor for Crisis Response.**
> Google Solution Challenge 2026 · Theme: Smart Resource Allocation
> Built by Team **NexusFlow**.

When a disaster hits, response is a chaos of WhatsApp forwards, duplicated rescue trips, and unmatched SOS pleas dying in the noise. SANKALP transforms that chaos into an orchestrated, AI-coordinated response — bridging Indians in distress, India's 10-million-strong volunteer base, and the NGOs and district authorities who command the ground.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | **Next.js 15** (App Router) · **Tailwind CSS** · **Framer Motion** · **Mapbox GL JS** |
| Auth & Realtime | **Firebase Auth** (phone-OTP) + **Firestore** (offline-persistent) |
| Push | **Firebase Cloud Messaging** |
| Serverless | **Cloud Functions for Firebase** |
| Compute | **Cloud Run** (matching engine, OR-Tools) |
| Data | **BigQuery** |
| Geo | **Google Maps Platform** + **Earth Engine** |
| AI | **Vertex AI** — Gemini 1.5 Pro (multimodal parser), Matching Engine, Forecast, Agent Builder, Imagen 3 |

---

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in your Firebase + Mapbox keys
cp .env.local.example .env.local

# 3. Run the dev server
npm run dev
# → http://localhost:3000           (landing / role picker)
# → http://localhost:3000/sos       (citizen SOS — hero screen)
# → http://localhost:3000/missions  (volunteer board — Sprint 2)
# → http://localhost:3000/command   (coordinator dashboard — Sprint 2)
```

---

## Project structure

```
SolutionChallenge/
├── app/
│   ├── layout.tsx                 # Root layout — fonts, metadata, viewport
│   ├── page.tsx                   # Landing / role picker
│   ├── globals.css                # Midnight palette, glass utility, grain
│   │
│   ├── (citizen)/                 # Route group — mobile PWA
│   │   ├── layout.tsx
│   │   ├── sos/page.tsx           # ★ Hero SOS screen
│   │   └── status/                # SOS status / live updates
│   │
│   ├── (volunteer)/               # Route group — mobile PWA
│   │   ├── layout.tsx
│   │   ├── onboarding/            # Skills profile setup
│   │   ├── missions/              # Live mission board
│   │   └── profile/
│   │
│   ├── (dashboard)/               # Route group — desktop coordinator
│   │   ├── layout.tsx
│   │   ├── command/               # Pulse View command center
│   │   └── analytics/
│   │
│   └── api/                       # Server route handlers
│       ├── sos/route.ts           # POST: create SOS, trigger Gemini parse
│       └── match/route.ts         # POST: run matching engine
│
├── components/
│   ├── ui/                        # Reusable primitives (button, card, …)
│   ├── citizen/
│   ├── volunteer/
│   └── dashboard/
│
├── lib/
│   ├── firebase.ts                # Web SDK singleton (offline-persistent)
│   └── utils.ts                   # cn helper, time utilities
│
├── types/
│   └── index.ts                   # Domain types (mirrors Firestore schema)
│
├── firestore/
│   └── schema.json                # NoSQL schema, indexes, security notes
│
├── public/                        # Static assets, PWA manifest
├── tailwind.config.ts             # Midnight palette + brand tokens
├── next.config.mjs
├── tsconfig.json
└── .env.local.example
```

### Why route groups (parentheses)?

`(citizen)`, `(volunteer)`, `(dashboard)` are Next.js **route groups** — they organise the codebase and let each surface own its own layout (mobile shell vs. desktop shell), but they don't appear in the URL. A citizen reaches the SOS page at `/sos`, not `/citizen/sos`.

---

## Firestore data model

See [`firestore/schema.json`](./firestore/schema.json) and the matching TypeScript types in [`types/index.ts`](./types/index.ts).

**Top-level collections:**
- **`users`** — unified profile keyed by Firebase Auth UID. Citizens, volunteers, and coordinators all live here, separated by `role`. Volunteers carry an additional nested `volunteer` map (skills, radius, vehicle, availability).
- **`sos_alerts`** — the heart of the system. Lifecycle: `pending → parsed → matched → in_progress → resolved`. Carries raw inputs (voice/photo/text), Gemini parse output, geolocation + geohash, match state, and verification flags.
- **`missions`** — volunteer-side mirror of an active match. Carries route, ETA, on-site state.
- **`crisis_zones`** — aggregated rollup powering the predictive heatmap.

---

## Running for the demo

For demo day, we seed Firestore with **20 realistic urban-flood SOS scenarios** (Bengaluru) before recording:

```bash
# Seed script lands in Sprint 2
npm run seed:bengaluru-flood
```

The "Definition of Done" loop — judge fires SOS → second judge gets matched ping → third screen updates dashboard, all in ≤8 seconds — is documented in `/docs/demo-script.md` (Sprint 2).

---

## License

Apache 2.0. Built for impact, not profit.
