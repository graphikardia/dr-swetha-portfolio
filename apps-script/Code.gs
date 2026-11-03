/**
 * Sree Women's Clinic — booking + slot-blocking backend.
 * =====================================================
 *
 * IMPORTANT: Google Apps Script ContentService does NOT support setHeaders().
 * Calling it throws "setHeaders is not a function" and every request fails
 * (which shows up in the browser as a CORS error). This file deliberately
 * never calls setHeaders(). CORS works automatically because the browser
 * sends simple requests (POST with Content-Type: text/plain, and GET).
 *
 * Setup
 * -----
 * 1. Open the Google Sheet, copy the ID from the URL:
 *      https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit
 * 2. Extensions > Apps Script. Replace ALL code with this file.
 * 3. Deploy > Manage deployments > (pencil) > Version: New version > Deploy.
 *    Keep "Execute as: Me" and "Who has access: Anyone".
 *    Editing an existing deployment keeps the same /exec URL.
 * 4. Project Settings (gear) > Script properties:
 *      ADMIN_PASSCODE  = your staff portal passcode  (default: sree2026)
 *      CLINIC_EMAILS   = graphikardia@gmail.com
 *      WHATSAPP_RECIPIENTS (optional, see below)
 *
 * Tabs created automatically:
 *   Bookings      Timestamp | Date | Slot | Patient name | Phone | Status
 *   BlockedSlots  Date | Slot
 *   Settings      Key | Value
 *
 * Status values: New -> Confirmed / Cancelled
 *   New/Confirmed reserve the slot. Cancelled frees it.
 */

const SHEET_ID = '1rreDLrUb-Gi2zcFmqpaKMcL8Z8AjImh2F6xmdKHfCVA';
const TZ = 'Asia/Kolkata';
const BOOKINGS_TAB = 'Bookings';
const BLOCKED_TAB = 'BlockedSlots';
const SETTINGS_TAB = 'Settings';
const PORTAL_URL = 'https://graphikardia.github.io/dr-swetha-portfolio/#/sree-clinic-admin';

const BOOKING_HEADERS = ['Timestamp', 'Date', 'Slot', 'Patient name', 'Phone', 'Status'];
const BLOCK_HEADERS = ['Date', 'Slot'];
const SETTINGS_HEADERS = ['Key', 'Value'];

const DEFAULT_SETTINGS = {
  enabled: true,
  days: [1, 2, 3, 4, 5, 6],
  start: '14:00',
  end: '17:00',
  duration: 15,
  buffer: 0,
  breakStart: '',
  breakEnd: '',
  fee: '',
  ignoreHolidays: false,
  extraClosedDates: []
};

// India gazetted / public holidays (clinic closed unless "ignoreHolidays" is on).
const HOLIDAYS = {
  '2026-01-26': 'Republic Day',
  '2026-03-04': 'Holi',
  '2026-03-21': 'Id-ul-Fitr',
  '2026-03-26': 'Ram Navami',
  '2026-03-31': 'Mahavir Jayanti',
  '2026-04-03': 'Good Friday',
  '2026-05-01': 'Buddha Purnima',
  '2026-05-27': 'Id-ul-Zuha / Bakrid',
  '2026-06-26': 'Muharram',
  '2026-08-15': 'Independence Day',
  '2026-08-26': 'Milad-un-Nabi',
  '2026-09-04': 'Janmashtami',
  '2026-10-02': "Mahatma Gandhi's Birthday",
  '2026-10-20': 'Dussehra / Vijayadashami',
  '2026-11-08': 'Diwali / Deepavali',
  '2026-11-24': "Guru Nanak's Birthday",
  '2026-12-25': 'Christmas Day',
  '2027-01-26': 'Republic Day',
  '2027-03-10': 'Id-ul-Fitr',
  '2027-03-23': 'Holi',
  '2027-03-26': 'Good Friday',
  '2027-04-15': 'Ram Navami',
  '2027-04-19': 'Mahavir Jayanti',
  '2027-05-17': 'Id-ul-Zuha / Bakrid',
  '2027-05-20': 'Buddha Purnima',
  '2027-06-16': 'Muharram',
  '2027-08-15': 'Independence Day',
  '2027-08-25': 'Janmashtami',
  '2027-10-02': "Mahatma Gandhi's Birthday",
  '2027-10-09': 'Dussehra / Vijayadashami',
  '2027-10-29': 'Diwali / Deepavali',
  '2027-11-14': "Guru Nanak's Birthday",
  '2027-12-25': 'Christmas Day'
};

