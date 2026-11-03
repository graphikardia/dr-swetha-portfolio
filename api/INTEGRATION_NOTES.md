# Google Sheets / Apps Script integration

## One-time setup

1. Open the clinic Google Sheet. The ID is the long string in the URL:
   `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`
2. **Extensions → Apps Script**. Delete the sample code and paste the whole of
   `apps-script/Code.gs`.
3. Confirm `SHEET_ID` at the top of `Code.gs` matches the sheet.
4. **Project Settings (gear) → Script properties**:
   - `ADMIN_PASSCODE` — staff portal passcode (default `sree2026`; change it).
   - `CLINIC_EMAILS` — `graphikardia@gmail.com` (comma-separated for more).
   - `WHATSAPP_RECIPIENTS` — optional CallMeBot JSON array (see below).
5. **Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy**.
   Keep *Execute as: Me* and *Who has access: Anyone*.
   Editing the existing deployment keeps the same `/exec` URL.
6. Put that `/exec` URL in `.env` as `VITE_SHEETS_WEBAPP_URL` and rebuild.

> Important: `ContentService.TextOutput` has no `setHeaders()` method. Calling
> it throws and every request returns Google's HTML error page (which browsers
> report as a CORS error). This backend never calls it. POSTs use
> `Content-Type: text/plain`, which avoids a CORS preflight entirely.

## Tabs (created automatically)

| Tab | Columns |
| --- | --- |
| `Bookings` | Timestamp, Date, Slot, Patient name, Phone, Status |
| `BlockedSlots` | Date, Slot |
| `Settings` | Key, Value (`config` row stores JSON) |

Dates, times and phone numbers are stored as text to stop Sheets from
reformatting them. The backend also normalises older rows that were converted
to Date/time values.

## Statuses

- `New` — public request; the slot is reserved.
- `Confirmed` — staff confirmed; the slot stays blocked.
- `Cancelled` — slot is freed automatically.

## Endpoints

Public (GET):
- `?action=ping`
- `?action=getConfig` — schedule + holiday list
- `?action=getAvailability&date=YYYY-MM-DD` — slot statuses only, **no PII**

Staff (POST, body includes `code`):
- `staffLogin`, `getBookings`, `getDay`, `confirm`, `cancel`,
  `block`, `unblock`, `blockDay`, `unblockDay`, `blockWeek`, `unblockWeek`,
  `getSettings`, `saveSettings`

Public (POST):
- `book`

## CallMeBot WhatsApp (optional)

`WHATSAPP_RECIPIENTS` is a JSON array:

```json
[{"phone":"919999999999","apikey":"123456"}]
```

Each recipient must opt in once by sending
`I allow callmebot to send me messages` to `+34 644 59 71 67`.
This is an unofficial relay and may stop working; email is the reliable path.
