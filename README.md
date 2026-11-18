# Ẹ̀rí — Trace every vote from the wall to the winner

Entry for the **"Every Vote, Every Voice"** hackathon. Ẹ̀rí (Yorùbá: *witness / proof*) watches the collation hops
**between** the polling-unit wall (EC8A) and the final announcement — ward (EC8B), LGA (EC8C), state (EC8D) — and alerts the
witnesses when their numbers change. It complements IReV (INEC) and E Don Kast (polling-unit crowdsourcing); it does not replace them.

> All data is **synthetic**: a made-up *Eriwa LGA* in *Demo State*, 4 wards, 40 polling units, neutral party codes A–D. Strictly non-partisan.

## Run it

```bash
brew services start postgresql@18      # or any Postgres; default URL is postgres://localhost:5432/eri
createdb eri
npm install
npm run seed                           # schema + 40 PUs + 164 witness submissions + demo EC8A images + demo audio (macOS `say`)
npm run dev -- -p 3100                 # http://localhost:3100
```

### Or run it in Docker (Postgres + app, no local Postgres needed)

```bash
docker compose up -d --build          # http://localhost:3100  (DB is also on 127.0.0.1:5433)
docker compose down -v                # stop and wipe data
```

The first start seeds the demo data automatically (`docker-entrypoint.sh`); it keeps the shipped demo PNG/WAV files
(`SEED_KEEP_ASSETS=1`) because macOS `say` isn't available in the container. Optional provider keys are read from `.env.local`.

`npm run seed` is also the full reset. During a rehearsal, **Phones → ↺ Reset demo** rewinds only the live changes.
Demo cheat-sheet (phones, SMS strings, key figures) is written to `DEMO-DATA.md` by the seed.

## What is built (maps to the 48-hour scope)

| Plan item | Status | Where |
|---|---|---|
| Proof Tree + hop reconciliation | **Built** | `src/lib/reconcile.ts`, `/dashboard` |
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
- **PU wall** = consensus of witness submissions (biggest agreeing group). Disagreeing witnesses mark the PU *contested*.
- **Ward** is checked against the sum of its witnessed walls. A gap is *flagged* if a party is short, or if the surplus is larger
  than the total registered voters of the **unwitnessed** PUs (the only place the votes could legitimately come from); otherwise it is *partly proven*.
- **LGA** must equal the sum of its announced wards; **state** the sum of its LGAs.
- A PU line read out at ward collation that differs from the wall, or is dropped, is flagged and its witnesses are alerted.
- Alerts are de-duplicated by fingerprint; each witness gets one SMS (plus a voice call if they sent `VOICE ON`).

### SMS format
`R 012 A120 B85 C40 #7F3` → result for PU 012. `#7F3` is a 3-hex checksum; a garbled message is rejected with the corrected text.
Other commands: `LANG YO` (EN, PCM, HA, YO, IG), `VOICE ON|OFF`. USSD: `*347*PU#`.

## Accounts, roles and access

| Role | How you get it | Can open |
|---|---|---|
| Public | no account | `/` (**Trust Desk**: trace a result, check an image, send a private incident report), `/login`, `/register`, `/api/public/pu/<code>` |
| **Witness** | self-register, then confirm your phone with an SMS code | `/witness` — submit your wall (figures or photo), see your walls' status, your alerts, language/voice prefs |
| **Observer** | created by an admin | `/dashboard` (Proof Tree), `/ear` (Live Ear), tribunal evidence PDFs |
| **Admin** | created by an admin | everything above + `/admin` (users, roles, audit log, reset) and `/phone` (simulators) |