/* ------------------------------------------------------------------ */
/* Entry points                                                        */
/* ------------------------------------------------------------------ */

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    var action = p.action || 'getConfig';
    if (action === 'ping') {
      return jsonOut({ ok: true, pong: true, now: nowIso() });
    }
    if (action === 'getConfig') {
      var ss0 = SpreadsheetApp.openById(SHEET_ID);
      return jsonOut({
        ok: true,
        settings: readSettings(ss0),
        holidays: HOLIDAYS,
        today: todayIst()
      });
    }
    if (action === 'getAvailability') {
      return jsonOut(computeAvailability(normDate(p.date), false));
    }
    if (action === 'getBlocked') {
      // Kept for backwards compatibility. Public: only slot labels, no PII.
      var d = normDate(p.date);
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var map = readBlockedSet(ss, d);
      return jsonOut({ ok: true, blocked: Object.keys(map).map(function (s) { return { date: d, slot: s }; }) });
    }
    return jsonOut({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return jsonOut({ ok: false, error: 'server_error', message: String(err) });
  }
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return jsonOut({ ok: false, error: 'bad_json', message: 'Request body was not valid JSON.' });
  }

  try {
    var action = body.action;

    // Public actions -------------------------------------------------
    if (action === 'book') return jsonOut(handleBook(body));

    // Authentication ------------------------------------------------
    if (action === 'staffLogin') {
      if (!isStaff(body.code)) {
        return jsonOut({ ok: false, error: 'unauthorized', message: 'Incorrect passcode.' });
      }
      return jsonOut({ ok: true, today: todayIst() });
    }

    // Everything below requires the staff passcode ------------------
    if (!isStaff(body.code)) {
      return jsonOut({ ok: false, error: 'unauthorized', message: 'Your session has expired. Please sign in again.' });
    }

    if (action === 'getBookings') return jsonOut(handleGetBookings(body));
    if (action === 'getDay') return jsonOut(computeAvailability(normDate(body.date), true));
    if (action === 'confirm') return jsonOut(handleConfirm(body));
    if (action === 'cancel') return jsonOut(handleCancel(body));
    if (action === 'block') return jsonOut(handleBlock(body, true));
    if (action === 'unblock') return jsonOut(handleBlock(body, false));
    if (action === 'blockDay') return jsonOut(handleBlockDay(body, true));
    if (action === 'unblockDay') return jsonOut(handleBlockDay(body, false));
    if (action === 'blockWeek') return jsonOut(handleBlockWeek(body, true));
    if (action === 'unblockWeek') return jsonOut(handleBlockWeek(body, false));
    if (action === 'getSettings') {
      var ssg = SpreadsheetApp.openById(SHEET_ID);
      return jsonOut({ ok: true, settings: readSettings(ssg), holidays: HOLIDAYS, today: todayIst() });
    }
    if (action === 'saveSettings') return jsonOut(handleSaveSettings(body));

    return jsonOut({ ok: false, error: 'unknown_action', message: 'Unknown action: ' + action });
  } catch (err) {
    return jsonOut({ ok: false, error: 'server_error', message: String(err) });
  }
}

// Options is never actually called by a browser preflight against Apps Script,
// but returning a valid empty response keeps manual probes happy.
function doOptions() {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}

/* ------------------------------------------------------------------ */
/* Booking                                                             */
/* ------------------------------------------------------------------ */

