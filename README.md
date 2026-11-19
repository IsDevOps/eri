# Ẹ̀rí — Trace every vote from the polling unit to the declaration

Entry for the **"Every Vote, Every Voice"** hackathon. Ẹ̀rí (Yorùbá: *witness / proof*) watches the collation hops
**between** the polling-unit result sheet (Form EC8A) and the final declaration (EC8E) — ward (EC8B), LGA (EC8C), state (EC8D) — and alerts the
witnesses when their numbers change. It complements IReV (INEC) and E Don Kast (polling-unit crowdsourcing); it does not replace them.

> All data is **synthetic**: a fictional *Eriwa LGA* in *Ayelu State*, 4 wards, 40 polling units, neutral party codes A–D. Strictly non-partisan.

## Run it

```bash
brew services start postgresql@18      # or any Postgres; default URL is postgres://localhost:5432/eri
createdb eri
npm install
npm run seed                           # schema + 40 PUs + 164 witness submissions + sample EC8A images + collation recordings (macOS `say`)
npm run dev -- -p 3100                 # http://localhost:3100
```

### Or run it in Docker (Postgres + app, no local Postgres needed)

```bash
docker compose up -d --build          # http://localhost:3100  (DB is also on 127.0.0.1:5433)
docker compose down -v                # stop and wipe data
```

The first start seeds the sample election automatically (`docker-entrypoint.sh`); it keeps the shipped sample PNG/WAV files
(`SEED_KEEP_ASSETS=1`) because macOS `say` isn't available in the container. Optional provider keys are read from `.env.local`.

`npm run seed` is also the full reset. During a rehearsal, **Field channels → ↺ Clear live activity** (or Admin) rewinds only the live changes.
Presenter notes (sign-ins, phones, SMS strings, key figures) are written to `PRESENTER-NOTES.md` by the seed.

## What is built (maps to the 48-hour scope)

| Plan item | Status | Where |
|---|---|---|
| Proof Tree + hop reconciliation | **Built** | `src/lib/reconcile.ts`, `/dashboard` |
| Public results trail (digital view of each announced hop, unofficial) | **Built** | `/results`, `src/lib/public-trail.ts` |
| Live Ear (audio → figures → flag) | **Built** | `/ear`, `src/lib/extract.ts`, `src/lib/providers/stt.ts` |
| Witness Alarm via SMS (5 languages) | **Built** | `src/lib/services.ts` (`syncAlarms`), `src/lib/i18n.ts` |
| USSD check + SMS result submission | **Built** | `/api/ussd`, `/api/sms`, `src/lib/sms-codec.ts` |
| AI reading of EC8A photos (feeds the tree) | **Built** | `/api/photo`, `src/lib/providers/vision.ts` |
| Fake-result checker | **Built** (stretch) | `/api/check-image` |
| Public Trust Desk: result trail, image check, private incident intake | **Built** | `/`, `src/components/PublicTrustDesk.tsx`, `/api/incidents` |
| Tribunal evidence pack (PDF) | **Built** (stretch) | `/api/tribunal?pu=034` or `?ward=4`, button in the detail panel |
| Local-language voice calls | **Partly** (stretch) | voice alert queued + spoken in browser sim; no real voice gateway yet |
| IReV / E Don Kast feeds, observer partnerships, offline P2P | Roadmap slide only | — |

### How the reconciliation works
- **Polling-unit result (EC8A)** = consensus of witness submissions (biggest agreeing group). Disagreeing witnesses mark the PU *contested*.
- **Ward** is checked against the sum of its witnessed polling-unit EC8A results. A gap is *flagged* if a party is short, or if the surplus is larger
  than the total registered voters of the **unwitnessed** PUs (the only place the votes could legitimately come from); otherwise it is *partly proven*.
- **LGA** must equal the sum of its announced wards; **state** the sum of its LGAs.
- A PU line read out at ward collation that differs from the EC8A, or is dropped, is flagged and its witnesses are alerted.
- Alerts are de-duplicated by fingerprint; each witness gets one SMS (plus a voice call if they sent `VOICE ON`).

