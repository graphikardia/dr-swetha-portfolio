/**
 * Sree Women's Clinic — booking + slot-blocking backend.
 *
 * Setup:
 * 1. Create a Google Sheet (any name). Copy its ID from the URL:
 *      https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit
 * 2. Extensions > Apps Script. Delete the default code, paste this whole file.
 * 3. Replace SHEET_ID below with the ID from step 1.
 * 4. Deploy > New deployment > type "Web app".
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 5. Copy the deployment URL into the site's .env as VITE_SHEETS_WEBAPP_URL.
 *
 * Three tabs are created automatically the first time they're used:
 *   Bookings      — one row per appointment request from the public form.
 *   BlockedSlots  — one row per (date, time) the clinic has blocked.
 *
 * Note: this script is only reachable from a site that calls it directly over
 * the network (e.g. the app deployed on its own hosting).
 *
 * --- New booking notifications ---
 * Every new booking triggers an email. Set CLINIC_EMAILS under
 * Project Settings > Script Properties.
 */

const SHEET_ID = 'PASTE_YOUR_SHEET_ID_HERE';
const BOOKINGS_TAB = 'Bookings';
const BLOCKED_TAB = 'BlockedSlots';

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.openById(SHEET_ID);

  if (body.action === 'book') {
    const sheet = getOrCreateSheet(ss, BOOKINGS_TAB, ['Timestamp', 'Date', 'Slot', 'Patient name', 'Phone', 'Status']);
    sheet.appendRow([new Date(), body.date, body.slot, body.name, body.phone, 'New']);
    notifyNewBooking(body);
    return jsonOut({ ok: true });
  }

  if (body.action === 'block' || body.action === 'unblock') {
    const sheet = getOrCreateSheet(ss, BLOCKED_TAB, ['Date', 'Slot']);
    const rows = sheet.getDataRange().getValues();
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === body.date && r[1] === body.slot);
    if (body.action === 'block' && rowIndex === -1) {
      sheet.appendRow([body.date, body.slot]);
    } else if (body.action === 'unblock' && rowIndex !== -1) {
      sheet.deleteRow(rowIndex + 1);
    }
    return jsonOut({ ok: true });
  }

  if (body.action === 'confirm') {
    const sheet = getOrCreateSheet(ss, BOOKINGS_TAB, ['Timestamp', 'Date', 'Slot', 'Patient name', 'Phone', 'Status']);
    const rows = sheet.getDataRange().getValues();
    const rowIndex = rows.findIndex((r, i) => i > 0 && String(r[1]) === body.date && String(r[2]) === body.slot && String(r[3]) === body.name && String(r[4]) === body.phone);
    if (rowIndex !== -1) {
      sheet.getRange(rowIndex + 1, 6).setValue('Confirmed');
    }
    const blockedSheet = getOrCreateSheet(ss, BLOCKED_TAB, ['Date', 'Slot']);
    const blockedRows = blockedSheet.getDataRange().getValues();
    const blockedIndex = blockedRows.findIndex((r, i) => i > 0 && r[0] === body.date && r[1] === body.slot);
    if (blockedIndex === -1) {
      blockedSheet.appendRow([body.date, body.slot]);
    }
    return jsonOut({ ok: true });
  }

  return jsonOut({ ok: false, error: 'unknown_action' });
}

function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    });
}

function doGet(e) {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  if (e.parameter.action === 'getBlocked') {
    const sheet = getOrCreateSheet(ss, BLOCKED_TAB, ['Date', 'Slot']);
    const rows = sheet.getDataRange().getValues().slice(1);
    const date = e.parameter.date;
    const blocked = rows
      .filter(r => r[0] !== '' && (!date || String(r[0]) === date || formatDate(r[0]) === date))
      .map(r => ({ date: formatDate(r[0]), slot: r[1] }));
    return jsonOut({ ok: true, blocked });
  }

  if (e.parameter.action === 'getBookings') {
    const sheet = getOrCreateSheet(ss, BOOKINGS_TAB, ['Timestamp', 'Date', 'Slot', 'Patient name', 'Phone', 'Status']);
    const rows = sheet.getDataRange().getValues().slice(1);
    const dateFilter = e.parameter.date;
    const bookings = rows
      .filter(r => r[0] !== '' && (!dateFilter || String(r[1]) === dateFilter))
      .map(r => ({
        timestamp: formatDate(r[0]),
        date: String(r[1]),
        slot: String(r[2]),
        name: String(r[3]),
        phone: String(r[4]),
        status: String(r[5])
      }));
    return jsonOut({ ok: true, bookings });
  }

  return jsonOut({ ok: false, error: 'unknown_action' });
}

function notifyNewBooking(booking) {
  const lines = [
    'New appointment request — Sree Women\'s Clinic',
    '',
    'Patient: ' + booking.name,
    'Phone: ' + booking.phone,
    'Date: ' + booking.date,
    'Time: ' + booking.slot,
    '',
    'Not yet confirmed — call the patient back to confirm.'
  ];
  sendNotificationEmail('New appointment request — ' + booking.name, lines.join('\n'));
}

function sendNotificationEmail(subject, body) {
  const emails = (PropertiesService.getScriptProperties().getProperty('CLINIC_EMAILS') || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  emails.forEach(email => {
    try { MailApp.sendEmail(email, subject, body); }
    catch (err) { /* one bad address shouldn't block the rest */ }
  });
}

function formatDate(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v;
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}