function handleBook(body) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var settings = readSettings(ss);
  var date = normDate(body.date);
  var slot = normSlot(body.slot);
  var name = cleanText(body.name, 80);
  var phone = normalizePhone(body.phone);

  if (!isIsoDate(date)) {
    return fail('validation', 'Please choose a valid appointment date.');
  }
  if (name.length < 2) {
    return fail('validation', 'Please enter the patient name.');
  }
  if (phone.length < 10 || phone.length > 15) {
    return fail('validation', 'Please enter a valid mobile number.');
  }
  if (!settings.enabled) {
    return fail('disabled', 'Online booking is currently closed. Please contact the clinic.');
  }

  var reason = closedReason(date, settings);
  if (reason) {
    return fail(reason, closedMessage(reason, date));
  }
  if (date < todayIst()) {
    return fail('past_date', 'That date has already passed. Please choose a future date.');
  }

  var validSlots = makeSlots(date, settings);
  if (validSlots.indexOf(slot) === -1) {
    return fail('invalid_slot', 'That time is not part of the clinic schedule. Please choose another.');
  }
  if (date === todayIst() && toMin(slot) <= nowMinutesIst()) {
    return fail('past_slot', 'That time has already passed today. Please choose a later slot.');
  }

  // Light throttling: a phone number cannot hammer the form. This is not a
  // substitute for a captcha, but it stops accidental triple-submits and
  // casual spam without needing the caller's IP address.
  var cache = CacheService.getScriptCache();
  var throttleKey = 'book_' + phone;
  var attempts = Number(cache.get(throttleKey) || 0);
  if (attempts >= 5) {
    return fail('too_many', 'Too many requests from this number. Please call the clinic.');
  }
  cache.put(throttleKey, String(attempts + 1), 600);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return fail('busy', 'The clinic schedule is busy right now. Please try again.');
  }

  var created = false;
  var rowNumber = 0;
  try {
    var sheet = getOrCreateSheet(ss, BOOKINGS_TAB, BOOKING_HEADERS);
    applyTextFormats(sheet, [2, 3, 5]);
    var rows = sheet.getDataRange().getValues();
    var slotTaken = false;
    var samePhoneCount = 0;

    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (!r[0] && !r[1] && !r[2]) continue;
      var status = String(r[5] || 'New');
      if (status.toLowerCase() === 'cancelled') continue;
      var rDate = normDate(r[1]);
      var rSlot = normSlot(r[2]);
      var rPhone = normalizePhone(r[4]);
      if (rDate === date && rSlot === slot) slotTaken = true;
      if (rDate === date && phone && rPhone === phone) samePhoneCount++;
    }

    var blocked = readBlockedSet(ss, date);
    if (blocked[slot]) {
      return fail('blocked', 'That time has just been blocked. Please choose another slot.');
    }
    if (slotTaken) {
      return fail('slot_taken', 'That time was just taken. Please choose another slot.');
    }
    if (samePhoneCount >= 3) {
      return fail('too_many', 'There are already several requests from this number for that day. Please call the clinic.');
    }

    sheet.appendRow([new Date(), date, slot, name, phone, 'New']);
    rowNumber = sheet.getLastRow();
    created = true;
  } finally {
    lock.releaseLock();
  }

  if (created) {
    try {
      notifyNewBooking({ date: date, slot: slot, name: name, phone: phone, row: rowNumber });
    } catch (err) {
      // The booking is already saved. Never report failure just because the
      // notification channel (MailApp/CallMeBot) is unavailable.
    }
  }
  return { ok: true, ref: 'SWC-' + rowNumber, message: 'Request received.' };
}

/* ------------------------------------------------------------------ */
/* Staff: bookings                                                     */
/* ------------------------------------------------------------------ */

function handleGetBookings(body) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, BOOKINGS_TAB, BOOKING_HEADERS);
  var rows = sheet.getDataRange().getValues();
  var filterDate = body.date ? normDate(body.date) : '';
  var statusFilter = String(body.status || 'all').toLowerCase();
  var scope = String(body.scope || 'upcoming');
  var q = String(body.q || '').toLowerCase().trim();
  var qDigits = digitsOnly(q);
  var today = todayIst();
  var out = [];

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0] && !r[1] && !r[2]) continue;
    var rec = {
      row: i + 1,
      timestamp: formatTimestamp(r[0]),
      date: normDate(r[1]),
      slot: normSlot(r[2]),
      name: String(r[3] || '').trim(),
      phone: normalizePhone(r[4]),
      status: String(r[5] || 'New').trim() || 'New'
    };
    if (!isIsoDate(rec.date)) continue;
    if (filterDate) {
      if (rec.date !== filterDate) continue;
    } else if (scope === 'upcoming' && rec.date < today) {
      continue;
    }
    if (statusFilter !== 'all' && rec.status.toLowerCase() !== statusFilter) continue;
    if (q) {
      var hay = (rec.name + ' ' + rec.phone + ' ' + rec.date).toLowerCase();
      if (hay.indexOf(q) === -1 && !(qDigits && digitsOnly(rec.phone).indexOf(qDigits) !== -1)) continue;
    }
    out.push(rec);
  }

  out.sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.slot !== b.slot) return a.slot < b.slot ? -1 : 1;
    return a.row - b.row;
  });

  var newCount = 0;
  var confirmedCount = 0;
  for (var j = 0; j < out.length; j++) {
    if (out[j].status === 'New') newCount++;
    if (out[j].status === 'Confirmed') confirmedCount++;
  }

  return {
    ok: true,
    today: today,
    bookings: out.slice(0, 1000),
    counts: { total: out.length, new: newCount, confirmed: confirmedCount }
  };
}

