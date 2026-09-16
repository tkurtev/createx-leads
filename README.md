# CreateX Leads

Лийдовете от Google Sheet на едно място: списък, детайли, обаждане с един клик, имейл от приложението и коментари на екипа.

## What it does

- **Lead list** read live from the Google Sheet the ads integration writes to. Checks for new leads every 30 seconds (and when the tab regains focus). New leads get a blue dot, a counter in the header and tab title, and an optional browser notification.
- **Call**: `tel:` link, so on a phone it dials directly and on a Mac it hands off to FaceTime/iPhone. After tapping it, a "How did it go?" panel logs the outcome (no answer, call back, interested, booked, lost) plus a note.
- **Email**: compose in the app and send over SMTP from a shared mailbox, or "Open in mail app" when sending isn't configured. Sent emails appear in the lead's history.
- **Comments and status** per lead, with author and time. Old free-text notes already in the sheet are shown as "Бележки от таблицата".
- **Voice notes**: tap the mic in the comment box, record up to 3 minutes, listen back, send. Recordings are stored in a Google Drive folder and play inside the lead's history and the team activity feed.
- **Bottom menu** (side rail on desktop): Лийдове, За обаждане (who to call next, in priority order), Активност (everything the team did, filterable, voice notes included), Профил (notifications, what's switched on, log out).
- Search by name, phone (any format, e.g. `0888 123`) or email; filter by status or unseen.

## Web form, notifications and the AI agent

Speed to lead: a lead fills in the form, the team gets an email, and an AI agent calls the lead within minutes. The result of the call lands in the lead's history.

```
/form  ->  POST /api/intake  ->  lead saved (sheet / demo store)
                              ->  Resend email to NOTIFY_EMAIL_TO   (link opens the lead: /?lead=<id>)
                              ->  POST AGENT_WEBHOOK_URL            (the agent calls the lead)
AI agent  ->  POST /api/agent/calls  ->  call note + status on the lead, email to the team
```

- **Form**: `/form` is public. Add `?source=harmony` to tag where the lead came from (shown on the lead). Phone is required and must be a callable number; consent is required and says the call may be an AI assistant and recorded. Bots are filtered with a honeypot field and a per-IP limit.
- **Emails**: set `RESEND_API_KEY` and `NOTIFY_EMAIL_TO`. Without a verified domain in Resend, keep `NOTIFY_EMAIL_FROM` on `onboarding@resend.dev`; Resend then only delivers to the Resend account owner's address.
- **Failures show up in the app**: if the email or the agent webhook fails, a note from "Система" is added to that lead's history with the reason. Those notes don't change the lead's status.
- **Sheet mode**: form leads are appended to the leads tab. Columns named `Интерес`, `Съобщение`, `Източник` are filled when they exist; otherwise the values go into the notes column.

### AI агент: integration contract

**1. Lead in.** For every form lead the app sends:

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
    "message": "Двустаен в Лозенец",
    "source": "harmony",
    "consent": true,
    "createdAt": "2026-09-16T13:55:51.730Z"
  },
  "callbackUrl": "https://createx-leads.vercel.app/api/agent/calls"
}
```

Reply with any 2xx within 10 seconds (start the call asynchronously). Phones are always E.164.

**2. Call result back.**

```http
POST /api/agent/calls
Authorization: Bearer <AGENT_API_KEY>
Content-Type: application/json

{
  "leadId": "l_8gu0og",
  "leadName": "Мария Тестова",
  "outcome": "booked",
  "summary": "Иска оглед в събота 11:00",
  "transcript": "Агент: Здравейте...\nКлиент: ...",
  "recordingUrl": "https://...",
  "durationSec": 95
}
```

Only `leadId` and `summary` are required. `outcome` is one of `no_answer`, `call_back`, `interested`, `booked`, `lost`, `in_progress` and sets the lead's status. Returns `{ "ok": true, "activityId": "..." }`, `401` for a wrong key, `400` with the invalid field.

Test locally without a real agent:

```bash
curl -X POST localhost:3000/api/intake -H 'content-type: application/json' \
  -d '{"name":"Тест","phone":"0888111222","consent":true,"source":"test"}'
```

## Where data lives

Nothing leaves the team's Google account. Leads are **read only**. Everything the team adds (comments, calls, emails, status changes) is appended to a separate tab (`Коментари` by default), which the app creates on first use. Lead rows are never edited, so the ads integration can keep appending. Voice notes are audio files in a Drive folder; the comments tab stores the file ID, length and format, and the app streams them only to logged-in users.

The parser copes with the messy real-world sheet: Meta dates with or without a `cre` prefix, phones as `p:+359…`, `359…`, `3590…` or `08…`, rows pasted into a single tab-separated cell, and scratch rows with no contact (skipped).

## Setup

1. **Service account**: Google Cloud console, create a service account, add a JSON key, enable the Google Sheets API.
2. **Share the sheet** with the service account email as **Editor** (it needs to create and append to the comments tab).
3. Copy `.env.example` to `.env.local` (or your host's env settings) and fill it in.
4. **Voice notes** (optional): create a folder inside a **Shared drive**, add the service account to that shared drive as Content manager, and set `VOICE_NOTES_FOLDER_ID`. A normal "My Drive" folder will not work: Google gives service accounts no storage of their own. The app only uses the `drive.file` scope, so it can see nothing in Drive except the recordings it uploaded.
5. **Email** (optional): set `EMAIL_TRANSPORT=smtp` and the SMTP settings. For Google Workspace use an App Password on the sending mailbox.

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
