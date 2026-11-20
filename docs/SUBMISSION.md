# Ẹ̀rí: submission write-up

**Hackathon:** Every Vote, Every Voice (KTech Fest 3.0) · **Team:** TEAM-6 (use the exact name you were assigned)

| | |
|---|---|
| Live demo | https://eri-hackathon.netlify.app |
| Source code | https://github.com/ktechfest2/TEAM-6-3.0 |
| Demo video (max 3 min) | *paste the link here once uploaded* |
| Problem brief | [docs/PROBLEM-BRIEF.md](PROBLEM-BRIEF.md) |
| System sketch | [docs/system-sketch.png](system-sketch.png) (source: [system-sketch.svg](system-sketch.svg)) |

## 1. The problem

A Nigerian result is written on the EC8A sheet at the polling unit, then read out and added again at the ward, LGA and state
before it is declared. Between the sheet on the wall and the final announcement, nobody outside the collation room can check
that the numbers still match, and rumours about "changed" results travel faster than proof. We chose that one link: **what happens
to a result after it leaves the polling unit.** See the [problem brief](PROBLEM-BRIEF.md).

## 2. The solution

Ẹ̀rí (Yorùbá: *witness, proof*) lets citizens, party agents and observers submit the EC8A they saw and checks every later hop
against it.

- **Witnesses** submit by photo, SMS on a basic phone (`R 017 A159 B121 C44 D33 #F4B`), WhatsApp, or a web form. A practice mode
  shows what status they would get without recording anything.
- **Proof Tree:** reconciles polling unit → ward → LGA → state. Each hop is *Traced*, *Partly proven*, *Contested* or *Flagged*.
  Observers see each witness's own entry (phone masked) behind the agreed figure.
- **Live Ear:** a collation officer's spoken read-out (live mic, uploaded audio or a recording) becomes figures per ward or polling
  unit and is compared with the witnessed numbers in real time.
- **Witness Alarm:** when a hop changes, each affected witness gets an SMS (and an optional voice call) in English, Pidgin, Hausa,
  Yorùbá or Igbo. A USSD check (`*347*PU#`) gives the evidence on a feature phone.
- **Public Trust Desk and Results trail:** anyone can trace a polling unit by its code, test a forwarded result image against
  the witness evidence, and send a private incident report. Always labelled unofficial.
- **Tribunal evidence pack:** a PDF per polling unit or ward.
- **Admin:** users and roles, parties, wards and polling units, audit log.

## 3. How AI is used

| Where | What the AI does | Provider (optional, configured by key) |
|---|---|---|
| EC8A photo reading (`src/lib/providers/vision.ts`) | Reads handwritten party figures from a photo of a result sheet | Anthropic Claude vision, or OpenAI (default `gpt-4o`) |
| Figure extraction (`src/lib/extract.ts`) | Pulls structured figures out of a spoken or typed announcement, including Pidgin, Hausa, Yorùbá, Igbo | Anthropic Claude, or OpenAI; a rule-based parser is the fallback |
| Speech to text (`src/lib/providers/stt.ts`) | Transcribes collation audio | OpenAI Whisper (`whisper-1`); the free browser speech API is the no-key option |
| Fake-result checker (`/api/check-image`) | Compares a forwarded image's figures with witness evidence | Same vision provider |

The reconciliation itself (the Proof Tree and the flags) is **not AI**. It is deterministic arithmetic with unit tests, so every flag can
be explained and audited. AI only turns photos and audio into numbers; people and arithmetic decide the status.

Everything also runs **offline on bundled sample sheets and recordings**, so a demo never depends on a network or a key. The
live-key code paths are implemented but have not been exercised against live keys; the offline paths are what is tested (see the
README caveats).

### AI coding assistants (declaration, rule 1.4)

This project was built with the help of an AI coding assistant, **Anthropic's Claude (via Claude Code)**. It was used to write and
refactor code, tests and documentation, and to review and test the running app. The team set the problem, the scope and the design,
directed the work, ran the app, and reviewed and committed the changes. Earlier commits carried a `Co-Authored-By` trailer for the
assistant; the trailers were later removed from the history, and this declaration replaces them.

## 4. Tools, libraries and data (credits, rule 1.2)

**Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, PostgreSQL (`pg`), `sharp` (image handling), `pdfkit` (evidence PDF), `tsx`,
ESLint, Node's built-in test runner. Hosted on **Netlify** with a **Supabase** Postgres database; local development with Docker Compose.

**APIs and models (optional):** Anthropic API (`@anthropic-ai/sdk`), OpenAI API (vision, `gpt-4o`; Whisper, `whisper-1`),
Africa's Talking (SMS/USSD webhook format; real gateway not connected), the browser Web Speech API.

**Data:** geography and party names are real (FCT, Abuja Municipal Area Council, wards City Centre, Garki, Wuse and Gwarinpa;
INEC-registered parties APC, LP, NNPP, PDP, and NDC added through the admin screen). **Every vote figure is fictional sample data.**
Polling-unit codes 001 to 040 are this app's own references, not INEC's. Sample result-sheet images and collation audio were generated
for the prototype (audio with macOS `say`).

**Prior art and references:** INEC's IReV portal, E Don Kast, INEC's *Regulations and Guidelines for the Conduct of Elections*
(form names and the collation chain), and TechCabal's article *The citizen-led platform trying to make Nigeria's vote collation transparent*.

## 5. What is real and what is not

**Built and tested:** reconciliation and flags, SMS/USSD/WhatsApp channels (simulated gateways), five-language alerts, Live Ear
(browser mic and recorded clips), public Trust Desk, results trail, tribunal PDF, accounts and roles, admin tools, 50 unit tests, CI.

**Not yet:** a real SMS/voice gateway, real INEC data feeds, national-level collation (EC8D(A), EC8E), MFA and email password reset, and
native-speaker review of the Hausa, Yorùbá, Igbo and Pidgin wording (drafts). The next steps are on the system sketch.

## 6. Impact in the Nigerian context

- Fits real conditions: works on 2G with a short SMS, needs no app and no data, speaks five languages.
- Works with the people already there (polling agents, observers, community leaders) instead of asking INEC to change anything.
- Builds evidence continuously, so a dispute starts with a timeline and signed figures rather than recollection.
- Coverage scales by polling unit: each new witness strengthens one hop, and there are roughly 176,000 polling units.

## 7. Google Form answers (copy and paste)

The form has five fields, all required.

| Field | Answer |
|---|---|
| Email | the email of the person submitting |
| Team name as assigned on github | the exact team name you were assigned (the repo is `ktechfest2/TEAM-6-3.0`) |
| One-page problem brief (a link is fine) | https://github.com/ktechfest2/TEAM-6-3.0/blob/main/docs/PROBLEM-BRIEF.md |
| Link to Demo | Live: https://eri-hackathon.netlify.app · Video: *paste the video link* · Code: https://github.com/ktechfest2/TEAM-6-3.0 |
| Was AI used in building this project | **Yes** (Anthropic's Claude via Claude Code for code, tests and docs; AI models in the product for reading photos and audio; see section 3) |