How it is enforced
- Email + password; passwords hashed with **scrypt**; sessions are **signed, httpOnly, SameSite=Lax cookies** (8 h). The user is re-read from the DB on every request, so disabling an account or changing a role takes effect immediately.
- `src/proxy.ts` redirects signed-out / wrong-role visitors; every page layout (`requirePage`) and **every API route (`guard(...)`)** re-checks the role. State-changing requests from another site are refused (Origin check).
- Login lockout (6 failures per email / 30 per IP per 15 min), sign-up and public-lookup rate limits (in-memory, per process).
- A witness only ever acts as **themselves**: result submissions use the phone on the verified account, never a client-supplied number. Unverified phones see no messages and cannot submit (stops someone registering with a stranger's number).
- `/api/sms` and `/api/ussd` webhooks need `WEBHOOK_SECRET` (header `x-webhook-secret` or `?key=`); without it only a signed-in admin (the simulator) can call them.
- Demo sign-ins (password `eri-demo-2026`, override with `SEED_PASSWORD`): `admin@eri.demo`, `observer@eri.demo`, `amaka@eri.demo`, `tunde@eri.demo`. The one-click buttons on `/login` show only while `DEMO_LOGINS=1`.

Not done (out of 48 h): password reset by email, MFA, a shared rate-limit store (limits reset on restart and aren't shared across instances), session revocation lists (disable the account instead), CSRF tokens beyond SameSite+Origin.

## Real providers (all optional — simulators work offline)

Copy `.env.example` → `.env.local`.

| Capability | Env | Without it |
|---|---|---|
| EC8A handwriting + multilingual figure extraction | `ANTHROPIC_API_KEY` | vision: demo sheets only (hash lookup); extraction: rule-based English/digits |
| Speech-to-text (en/pcm/ha/yo/ig) | `OPENAI_API_KEY` | demo clips only (hash lookup) |
| Real SMS | `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID` (Africa's Talking) | messages shown on `/phone` |

Point the Africa's Talking SMS and USSD callbacks at `/api/sms` and `/api/ussd` — they already accept its field names.

## 3-minute demo script

0. Before you start: sign in as **admin** (one-click on `/login`) — the simulators and reset live there; use a second window as **observer** for the Proof Tree.
1. **0:00 – 0:25** `/` → **Trust Desk**: try PU `034`, then check `pu034-edited.png`. The result trail explains the evidence in plain language; the image check says it does not match five witnesses. Show **Raise a concern**: reports are private and labelled unverified rather than becoming a rumour feed.
2. **0:25 – 1:00** Party-agent phone: build & send the SMS for PU 017 (see `DEMO-DATA.md`); WhatsApp-submit `pu017-live.png` / `pu029-live.png`. Sign in as the observer, open `/dashboard` and watch the Proof Tree fill.
3. **1:00 – 1:50** `/ear` → play **Ward 04 collation**. PU 034 flags, then Ward 04 flashes red: *"announced A 3,120 … posted 1,880 … +1,240 unexplained."*
4. **1:50 – 2:20** `/phone` → Amaka's phone buzzes (Igbo). Dial `*347*034#` → ALERT with the proof. (Switch to Tunde for the Yorùbá SMS + voice call.)
5. **2:20 – 3:00** `/ear` → play **LGA collation**; on `/` click the Eriwa LGA number → trace through the wards to **38 of 40 walls**. Close on scale: 176k polling units, 2027. In the PU panel click **Tribunal evidence pack**.
   Bonus: *Check* `pu034-edited.png` in the WhatsApp phone → "does not match 5 witnesses… appears edited".

## Honest caveats
- Hausa / Yorùbá / Igbo / Pidgin strings are **drafts** and need native-speaker review before any real use.
- The Claude-vision, Whisper and Africa's Talking code paths are written but have **not been exercised against live keys**; the simulators are what is tested.
- Demo audio is macOS `say`; the live-mic path records 7-second chunks and relies on the STT provider.
- Real deployment still needs a shared rate-limit store, email-based password reset and MFA (see *Accounts*).

## Credits
IReV (INEC) · E Don Kast · TechCabal: *The citizen-led platform trying to make Nigeria's vote collation transparent*.