function handleConfirm(body) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var date = normDate(body.date);
  var slot = normSlot(body.slot);
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (err) { return fail('busy', 'Please try again.'); }

  try {
    var sheet = getOrCreateSheet(ss, BOOKINGS_TAB, BOOKING_HEADERS);
    var rows = sheet.getDataRange().getValues();
    var row = locateBookingRow(rows, body, date, slot);
    if (row < 2) {
      return fail('not_found', 'That booking could not be found. Refresh the list and try again.');
    }
    sheet.getRange(row, 6).setValue('Confirmed');
    addBlock(ss, date, slot);
    return { ok: true, row: row };
  } finally {
    lock.releaseLock();
  }
}

function handleCancel(body) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var date = normDate(body.date);
  var slot = normSlot(body.slot);
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (err) { return fail('busy', 'Please try again.'); }

  try {
    var sheet = getOrCreateSheet(ss, BOOKINGS_TAB, BOOKING_HEADERS);
    var rows = sheet.getDataRange().getValues();
    var row = locateBookingRow(rows, body, date, slot);
    if (row < 2) {
      return fail('not_found', 'That booking could not be found. Refresh the list and try again.');
    }
    sheet.getRange(row, 6).setValue('Cancelled');

    // Free the slot if no other active booking uses it.
    var stillUsed = false;
    for (var i = 1; i < rows.length; i++) {
      if (i + 1 === row) continue;
      var r = rows[i];
      var st = String(r[5] || 'New');
      if (st.toLowerCase() === 'cancelled') continue;
      if (normDate(r[1]) === date && normSlot(r[2]) === slot) { stillUsed = true; break; }
    }
    if (!stillUsed) removeBlock(ss, date, slot);
    return { ok: true, row: row, slotFreed: !stillUsed };
  } finally {
    lock.releaseLock();
  }
}

function locateBookingRow(rows, body, date, slot) {
  var wantedRow = Number(body.row) || 0;
  function matches(r) {
    if (!r) return false;
    if (normDate(r[1]) !== date) return false;
    if (normSlot(r[2]) !== slot) return false;
    if (body.name && String(r[3] || '').trim() !== String(body.name).trim()) return false;
    if (body.phone && normalizePhone(r[4]) !== normalizePhone(body.phone)) return false;
    return true;
  }
  if (wantedRow >= 2 && wantedRow <= rows.length && matches(rows[wantedRow - 1])) {
    return wantedRow;
  }
  for (var i = 1; i < rows.length; i++) {
    if (matches(rows[i])) return i + 1;
  }
  return -1;
}

/* ------------------------------------------------------------------ */
/* Staff: blocking                                                     */
/* ------------------------------------------------------------------ */