### Public results trail (`/results`)
Citizens don't have to wait for the final announcement to see what was read out. Every announced ward, LGA and state figure
appears as soon as it is recorded, next to what it was checked against and whether it traces to the witnessed EC8A results.
By design it is **not a result**: a fixed "Unofficial, INEC declares the official result" banner, no ranking or "leading" labels,
no extrapolation from partial witness coverage, and no polling-unit rows, phones or photos (per-PU lookup stays separate and rate-limited).

### SMS format
`R 012 A120 B85 C40 #7F3` → result for PU 012. `#7F3` is a 3-hex checksum; a garbled message is rejected with the corrected text.
Other commands: `LANG YO` (EN, PCM, HA, YO, IG), `VOICE ON|OFF`. USSD: `*347*PU#`.

## Terms (INEC vocabulary)

The product uses INEC's own names. The collation chain follows the *Regulations and Guidelines for the Conduct of Elections*
(checked against the published text; confirm against the current edition before any real deployment).

| Level | Form | Completed / announced by | In Ẹ̀rí |
|---|---|---|---|
| Polling Unit (PU) | **EC8A** — polling-unit result sheet (a public copy is pasted as the **EC60(E)** Publication of Result Poster) | Presiding Officer | what a witness submits by SMS, photo or form |
| Registration Area (Ward) | **EC8B** | Registration Area (Ward) Collation Officer | ward row in the Proof Tree / results trail |
| Local Government Area (LGA) | **EC8C** | Local Government Area Collation Officer | LGA row |
| State | **EC8D** | State Collation Officer | state row (top of the tree) |
| National | EC8D(A) then **EC8E** — Declaration and Return | Presidential Collation Officer, then the Returning Officer (the INEC Chairman for the presidential election) | **not modelled yet** (roadmap) |

Other terms: **polling agent** (a party's agent at a polling unit or collation centre), **witness** (Ẹ̀rí's word for a citizen who
submits the EC8A they saw), **collation** (summing results upward), **Returning Officer** (declares the result), **IReV** (INEC Result Viewing Portal).
The app models the presidential-style chain with one election; other election types use the EC8A(I)/(II) … EC8E(I)/(II) variants.
Hausa / Yorùbá / Igbo / Pidgin message wording is still a draft (see caveats); the form code **EC8A** is used inside those messages so it stays unambiguous.

## Architecture

```
 SMS / USSD / WhatsApp / web ──►  src/app/api/*  (thin route handlers, each wrapped in guard(...))
 photos, audio                          │
                                        ▼
                           src/lib/services.ts   submissions, alarms, collation entries, audit
                           src/lib/reconcile.ts  pure hop-by-hop reconciliation  ──► Proof Tree
                           src/lib/extract.ts    transcript ──► figures (rules, or Claude if keyed)
                           src/lib/sms-codec.ts  `R 012 A120 B85 #7F3` encode / parse / checksum
                                        │
              src/lib/providers/  sms · stt · vision   (sample/offline fallback by default, real API when a key is set)
                                        │
                                   PostgreSQL  (src/lib/schema.ts, plain SQL via src/lib/db.ts)
