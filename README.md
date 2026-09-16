# CreateX Leads

Лийдовете от Google Sheet на едно място: списък, детайли, обаждане с един клик, имейл от приложението и коментари на екипа.

## What it does

- **Lead list** read live from the Google Sheet the ads integration writes to. Checks for new leads every 30 seconds (and when the tab regains focus). New leads get a blue dot, a counter in the header and tab title, and an optional browser notification.
- **AI agent calls the lead** as soon as the form is sent, and the lead page then opens with the outcome, how warm they are, a summary, what to do next, the recording and the whole transcript. See below.
- **Call**: `tel:` link, so on a phone it dials directly and on a Mac it hands off to FaceTime/iPhone. After tapping it, a "How did it go?" panel logs the outcome (no answer, call back, interested, booked, lost) plus a note.
- **Email**: compose in the app and send over SMTP from a shared mailbox, or "Open in mail app" when sending isn't configured. Sent emails appear in the lead's history.
- **Comments and status** per lead, with author and time. Old free-text notes already in the sheet are shown as "Бележки от таблицата".
- **Voice notes**: tap the mic in the comment box, record up to 3 minutes, listen back, send. Recordings are stored in a Google Drive folder and play inside the lead's history and the team activity feed.
- **Bottom menu** (side rail on desktop): Лийдове, За обаждане (who to call next, in priority order), Активност (everything the team did, filterable, voice notes included), Профил (notifications, what's switched on, log out).
- Search by name, phone (any format, e.g. `0888 123`) or email; filter by status or unseen.

## Web form, notifications and the AI agent

Speed to lead: someone fills in the form, the team gets an email, and an AI agent
calls them within minutes. What was said, how warm they are and what to do next
land on the lead.

```
/form  ->  POST /api/intake  ->  lead saved (sheet / demo store)
                              ->  Resend email to NOTIFY_EMAIL_TO   (link opens the lead: /?lead=<id>)
                              ->  the call is placed, and noted on the lead right away

Vapi  ->  POST /api/agent/vapi  ->  transcript, recording, summary, qualification,
                                    next steps and the outcome, on the lead
```

The app knows nothing about what you sell. The script, the voice and anything the
agent should do at the end of a call live in Vapi; the app supplies the lead, stores
what came back and shows it. Everything on screen - the summary, the next steps, the
facts - comes from the call itself, so the same setup serves a clinic, a broker, an
insurer or a software vendor.

- **Form**: `/form` is public. Add `?source=harmony` to tag where the lead came from.
  Phone is required and must be callable; consent is required and says the call may be
  an AI assistant and recorded. Bots are filtered with a honeypot field and a per-IP limit.
- **Emails**: set `RESEND_API_KEY` and `NOTIFY_EMAIL_TO`. Without a verified domain in
  Resend, keep `NOTIFY_EMAIL_FROM` on `onboarding@resend.dev`; Resend then only delivers
  to the Resend account owner's address.
- **Failures show up in the app**: if an email or a call fails, a note from "Система"
  is added to that lead's history with the reason. Those notes don't change the status.
- **Sheet mode**: form leads are appended to the leads tab. Columns named `Интерес`,
  `Съобщение`, `Източник` are filled when they exist; otherwise the values go into the
  notes column. Calls are appended to the activity tab, with the transcript and the rest
  as JSON in a `Данни` column the app adds on its own.

`CALL_PROVIDER` decides who calls: `vapi` (this app calls), `webhook` (hand the lead to
an agent you run), `log` (local testing, nothing is dialled) or `off`. Left empty it
keeps the old behaviour, so an existing deployment is unaffected.

### Calling through Vapi

1. **Assistant**: build one in the Vapi dashboard with your script, a Bulgarian voice and
   a transcriber that handles Bulgarian. Copy its ID into `VAPI_ASSISTANT_ID`.
2. **Number**: Vapi hands out US numbers for free; a Bulgarian number gets answered far
   more often. Import one from Twilio (a Bulgarian regulatory bundle is required) or use a
   SIP trunk, then copy the ID into `VAPI_PHONE_NUMBER_ID`.
3. **Server URL**: on the assistant, set it to `https://<your-app>/api/agent/vapi` and set
   the server secret to the same value as `VAPI_WEBHOOK_SECRET`. Vapi sends it back as the
   `x-vapi-secret` header, and a request without it is rejected.
4. **Server messages**: keep `end-of-call-report` switched on - it is the only one the app
   reads. Switch on recording if you want the recording to play inside the app.
5. **Analysis** (optional, in Vapi): anything you configure it to extract shows up on the
   lead as plain label/value rows, exactly as you named the fields.

The prompt in Vapi can use these, filled in per lead:

| Variable | What it holds |
|---|---|
| `{{name}}`, `{{firstName}}` | the lead's name |
| `{{phone}}`, `{{email}}` | how to reach them |
| `{{interest}}`, `{{message}}` | what they picked and typed on the form |
| `{{source}}` | the `?source=` tag on the form |

### Reading the call

With `ANTHROPIC_API_KEY` set, the conversation is read once it ends and turns into a
summary, an outcome (which sets the lead's status), a qualification
(горещ / топъл / студен / неподходящ), next steps, a callback time when one was agreed,
and the facts the person gave. The prompt is told the business is unknown and has to be
inferred, so nothing is assumed about your industry. Without the key the app falls back
to Vapi's own summary and still keeps the transcript and the recording - a call that
happened is never lost, whatever else fails.

### Testing it

Locally, without a phone line or any account:

```bash
DATA_SOURCE=file CALL_PROVIDER=log EMAIL_TRANSPORT=log pnpm dev
curl -X POST localhost:3000/api/intake -H 'content-type: application/json' \
  -d '{"name":"Тест","phone":"0888111222","consent":true,"source":"test"}'
```

The lead gets a "call placed" note and then a full conversation you can open in the app.

Against a real Vapi payload, with the app running and `VAPI_WEBHOOK_SECRET` set:

```bash
# put a real lead id into the fixture first
curl -X POST localhost:3000/api/agent/vapi \
  -H 'content-type: application/json' -H "x-vapi-secret: $VAPI_WEBHOOK_SECRET" \
  -d @fixtures/vapi-end-of-call.json
```

Sending it twice is safe: a call is recorded once, by its call id.

### Bringing your own agent

`CALL_PROVIDER=webhook` keeps the original contract. Every form lead is sent to
`AGENT_WEBHOOK_URL`:

```http
POST <AGENT_WEBHOOK_URL>
Authorization: Bearer <AGENT_WEBHOOK_SECRET>
Content-Type: application/json

{
  "event": "lead.created",
  "lead": {
    "id": "l_8gu0og",
    "name": "Мария Тестова",
    "phone": "+359888111222",
    "email": null,
    "interest": "",
    "message": "Искам оферта за 10 работни места",
    "source": "harmony",
    "consent": true,
    "createdAt": "2026-09-16T13:55:51.730Z"
  },
  "callbackUrl": "https://createx-leads.vercel.app/api/agent/calls"
}
```

Reply with any 2xx within 10 seconds and start the call asynchronously. Phones are always E.164.

The result comes back to `/api/agent/calls`:

```http
POST /api/agent/calls
Authorization: Bearer <AGENT_API_KEY>
Content-Type: application/json

{
  "leadId": "l_8gu0og",
  "leadName": "Мария Тестова",
  "outcome": "interested",
  "summary": "Иска оферта за 10 работни места, решава сам.",
  "qualification": "hot",
  "nextSteps": ["Изпрати оферта по имейл"],
  "callbackAt": "2026-09-18T14:00:00.000Z",
  "facts": [{ "label": "Бюджет", "value": "около 5000 лв на месец" }],
  "transcript": [
    { "role": "agent", "text": "Добър ден!", "at": 0 },
    { "role": "lead", "text": "Здравейте.", "at": 4 }
  ],
  "recordingUrl": "https://...",
  "durationSec": 95
}
```

Only `leadId` and `summary` are required. `outcome` is one of `no_answer`, `call_back`,
`interested`, `booked`, `lost`, `in_progress` and sets the lead's status; `qualification`
is one of `hot`, `warm`, `cold`, `unqualified`, `unknown`. `transcript` also accepts one
block of text with `Агент:` / `Клиент:` prefixes. Returns `{ "ok": true, "activityId": "..." }`,
`401` for a wrong key, `400` with the invalid field.

## Where data lives

Nothing leaves the team's Google account. Leads are **read only**. Everything the team adds (comments, calls, emails, status changes) is appended to a separate tab (`Коментари` by default), which the app creates on first use. Lead rows are never edited, so the ads integration can keep appending. Voice notes are audio files in a Drive folder; the comments tab stores the file ID, length and format, and the app streams them only to logged-in users.

The parser copes with the messy real-world sheet: Meta dates with or without a `cre` prefix, phones as `p:+359…`, `359…`, `3590…` or `08…`, rows pasted into a single tab-separated cell, and scratch rows with no contact (skipped).

## Setup

1. **Service account**: Google Cloud console, create a service account, add a JSON key, enable the Google Sheets API.
2. **Share the sheet** with the service account email as **Editor** (it needs to create and append to the comments tab).
3. Copy `.env.example` to `.env.local` (or your host's env settings) and fill it in.
4. **Voice notes** (optional): create a folder inside a **Shared drive**, add the service account to that shared drive as Content manager, and set `VOICE_NOTES_FOLDER_ID`. A normal "My Drive" folder will not work: Google gives service accounts no storage of their own. The app only uses the `drive.file` scope, so it can see nothing in Drive except the recordings it uploaded.
5. **Email** (optional): set `EMAIL_TRANSPORT=smtp` and the SMTP settings. For Google Workspace use an App Password on the sending mailbox.
6. **Calling agent** (optional): set `CALL_PROVIDER` and the keys for it, as described above.

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # unit tests
pnpm typecheck
pnpm build
```

### Local demo without Google

```bash
DATA_SOURCE=file
LOCAL_LEADS_FILE=fixtures/demo-leads.json   # fictional leads
EMAIL_TRANSPORT=log                          # builds emails, never sends
APP_PASSWORD=demo-password
SESSION_SECRET=<32+ random chars>
```

## Access

One shared team password (`APP_PASSWORD`). Each person types their name at login, which is shown on their comments. Sessions last 30 days in a signed, http-only cookie. Search engines are told not to index the app. Lead data includes health information, so keep the password to the sales team and host the app on HTTPS only.

## Deploy (Vercel)

Import the repo, set the env vars from `.env.example` (`DATA_SOURCE=sheets`), deploy. No database is needed.