function handleBlock(body, block) {
  var date = normDate(body.date);
  var slot = normSlot(body.slot);
  if (!isIsoDate(date)) return fail('validation', 'Invalid date.');
  if (!/^\d{2}:\d{2}$/.test(slot)) return fail('validation', 'Invalid time slot.');

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) { return fail('busy', 'Please try again.'); }
  try {
    getOrCreateSheet(ss, BLOCKED_TAB, BLOCK_HEADERS);
    applyTextFormats(ss.getSheetByName(BLOCKED_TAB), [1, 2]);
    if (block) addBlock(ss, date, slot);
    else removeBlock(ss, date, slot);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function handleBlockDay(body, block) {
  var date = normDate(body.date);
  if (!isIsoDate(date)) return fail('validation', 'Invalid date.');
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var settings = readSettings(ss);
  var slots = makeSlots(date, settings);
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (err) { return fail('busy', 'Please try again.'); }

  try {
    getOrCreateSheet(ss, BLOCKED_TAB, BLOCK_HEADERS);
    applyTextFormats(ss.getSheetByName(BLOCKED_TAB), [1, 2]);
    if (block) {
      var map = readBlockedSet(ss, date);
      var added = 0;
      for (var i = 0; i < slots.length; i++) {
        if (!map[slots[i]]) { addBlock(ss, date, slots[i]); added++; }
      }
      return { ok: true, added: added, total: slots.length, closed: slots.length === 0 };
    }
    var removed = removeBlocksForDate(ss, date);
    return { ok: true, removed: removed };
  } finally {
    lock.releaseLock();
  }
}

function handleBlockWeek(body, block) {
  var start = normDate(body.date);
  if (!isIsoDate(start)) return fail('validation', 'Invalid start date.');
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var settings = readSettings(ss);
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (err) { return fail('busy', 'Please try again.'); }

  try {
    getOrCreateSheet(ss, BLOCKED_TAB, BLOCK_HEADERS);
    applyTextFormats(ss.getSheetByName(BLOCKED_TAB), [1, 2]);
    var added = 0;
    var removed = 0;
    var daysTouched = 0;
    for (var n = 0; n < 7; n++) {
      var d = addDays(start, n);
      if (block) {
        var slots = makeSlots(d, settings);
        if (!slots.length) continue;
        daysTouched++;
        var map = readBlockedSet(ss, d);
        for (var i = 0; i < slots.length; i++) {
          if (!map[slots[i]]) { addBlock(ss, d, slots[i]); added++; }
        }
      } else {
        var count = removeBlocksForDate(ss, d);
        if (count) daysTouched++;
        removed += count;
      }
    }
    return { ok: true, added: added, removed: removed, days: daysTouched };
  } finally {
    lock.releaseLock();
  }
}

function addBlock(ss, date, slot) {
  var sheet = getOrCreateSheet(ss, BLOCKED_TAB, BLOCK_HEADERS);
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (normDate(rows[i][0]) === date && normSlot(rows[i][1]) === slot) return;
  }
  sheet.appendRow([date, slot]);
}

function removeBlock(ss, date, slot) {
  var sheet = getOrCreateSheet(ss, BLOCKED_TAB, BLOCK_HEADERS);
  var rows = sheet.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (normDate(rows[i][0]) === date && normSlot(rows[i][1]) === slot) {
      sheet.deleteRow(i + 1);
    }
  }
}

function removeBlocksForDate(ss, date) {
  var sheet = getOrCreateSheet(ss, BLOCKED_TAB, BLOCK_HEADERS);
  var rows = sheet.getDataRange().getValues();
  var removed = 0;
  for (var i = rows.length - 1; i >= 1; i--) {
    if (normDate(rows[i][0]) === date) {
      sheet.deleteRow(i + 1);
      removed++;
    }
  }
  return removed;
}

function readBlockedSet(ss, date) {
  var sheet = getOrCreateSheet(ss, BLOCKED_TAB, BLOCK_HEADERS);
  var rows = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < rows.length; i++) {
    if (normDate(rows[i][0]) === date) map[normSlot(rows[i][1])] = true;
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Staff: settings                                                     */
/* ------------------------------------------------------------------ */

function readSettings(ss) {
  var sheet = getOrCreateSheet(ss, SETTINGS_TAB, SETTINGS_HEADERS);
  var rows = sheet.getDataRange().getValues();
  var stored = {};
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === 'config') {
      try { stored = JSON.parse(String(rows[i][1] || '{}')); } catch (err) { stored = {}; }
    }
  }
  return sanitizeSettings(stored);
}

function handleSaveSettings(body) {
  var incoming = body.settings || {};
  var validation = validateSettings(incoming);
  if (validation) return fail('validation', validation);

  var settings = sanitizeSettings(incoming);
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = getOrCreateSheet(ss, SETTINGS_TAB, SETTINGS_HEADERS);
  var rows = sheet.getDataRange().getValues();
  var target = -1;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === 'config') { target = i + 1; break; }
  }
  var json = JSON.stringify(settings);
  if (target === -1) sheet.appendRow(['config', json]);
  else sheet.getRange(target, 2).setNumberFormat('@').setValue(json);
  return { ok: true, settings: settings };
}

