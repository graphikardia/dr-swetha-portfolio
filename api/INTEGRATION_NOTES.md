# Google Sheets Integration Notes

## Setup
1. Create a Google Sheet and copy its ID from the URL.
2. In the sheet: Extensions > Apps Script, paste apps-script/Code.gs.
3. Set SHEET_ID in Code.gs to your sheet ID.
4. Deploy > New deployment > Web app (Execute as: Me, Access: Anyone).
5. Copy the deployment URL and set it as VITE_SHEETS_WEBAPP_URL.
6. In Project Settings > Script Properties, add CLINIC_EMAILS=graphikardia@gmail.com.

## Tabs
- Bookings: one row per appointment request.
- BlockedSlots: one row per blocked (date, time).

## CORS
The script sets Access-Control-Allow-Origin: * on all responses.