```

| Folder | What lives there |
|---|---|
| `src/app/` | Pages by role: `/` public, `/witness`, `/dashboard`, `/ear`, `/admin`, `/phone` (field channels: SMS, USSD, WhatsApp), `/login`, `/register` |
| `src/app/api/` | HTTP endpoints; auth + role check first, then a call into `src/lib` |
| `src/lib/` | All business logic. `reconcile.ts`, `sms-codec.ts`, `numbers.ts`, `extract.ts` are pure and unit-tested |
| `src/lib/providers/` | One file per external capability, each with an offline fallback and a real implementation behind the same function |
| `src/components/` | Shared UI: Nav, TreeView, AuthForm, PuCheck |
| `src/proxy.ts` | Optimistic redirect for signed-out / wrong-role visitors (Next.js 16 renamed Middleware to Proxy) |
| `scripts/` | `seed.ts` (schema + sample election + sample assets), `ensure-seed.ts` (Docker first-run check) |
| `tests/` | Unit tests (`node:test`) |

Design choices worth knowing: reconciliation is a pure function of rows (`buildTreeFromRows`), so the Proof Tree is
testable without a database; every external dependency is behind an interface with an offline fallback, so a walkthrough
never depends on network or keys.

## Tests and checks

```bash
npm test             # unit tests: reconciliation, SMS checksum, number parsing, extractor, sessions/passwords
npm run lint
npm run typecheck
npm run build
```

The same four run in GitHub Actions (`.github/workflows/ci.yml`). Tests need no database or API keys.

## Deploy (Netlify + hosted Postgres)

The app needs a Postgres database; Netlify only hosts the web app. A "This page couldn't load / server error" right after deploying
almost always means the database is not configured. Open **`/api/health`** on the deployed site: it states what is missing.

1. **Create a Postgres database** (Neon, Supabase, Railway, …) and copy its connection string, with `?sslmode=require`.
   On serverless hosts prefer the provider's *pooled* connection string.
2. **Seed it once from your machine** (this drops and recreates the Ẹ̀rí tables, so point it at the right database):
   ```bash
   DATABASE_URL='postgres://…?sslmode=require' SEED_KEEP_ASSETS=1 npm run seed
   ```
3. **Set environment variables in Netlify** (Site configuration → Environment variables), then redeploy:
   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | the connection string from step 1 |
   | `AUTH_SECRET` | a long random string (`openssl rand -hex 32`). Required: without it, sessions break across serverless instances |
   | `COOKIE_SECURE` | `1` (the site is HTTPS) |
   | `SHOW_SMS_CODES` | `1` to show the SMS verification code on screen while SMS delivery is simulated (set `0` once a real SMS gateway is connected) |
   | `OPENAI_MODEL` | optional; model for photo reading and figure extraction when only `OPENAI_API_KEY` is set (default `gpt-4o`) |
4. Visit `/api/health` → `{"ok":true,…}`, then `/login`.

Serverless limits to know: uploaded photos go to a temp folder that does not persist (set `UPLOAD_DIR` to a persistent disk, or use a host with one), and the in-memory rate limits reset between instances. For a host that runs the app as one long-lived server, use the included `Dockerfile` (Render, Railway, Fly.io) with the same three variables.

## Accounts, roles and access

| Role | How you get it | Can open |
|---|---|---|
| Public | no account | `/` (**Trust Desk**: trace a result, check an image, send a private incident report), `/results` (**public results trail**), `/login`, `/register`, `/api/public/pu/<code>`, `/api/public/trail` |
| **Witness** | choose *Witness* at sign-up, then confirm your phone with an SMS code | `/witness` — submit your polling unit's EC8A result (figures or photo), see the status of your polling units, your alerts, language/voice prefs |
| **Observer** | choose *Observer* at sign-up (email + password; no phone needed) | `/dashboard` (Proof Tree), `/ear` (Live Ear), tribunal evidence PDFs |
| **Admin** | created by an admin | everything above + `/admin` (users, roles, audit log, clear live activity) and `/phone` (field channels: SMS, USSD, WhatsApp) |

How it is enforced
- Email + password; passwords hashed with **scrypt**; sessions are **signed, httpOnly, SameSite=Lax cookies** (8 h). The user is re-read from the DB on every request, so disabling an account or changing a role takes effect immediately.
- `src/proxy.ts` redirects signed-out / wrong-role visitors; every page layout (`requirePage`) and **every API route (`guard(...)`)** re-checks the role. State-changing requests from another site are refused (Origin check).
- Login lockout (6 failures per email / 30 per IP per 15 min), sign-up and public-lookup rate limits (in-memory, per process).
- A witness only ever acts as **themselves**: result submissions use the phone on the verified account, never a client-supplied number. Unverified phones see no messages and cannot submit (stops someone registering with a stranger's number).
- `/api/sms` and `/api/ussd` webhooks need `WEBHOOK_SECRET` (header `x-webhook-secret` or `?key=`); without it only a signed-in admin (the field-channel console) can call them.
- Starter sign-ins from the seed (password `Eri-Trace-2026`, override with `SEED_PASSWORD`): `admin@eri.vote`, `observer@eri.vote`, `amaka@eri.vote`, `tunde@eri.vote`. Change the password and remove the sample accounts before any real use. Anyone can self-register as a witness or observer; **admin accounts can only be created by an admin**.

Not done (out of 48 h): password reset by email, MFA, a shared rate-limit store (limits reset on restart and aren't shared across instances), session revocation lists (disable the account instead), CSRF tokens beyond SameSite+Origin.

## Real providers (all optional — everything works offline on the sample election)

Copy `.env.example` → `.env.local`.

| Capability | Env | Without it |
|---|---|---|
| EC8A handwriting reading + multilingual figure extraction | `OPENAI_API_KEY` **or** `ANTHROPIC_API_KEY` (Anthropic wins if both are set) | the bundled sample sheets only (hash lookup); extraction: rule-based English/digits |
| Speech-to-text (en/pcm/ha/yo/ig) | `OPENAI_API_KEY` (Whisper) | the bundled sample recordings only (hash lookup) |
| Live microphone on `/ear` | none (browser) | **🎙 Listen live (browser, free)** works with no key — see below |
| Real SMS | `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID` (Africa's Talking) | messages shown on `/phone` |

**Live Ear without an OpenAI key.** Claude's API takes no audio, so the Anthropic key can't transcribe. Instead `/ear` can use the browser's own speech recognition (Web Speech API, `src/lib/browser-speech.ts`): no key and no server cost. Limits: Chrome / Edge only (the button is disabled elsewhere), it needs internet and sends the audio to the browser vendor's service, and it recognises English far better than Hausa / Yorùbá / Igbo. Short phrases are buffered into whole announcements (`src/lib/segment.ts`) and sent when the next ward / polling unit / total starts, or after a 4-second pause. With only the rule-based extractor, speak in the form “Ward 4. Party A 3,120. Party B 400.”; with `ANTHROPIC_API_KEY` set, Claude extracts figures from looser speech.

Point the Africa's Talking SMS and USSD callbacks at `/api/sms` and `/api/ussd` — they already accept its field names.

## 3-minute walkthrough

0. Before you start: sign in as **admin** (`admin@eri.vote`) — the field channels and the clear-activity control live there; use a second window as **observer** for the Proof Tree.
1. **0:00 – 0:25** `/` → **Trust Desk**: try PU `034`, then check `pu034-forwarded.png`. The result trail explains the evidence in plain language; the image check says it does not match five witnesses. Show **Raise a concern**: reports are private and labelled unverified rather than becoming a rumour feed.
2. **0:25 – 1:00** Party-agent phone: build & send the SMS for PU 017 (see `PRESENTER-NOTES.md`); WhatsApp-submit `pu017.png` / `pu029.png`. Sign in as the observer, open `/dashboard` and watch the Proof Tree fill.
3. **1:00 – 1:50** `/ear` → play **Ward 04 collation**. PU 034 flags, then Ward 04 flashes red: *"announced A 3,120 … posted 1,880 … +1,240 unexplained."*
4. **1:50 – 2:20** `/phone` → Amaka's phone buzzes (Igbo). Dial `*347*034#` → ALERT with the proof. (Switch to Tunde for the Yorùbá SMS + voice call.)
5. **2:20 – 3:00** `/ear` → play **LGA collation**; on `/` click the Eriwa LGA number → trace through the wards to **38 of 40 polling units**. Close on scale: 176k polling units, 2027. In the PU panel click **Tribunal evidence pack**.
   Bonus: *Check* `pu034-forwarded.png` in the WhatsApp phone → "does not match 5 witnesses… appears edited".

## Honest caveats
- Hausa / Yorùbá / Igbo / Pidgin strings are **drafts** and need native-speaker review before any real use.
- The Claude-vision, Whisper and Africa's Talking code paths are written but have **not been exercised against live keys**; the offline fallbacks are what is tested.
- Sample audio is macOS `say`; the server live-mic path records 7-second chunks and relies on the STT provider. The browser-mic path is tested with a mocked recognizer (no real microphone or speech engine was exercised).
- Real deployment still needs a shared rate-limit store, email-based password reset and MFA (see *Accounts*).

## Credits
IReV (INEC) · E Don Kast · TechCabal: *The citizen-led platform trying to make Nigeria's vote collation transparent*.