function validateSettings(s) {
  if (!s || typeof s !== 'object') return 'Settings must be an object.';
  if (!Array.isArray(s.days) || !s.days.length) return 'Select at least one consultation day.';
  if (!/^\d{2}:\d{2}$/.test(String(s.start || ''))) return 'Opening time is invalid.';
  if (!/^\d{2}:\d{2}$/.test(String(s.end || ''))) return 'Closing time is invalid.';
  if (toMin(s.start) >= toMin(s.end)) return 'Closing time must be after opening time.';
  var duration = Number(s.duration);
  if (!(duration >= 5 && duration <= 120)) return 'Appointment duration must be between 5 and 120 minutes.';
  var buffer = Number(s.buffer || 0);
  if (!(buffer >= 0 && buffer <= 60)) return 'Buffer must be between 0 and 60 minutes.';
  if (s.breakStart || s.breakEnd) {
    if (!/^\d{2}:\d{2}$/.test(String(s.breakStart || '')) || !/^\d{2}:\d{2}$/.test(String(s.breakEnd || ''))) {
      return 'Set both break start and break end, or leave both blank.';
    }
    if (toMin(s.breakStart) >= toMin(s.breakEnd)) return 'Break end must be after break start.';
  }
  return null;
}

function sanitizeSettings(s) {
  s = s || {};
  var days = Array.isArray(s.days)
    ? s.days.map(Number).filter(function (d) { return d >= 0 && d <= 6; })
    : DEFAULT_SETTINGS.days.slice();
  days = days.filter(function (d, i, arr) { return arr.indexOf(d) === i; });
  if (!days.length) days = DEFAULT_SETTINGS.days.slice();

  var start = /^\d{2}:\d{2}$/.test(String(s.start || '')) ? String(s.start) : DEFAULT_SETTINGS.start;
  var end = /^\d{2}:\d{2}$/.test(String(s.end || '')) ? String(s.end) : DEFAULT_SETTINGS.end;
  if (toMin(start) >= toMin(end)) { start = DEFAULT_SETTINGS.start; end = DEFAULT_SETTINGS.end; }

  var duration = clampInt(s.duration, 5, 120, DEFAULT_SETTINGS.duration);
  var buffer = clampInt(s.buffer, 0, 60, DEFAULT_SETTINGS.buffer);
  var breakStart = /^\d{2}:\d{2}$/.test(String(s.breakStart || '')) ? String(s.breakStart) : '';
  var breakEnd = /^\d{2}:\d{2}$/.test(String(s.breakEnd || '')) ? String(s.breakEnd) : '';
  if (!breakStart || !breakEnd || toMin(breakStart) >= toMin(breakEnd)) { breakStart = ''; breakEnd = ''; }

  var extra = Array.isArray(s.extraClosedDates) ? s.extraClosedDates : [];
  extra = extra.map(normDate).filter(function (d) { return isIsoDate(d); });
  extra = extra.filter(function (d, i, arr) { return arr.indexOf(d) === i; }).slice(0, 200);

  return {
    enabled: s.enabled !== false,
    days: days,
    start: start,
    end: end,
    duration: duration,
    buffer: buffer,
    breakStart: breakStart,
    breakEnd: breakEnd,
    fee: cleanText(s.fee, 40),
    ignoreHolidays: s.ignoreHolidays === true,
    extraClosedDates: extra
  };
}

/* ------------------------------------------------------------------ */
/* Availability                                                        */
/* ------------------------------------------------------------------ */

function computeAvailability(date, includePii) {
  if (!isIsoDate(date)) {
    return fail('validation', 'Invalid date.');
  }
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var settings = readSettings(ss);
  var reason = closedReason(date, settings);
  var slots = makeSlots(date, settings);
  var blockedMap = readBlockedSet(ss, date);
  var bookedMap = readBookedMap(ss, date);
  var list = [];
  var seen = {};

  for (var i = 0; i < slots.length; i++) {
    var slot = slots[i];
    seen[slot] = true;
    var booking = bookedMap[slot];
    var status = booking ? 'booked' : (blockedMap[slot] ? 'blocked' : 'open');
    var item = { slot: slot, status: status };
    if (booking) {
      item.bookingStatus = booking.status;
      if (includePii) {
        item.name = booking.name;
        item.phone = booking.phone;
        item.row = booking.row;
      }
    }
    list.push(item);
  }

  // Blocks that no longer line up with the current schedule (e.g. after the
  // schedule was changed). Staff need to see these so they can remove them.
  var extraBlocked = [];
  if (includePii) {
    for (var b in blockedMap) {
      if (!seen[b]) extraBlocked.push({ slot: b, status: 'blocked' });
    }
  }

  return {
    ok: true,
    date: date,
    closed: !!reason,
    reason: reason || '',
    holidayName: HOLIDAYS[date] || '',
    today: todayIst(),
    settings: settings,
    slots: list,
    extraBlocked: extraBlocked
  };
}

function readBookedMap(ss, date) {
  var sheet = getOrCreateSheet(ss, BOOKINGS_TAB, BOOKING_HEADERS);
  var rows = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0] && !r[1] && !r[2]) continue;
    if (String(r[5] || '').toLowerCase() === 'cancelled') continue;
    if (normDate(r[1]) !== date) continue;
    var slot = normSlot(r[2]);
    if (!map[slot]) {
      map[slot] = {
        row: i + 1,
        name: String(r[3] || '').trim(),
        phone: normalizePhone(r[4]),
        status: String(r[5] || 'New').trim() || 'New'
      };
    }
  }
  return map;
}

function closedReason(date, settings) {
  if (!settings.enabled) return 'disabled';
  var dow = dayOfWeek(date);
  if (settings.days.indexOf(dow) === -1) return dow === 0 ? 'sunday' : 'closed_day';
  if (!settings.ignoreHolidays && HOLIDAYS[date]) return 'holiday';
  if (settings.extraClosedDates.indexOf(date) !== -1) return 'extra_closed';
  return '';
}

function closedMessage(reason, date) {
  if (reason === 'disabled') return 'Online booking is currently closed. Please contact the clinic.';
  if (reason === 'sunday') return 'The clinic is closed on Sundays. Please choose Monday to Saturday.';
  if (reason === 'closed_day') return 'The clinic is closed on this day. Please choose another date.';
  if (reason === 'holiday') return 'The clinic is closed on ' + date + ' for ' + (HOLIDAYS[date] || 'a public holiday') + '.';
  if (reason === 'extra_closed') return 'The clinic is closed on this date. Please choose another date.';
  return 'The clinic is unavailable on this date.';
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

function notifyNewBooking(booking) {
  var pretty = prettySlot(booking.slot);
  var lines = [
    "New appointment request — Sree Women's Clinic",
    '',
    'Patient: ' + booking.name,
    'Phone: +' + booking.phone,
    'Date: ' + prettyDate(booking.date),
    'Time: ' + pretty,
    '',
    'Status: New (slot reserved)',
    'Confirm or cancel it here:',
    PORTAL_URL
  ];
  sendNotificationEmail('New appointment — ' + booking.name + ' — ' + booking.date + ' ' + pretty, lines.join('\n'));
  sendWhatsAppNotifications(lines.join('\n'));
}

function sendNotificationEmail(subject, body) {
  var emails = (PropertiesService.getScriptProperties().getProperty('CLINIC_EMAILS') || '')
    .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  for (var i = 0; i < emails.length; i++) {
    try { MailApp.sendEmail(emails[i], subject, body); } catch (err) { /* skip bad address */ }
  }
}

function sendWhatsAppNotifications(text) {
  var recipients = [];
  try {
    recipients = JSON.parse(PropertiesService.getScriptProperties().getProperty('WHATSAPP_RECIPIENTS') || '[]');
  } catch (err) { recipients = []; }
  if (!Array.isArray(recipients)) return;
  for (var i = 0; i < recipients.length; i++) {
    var r = recipients[i] || {};
    if (!r.phone || !r.apikey) continue;
    var url = 'https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(r.phone)
      + '&text=' + encodeURIComponent(text) + '&apikey=' + encodeURIComponent(r.apikey);
    try { UrlFetchApp.fetch(url, { muteHttpExceptions: true }); } catch (err) { /* skip */ }
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function fail(error, message) {
  return { ok: false, error: error, message: message || '' };
}

function isStaff(code) {
  var expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSCODE') || 'sree2026';
  return String(code || '') === String(expected);
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    if (name === BOOKINGS_TAB) applyTextFormats(sheet, [2, 3, 5]);
    if (name === BLOCKED_TAB) applyTextFormats(sheet, [1, 2]);
  }
  return sheet;
}

function applyTextFormats(sheet, columns) {
  try {
    var rows = Math.max(sheet.getMaxRows(), 2);
    for (var i = 0; i < columns.length; i++) {
      sheet.getRange(2, columns[i], rows - 1, 1).setNumberFormat('@');
    }
  } catch (err) { /* formatting is best-effort */ }
}

function makeSlots(date, s) {
  if (!s || !s.enabled || !date || !isIsoDate(date)) return [];
  if (s.days.indexOf(dayOfWeek(date)) === -1) return [];
  if (!s.ignoreHolidays && HOLIDAYS[date]) return [];
  if (s.extraClosedDates.indexOf(date) !== -1) return [];

  var from = toMin(s.start);
  var to = toMin(s.end);
  var duration = Number(s.duration);
  var step = duration + Number(s.buffer || 0);
  if (!(duration > 0) || !(step > 0) || from >= to) return [];

  var out = [];
  for (var t = from; t + duration <= to; t += step) {
    if (s.breakStart && s.breakEnd) {
      var bs = toMin(s.breakStart);
      var be = toMin(s.breakEnd);
      if (t < be && t + duration > bs) continue;
    }
    out.push(pad2(Math.floor(t / 60)) + ':' + pad2(t % 60));
  }
  return out;
}

function normDate(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  if (typeof v === 'number') {
    // Google Sheets serial date (days since 1899-12-30).
    var ms = Math.round((v - 25569) * 86400 * 1000);
    return Utilities.formatDate(new Date(ms), TZ, 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
  var d = new Date(s);
  if (!isNaN(d.getTime())) return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  return s;
}

function normSlot(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'HH:mm');
  if (typeof v === 'number' && v >= 0 && v < 1) {
    var total = Math.round(v * 24 * 60);
    return pad2(Math.floor(total / 60)) + ':' + pad2(total % 60);
  }
  var s = String(v).trim();
  var m = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (m) {
    var h = Number(m[1]);
    if (m[3]) {
      h = h % 12;
      if (m[3].toLowerCase() === 'pm') h += 12;
    }
    return pad2(h) + ':' + m[2];
  }
  return s;
}

function isIsoDate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
}

function addDays(date, n) {
  var parts = date.split('-').map(Number);
  var d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + n));
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}

function dayOfWeek(date) {
  var parts = date.split('-').map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
}

function toMin(v) {
  var m = String(v || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return -1;
  return Number(m[1]) * 60 + Number(m[2]);
}

function pad2(n) {
  return String(n).padStart ? String(n).padStart(2, '0') : ('0' + n).slice(-2);
}

function todayIst() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function nowMinutesIst() {
  var s = Utilities.formatDate(new Date(), TZ, 'HH:mm');
  return toMin(s);
}

function nowIso() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
}

function formatTimestamp(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm');
  if (typeof v === 'number') {
    var ms = Math.round((v - 25569) * 86400 * 1000);
    return Utilities.formatDate(new Date(ms), TZ, 'yyyy-MM-dd HH:mm');
  }
  return String(v || '');
}

function prettyDate(date) {
  if (!isIsoDate(date)) return date;
  var parts = date.split('-').map(Number);
  var d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return days[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + months[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}

function prettySlot(slot) {
  var m = String(slot || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return slot;
  var h = Number(m[1]);
  var suffix = h >= 12 ? 'pm' : 'am';
  var hh = ((h + 11) % 12) + 1;
  return hh + ':' + m[2] + ' ' + suffix;
}

function cleanText(v, max) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max || 120);
}

function digitsOnly(v) {
  return String(v === null || v === undefined ? '' : v).replace(/\D/g, '');
}

function normalizePhone(v) {
  var d = digitsOnly(v);
  if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
  if (d.length === 10) return '91' + d;
  if (d.length === 12 && d.slice(0, 2) === '91') return d;
  if (d.length === 13 && d.slice(0, 3) === '091') return d.slice(1);
  return d;
}

function clampInt(v, min, max, fallback) {
  var n = Number(v);
  if (!isFinite(n)) return fallback;
  n = Math.round(n);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
