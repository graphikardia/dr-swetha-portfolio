import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, Clock3, MapPin, Phone, ArrowUpRight, Menu, X, CheckCircle2,
  Stethoscope, Languages, GraduationCap, HeartPulse, ShieldCheck, ChevronRight,
  LockKeyhole, Ban, RefreshCw, LogOut, Search, AlertTriangle, MessageCircle
} from 'lucide-react';
import doctorPhoto from './assets/dr-swetha.jpg';

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

const SHEETS_URL = import.meta.env.VITE_SHEETS_WEBAPP_URL || '';
const STAFF_KEY = 'sreeStaffCode';

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

const PROFILE = {
  name: 'Dr. Swetha Vinjamuri',
  role: 'Obstetrician & Gynaecologist',
  experience: '21+ years of clinical experience',
  registration: 'KMC 75539',
  photo: doctorPhoto,
  cloudnine: 'https://www.cloudninecare.com/doctors/dr-swetha-vinjamuri',
  qualifications: ['MBBS · MS Ramaiah Medical College, Bengaluru', 'DGO · JSS University, Mysore', 'DNB · Obstetrics & Gynaecology, 2015', 'Fellowship · Reproductive Medicine'],
  specialities: ['Pregnancy & high-risk pregnancy care', 'Preconception counselling', 'PCOS / PCOD management', 'Teenage menstrual health', 'Laparoscopy & diagnostic hysteroscopy', 'Fibroid removal surgery'],
  languages: ['English', 'Hindi', 'Kannada', 'Telugu', 'Tamil', 'Malayalam']
};

const LOCATIONS = [
  { id: 'hrbr', no: '01', name: 'Cloudnine Hospital', area: 'HRBR Layout', address: '636/1, Service Road, Anjanappa Layout, Nanjappa Garden, Horamavu, Bengaluru', type: 'Hospital appointment', detail: 'Appointments are managed through Cloudnine.', link: PROFILE.cloudnine, external: true },
  { id: 'thanisandra', no: '02', name: 'Cloudnine Hospital', area: 'Thanisandra', address: 'Thanisandra Main Road, RK Hegde Nagar, Bengaluru', type: 'Hospital appointment', detail: 'Appointments are managed through Cloudnine.', link: PROFILE.cloudnine, external: true },
  { id: 'sree', no: '03', name: "Sree Women's Clinic", area: 'Thanisandra / Meganahalli', address: 'Exact clinic address and directions are shared when your appointment is confirmed.', type: 'Direct clinic appointment', detail: 'Book directly through the clinic.', external: false }
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STATUS_LABEL = { New: 'Awaiting confirmation', Confirmed: 'Confirmed', Cancelled: 'Cancelled' };

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function pad2(n) { return String(n).padStart(2, '0'); }

function todayLocal() {
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function addDaysLocal(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate());
}

function prettyTime(slot) {
  if (!slot) return '';
  const [h, m] = slot.split(':').map(Number);
  if (Number.isNaN(h)) return slot;
  const suffix = h >= 12 ? 'pm' : 'am';
  const hh = ((h + 11) % 12) + 1;
  return hh + ':' + pad2(m) + ' ' + suffix;
}

function prettyDate(date) {
  if (!date) return '';
  const dt = new Date(date + 'T12:00:00');
  if (Number.isNaN(dt.getTime())) return date;
  return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function digitsOnly(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }

function displayPhone(phone) {
  const d = digitsOnly(phone);
  if (d.length === 12 && d.startsWith('91')) return '+91 ' + d.slice(2, 7) + ' ' + d.slice(7);
  if (d.length === 10) return '+91 ' + d.slice(0, 5) + ' ' + d.slice(5);
  return phone || '';
}

function whatsappNumber(phone) {
  let d = digitsOnly(phone);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = '91' + d;
  return d;
}

function whatsappLink(phone, text) {
  return 'https://wa.me/' + whatsappNumber(phone) + '?text=' + encodeURIComponent(text);
}

function confirmationMessage(booking) {
  return 'Hello ' + booking.name + ', this is Sree Women\'s Clinic. Your appointment on '
    + prettyDate(booking.date) + ' at ' + prettyTime(booking.slot)
    + ' is confirmed. Please arrive 10 minutes early. Reply here if you need to reschedule. Thank you!';
}

function daysLabel(settings) {
  const days = (settings.days || []).slice().sort((a, b) => a - b);
  if (!days.length) return 'Schedule not set';
  if (days.length === 6 && days[0] === 1 && days[5] === 6) return 'Mon–Sat';
  if (days.length === 7) return 'Every day';
  return days.map((d) => DAYS[d]).join(', ');
}

function hoursLabel(settings) {
  return prettyTime(settings.start) + '–' + prettyTime(settings.end);
}

function hydrateSettings(raw) {
  return { ...DEFAULT_SETTINGS, ...(raw || {}) };
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

function backendMessage(text) {
  if (/setHeaders is not a function/i.test(text)) {
    return 'The Google Apps Script backend is running an old version that crashes on every request (setHeaders is not a function). Replace Code.gs with the corrected version and redeploy the Web App.';
  }
  if (/Authorization is required|You need access|Sign in|accounts\.google/i.test(text)) {
    return 'The Google Apps Script Web App is not public. Set "Who has access" to "Anyone" and redeploy.';
  }
  return 'The booking service returned an unexpected response. Check that the Web App deployment is correct.';
}

async function callApi(payload, options) {
  const opts = options || {};
  if (!SHEETS_URL) {
    return { ok: false, error: 'not_configured', message: 'The booking service URL is not configured for this build.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    let url = SHEETS_URL;
    const init = { method: 'GET', signal: controller.signal, cache: 'no-store', redirect: 'follow' };

    if (opts.get) {
      const qs = new URLSearchParams(payload).toString();
      url += (url.indexOf('?') === -1 ? '?' : '&') + qs;
    } else {
      init.method = 'POST';
      // text/plain keeps this a "simple request" so the browser never sends a
      // CORS preflight, which Apps Script cannot answer.
      init.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
      init.body = JSON.stringify(payload);
    }

    const res = await fetch(url, init);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      return { ok: false, error: 'bad_response', message: backendMessage(text), detail: text.slice(0, 300) };
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, error: 'bad_response', message: 'The booking service returned an unexpected response.' };
    }
    return data;
  } catch (err) {
    if (err && err.name === 'AbortError') {
      return { ok: false, error: 'timeout', message: 'The booking service took too long to respond. Please try again.' };
    }
    return { ok: false, error: 'network', message: 'Could not reach the booking service. Check your internet connection and try again.' };
  } finally {
    clearTimeout(timer);
  }
}

function isBackendIssue(result) {
  return result && [
    'backend_outdated', 'backend_private', 'bad_response', 'network', 'timeout', 'server_error', 'not_configured'
  ].indexOf(result.error) !== -1;
}

/* ------------------------------------------------------------------ */
/* Booking modal                                                       */
/* ------------------------------------------------------------------ */

function BookingModal({ settings, onClose }) {
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [avail, setAvail] = useState({ loading: false, slots: [], closed: false, reason: '', holidayName: '', error: '' });

  const minDate = todayLocal();
  const maxDate = addDaysLocal(minDate, 365);
  const today = todayLocal();

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!date) {
      setAvail({ loading: false, slots: [], closed: false, reason: '', holidayName: '', error: '' });
      return undefined;
    }
    let live = true;
    setAvail((a) => ({ ...a, loading: true, error: '' }));
    callApi({ action: 'getAvailability', date }, { get: true }).then((r) => {
      if (!live) return;
      if (r.ok) {
        setAvail({
          loading: false,
          slots: r.slots || [],
          closed: !!r.closed,
          reason: r.reason || '',
          holidayName: r.holidayName || '',
          error: ''
        });
      } else {
        setAvail({ loading: false, slots: [], closed: false, reason: '', holidayName: '', error: r.message || 'Could not load availability.' });
      }
    });
    return () => { live = false; };
  }, [date]);

  const nowMinutes = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); })();
  function isPastSlot(s) {
    if (date !== today) return false;
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m <= nowMinutes;
  }

  const openCount = avail.slots.filter((s) => s.status === 'open' && !isPastSlot(s.slot)).length;

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim() || name.trim().length < 2) { setError('Please enter the patient name.'); return; }
    const digits = digitsOnly(phone);
    if (digits.length < 10 || digits.length > 13) { setError('Please enter a valid mobile number.'); return; }
    if (!date || !slot) { setError('Please choose a date and time.'); return; }

    setSending(true);
    const result = await callApi({ action: 'book', date, slot, name: name.trim(), phone: phone.trim() });
    setSending(false);

    if (result.ok) {
      setDone({ ref: result.ref, date, slot, name: name.trim() });
      return;
    }

    setError(result.message || 'Could not send your request. Please try again.');
    if (['slot_taken', 'blocked', 'invalid_slot', 'past_slot', 'past_date', 'holiday', 'sunday', 'closed_day', 'extra_closed', 'disabled'].indexOf(result.error) !== -1) {
      setSlot('');
      const refreshed = await callApi({ action: 'getAvailability', date }, { get: true });
      if (refreshed.ok) {
        setAvail({
          loading: false,
          slots: refreshed.slots || [],
          closed: !!refreshed.closed,
          reason: refreshed.reason || '',
          holidayName: refreshed.holidayName || '',
          error: ''
        });
      }
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-label="Request an appointment">
        <button className="close" onClick={onClose} aria-label="Close"><X size={20} /></button>

        {done ? (
          <div className="success">
            <CheckCircle2 size={42} />
            <h2>Request sent</h2>
            <p>
              Thank you, {done.name}. Your request for <b>{prettyDate(done.date)}</b> at <b>{prettyTime(done.slot)}</b> has
              been sent to the clinic. The time is held while the clinic reviews it.
            </p>
            <p className="fine">Reference: {done.ref}. The clinic will confirm your appointment by phone or WhatsApp.</p>
            <button className="btn dark" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <span className="eyebrow">SREE WOMEN&rsquo;S CLINIC</span>
            <h2>Request an appointment</h2>
            <p className="muted">Choose a date and an available consultation time.</p>

            {!settings.enabled && (
              <div className="notice">
                <ShieldCheck size={18} /> Online booking is currently closed. Please contact the clinic.
              </div>
            )}

            <form onSubmit={submit}>
              <label>
                Appointment date
                <input
                  type="date"
                  min={minDate}
                  max={maxDate}
                  value={date}
                  onChange={(e) => { setDate(e.target.value); setSlot(''); setError(''); }}
                  required
                  disabled={!settings.enabled}
                />
              </label>

              <label>Available time slots</label>
              {!date ? (
                <p className="hint">Select a date to view available times.</p>
              ) : avail.loading ? (
                <p className="hint">Checking availability…</p>
              ) : avail.error ? (
                <div className="form-error">
                  <AlertTriangle size={15} /> {avail.error}
                </div>
              ) : avail.closed ? (
                <div className="notice">
                  <CalendarDays size={18} /> {closedText(avail)}
                </div>
              ) : avail.slots.length === 0 ? (
                <p className="hint">No consultation times are configured for this date.</p>
              ) : (
                <>
                  <div className="slots">
                    {avail.slots.map((s) => {
                      const past = isPastSlot(s.slot);
                      const disabled = s.status !== 'open' || past;
                      const cls = s.status === 'booked' ? 'booked' : s.status === 'blocked' ? 'blocked' : (slot === s.slot ? 'selected' : 'open');
                      return (
                        <button
                          type="button"
                          key={s.slot}
                          className={'slot ' + cls}
                          disabled={disabled}
                          onClick={() => { setSlot(s.slot); setError(''); }}
                          title={past ? 'This time has passed' : undefined}
                        >
                          <span className="slot-time">{prettyTime(s.slot)}</span>
                          <span className="slot-state">
                            {s.status === 'booked' ? 'Booked' : s.status === 'blocked' ? 'Blocked' : past ? 'Passed' : 'Available'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="legend">
                    <span><i className="dot-open" /> Available</span>
                    <span><i className="dot-booked" /> Booked</span>
                    <span><i className="dot-blocked" /> Blocked</span>
                  </div>
                  {openCount === 0 && (
                    <p className="hint">All times on this date are booked, blocked or have passed. Please choose another date.</p>
                  )}
                </>
              )}

              <div className="two">
                <label>
                  Patient name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    maxLength={80}
                    required
                    disabled={!settings.enabled}
                  />
                </label>
                <label>
                  Mobile number
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit number"
                    inputMode="tel"
                    maxLength={16}
                    required
                    disabled={!settings.enabled}
                  />
                </label>
              </div>

              {error && <div className="form-error"><AlertTriangle size={15} /> {error}</div>}

              <button
                className="btn dark full"
                disabled={sending || !settings.enabled || !date || !slot || !name.trim() || digitsOnly(phone).length < 10}
              >
                {sending ? 'Sending…' : <span>Request appointment <ChevronRight size={17} /></span>}
              </button>
              <p className="fine">Your name and number are used only to schedule and confirm this appointment.</p>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

function closedText(avail) {
  if (avail.reason === 'disabled') return 'Online booking is currently closed. Please contact the clinic.';
  if (avail.reason === 'sunday') return 'The clinic is closed on Sundays. Please choose Monday to Saturday.';
  if (avail.reason === 'holiday') return 'The clinic is closed on this date — ' + (avail.holidayName || 'public holiday') + '.';
  if (avail.reason === 'extra_closed') return 'The clinic is closed on this date. Please choose another date.';
  return 'The clinic is closed on this date. Please choose another date.';
}

/* ------------------------------------------------------------------ */
/* Staff portal                                                        */
/* ------------------------------------------------------------------ */

function StaffPortal({ settings, setSettings, onExit }) {
  const savedCode = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STAFF_KEY) : '';
  const [code, setCode] = useState(savedCode || '');
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(!!savedCode);
  const [passcode, setPasscode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [tab, setTab] = useState('bookings');
  const [backendIssue, setBackendIssue] = useState('');
  const [toast, setToast] = useState('');

  function flash(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 5000);
  }

  function logout(message) {
    sessionStorage.removeItem(STAFF_KEY);
    setCode('');
    setAuthed(false);
    setPasscode('');
    if (message) setLoginError(message);
  }

  function noteResult(result) {
    if (!result) return false;
    if (result.error === 'unauthorized') { logout('Your session has expired. Please sign in again.'); return true; }
    if (isBackendIssue(result)) setBackendIssue(result.message || 'The booking service is unavailable.');
    return false;
  }

  useEffect(() => {
    if (!savedCode) { setChecking(false); return; }
    callApi({ action: 'staffLogin', code: savedCode }).then((r) => {
      if (r.ok) { setCode(savedCode); setAuthed(true); }
      else { sessionStorage.removeItem(STAFF_KEY); setCode(''); }
      setChecking(false);
    });
  }, [savedCode]);

  async function login(e) {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    const result = await callApi({ action: 'staffLogin', code: passcode });
    setLoggingIn(false);
    if (result.ok) {
      sessionStorage.setItem(STAFF_KEY, passcode);
      setCode(passcode);
      setAuthed(true);
      setPasscode('');
    } else if (result.error === 'unauthorized') {
      setLoginError('Incorrect passcode.');
    } else {
      setLoginError(result.message || 'Could not sign in.');
    }
  }

  if (checking) {
    return <div className="portal"><p className="hint">Checking your session…</p></div>;
  }

  if (!authed) {
    return (
      <div className="portal">
        <div className="portal-login">
          <LockKeyhole size={22} />
          <h2>Sree Clinic — Staff Portal</h2>
          <p className="muted">Enter the clinic passcode to manage appointments.</p>
          <form onSubmit={login} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              placeholder="Passcode"
              value={passcode}
              onChange={(e) => { setPasscode(e.target.value); setLoginError(''); }}
              autoFocus
            />
            {loginError && <span className="form-error" style={{ justifyContent: 'center' }}>{loginError}</span>}
            <button className="btn dark full" disabled={loggingIn || !passcode}>
              {loggingIn ? 'Checking…' : 'Enter'}
            </button>
          </form>
          <a href="#top" className="portal-back" onClick={onExit}>Back to site</a>
        </div>
      </div>
    );
  }

  const shared = { code, noteResult, flash };

  return (
    <div className="portal">
      <div className="portal-header">
        <h2>Sree Clinic — Staff Portal</h2>
        <div className="portal-header-actions">
          <a href="#top" onClick={onExit}>Back to site</a>
          <button className="link-button" onClick={() => logout('')}><LogOut size={14} /> Log out</button>
        </div>
      </div>

      {backendIssue && (
        <div className="banner-error">
          <AlertTriangle size={16} />
          <div>
            <b>Backend problem</b>
            <p>{backendIssue}</p>
          </div>
          <button className="icon-button" onClick={() => setBackendIssue('')} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      <div className="tabs">
        <button className={tab === 'bookings' ? 'btn dark' : 'btn outline'} onClick={() => setTab('bookings')}>Appointments</button>
        <button className={tab === 'slots' ? 'btn dark' : 'btn outline'} onClick={() => setTab('slots')}>Slots</button>
        <button className={tab === 'settings' ? 'btn dark' : 'btn outline'} onClick={() => setTab('settings')}>Schedule</button>
      </div>

      {tab === 'bookings' && <BookingsTab {...shared} />}
      {tab === 'slots' && <SlotsTab {...shared} settings={settings} />}
      {tab === 'settings' && <SettingsTab {...shared} settings={settings} setSettings={setSettings} flash={flash} />}
    </div>
  );
}

function BookingsTab({ code, noteResult, flash }) {
  const [scope, setScope] = useState('upcoming');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [bookings, setBookings] = useState([]);
  const [counts, setCounts] = useState({ total: 0, new: 0, confirmed: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyRow, setBusyRow] = useState(0);

  async function load() {
    setLoading(true);
    setError('');
    const result = await callApi({
      action: 'getBookings',
      code,
      scope: date ? 'date' : scope,
      date: date || '',
      status,
      q: appliedQuery
    });
    setLoading(false);
    if (noteResult(result)) return;
    if (result.ok) {
      setBookings(result.bookings || []);
      setCounts(result.counts || { total: 0, new: 0, confirmed: 0 });
    } else {
      setError(result.message || 'Could not load appointments.');
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [scope, date, status, appliedQuery]);

  async function confirm(booking) {
    setBusyRow(booking.row);
    // Open a tab inside the click gesture so it is not blocked by the browser.
    const win = window.open('', '_blank');
    const result = await callApi({
      action: 'confirm',
      code,
      row: booking.row,
      date: booking.date,
      slot: booking.slot,
      name: booking.name,
      phone: booking.phone
    });
    setBusyRow(0);

    if (noteResult(result)) { if (win) win.close(); return; }
    if (!result.ok) {
      if (win) win.close();
      setError(result.message || 'Could not confirm this appointment.');
      return;
    }

    await load();
    flash('Appointment confirmed and slot blocked.');
    if (win) win.location.href = whatsappLink(booking.phone, confirmationMessage(booking));
    else setError('Confirmed. Allow pop-ups, or use the WhatsApp button on the row to message the patient.');
  }

  async function cancel(booking) {
    if (!window.confirm('Cancel the appointment for ' + booking.name + ' on ' + prettyDate(booking.date) + ' at ' + prettyTime(booking.slot) + '? The slot will be freed.')) return;
    setBusyRow(booking.row);
    const result = await callApi({ action: 'cancel', code, row: booking.row, date: booking.date, slot: booking.slot });
    setBusyRow(0);
    if (noteResult(result)) return;
    if (!result.ok) { setError(result.message || 'Could not cancel this appointment.'); return; }
    await load();
    flash(result.slotFreed ? 'Appointment cancelled. The slot is free again.' : 'Appointment cancelled.');
  }

  return (
    <div>
      <div className="filter-bar">
        <label>
          View
          <select value={scope} onChange={(e) => { setScope(e.target.value); setDate(''); }}>
            <option value="upcoming">Upcoming (default)</option>
            <option value="all">All dates</option>
          </select>
        </label>
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="new">Awaiting confirmation</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <form className="search-form" onSubmit={(e) => { e.preventDefault(); setAppliedQuery(query.trim()); }}>
          <label>
            Search
            <span className="search-wrap">
              <Search size={14} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or phone" />
            </span>
          </label>
          <button className="btn outline" type="submit">Search</button>
        </form>
        <button className="btn outline" onClick={() => { setDate(''); setQuery(''); setAppliedQuery(''); setStatus('all'); setScope('upcoming'); }}>
          <RefreshCw size={14} /> Reset
        </button>
      </div>

      {error && <div className="form-error"><AlertTriangle size={15} /> {error}</div>}

      <p className="summary-line">
        {loading ? 'Loading appointments…' : (
          <>
            <b>{counts.total}</b> shown · <b>{counts.new}</b> awaiting confirmation · <b>{counts.confirmed}</b> confirmed
            {date ? ' on ' + prettyDate(date) : scope === 'upcoming' ? ' (today onwards)' : ' (all dates)'}
          </>
        )}
      </p>

      {!loading && bookings.length === 0 ? (
        <div className="empty-state">
          <p>No appointments match these filters.</p>
          {scope === 'upcoming' && !date && (
            <button className="btn outline" onClick={() => { setScope('all'); setDate(''); }}>Show all dates</button>
          )}
        </div>
      ) : (
        <div className="portal-list">
          {bookings.map((b) => (
            <article className="portal-row" key={b.row}>
              <div className="who">
                <div className="row-title">
                  <span>{b.name || 'Unnamed patient'}</span>
                  <span className={'chip ' + b.status.toLowerCase()}>{STATUS_LABEL[b.status] || b.status}</span>
                </div>
                <div className="row-meta">
                  <span><CalendarDays size={13} /> {prettyDate(b.date)}</span>
                  <span><Clock3 size={13} /> {prettyTime(b.slot)}</span>
                  <span><Phone size={13} /> {displayPhone(b.phone)}</span>
                </div>
              </div>
              <div className="row-actions">
                {b.status !== 'Confirmed' && b.status !== 'Cancelled' && (
                  <button className="btn dark" disabled={busyRow === b.row} onClick={() => confirm(b)}>
                    {busyRow === b.row ? 'Confirming…' : 'Confirm'}
                  </button>
                )}
                {b.status !== 'Cancelled' && (
                  <button className="btn outline" disabled={busyRow === b.row} onClick={() => cancel(b)}>Cancel</button>
                )}
                <a className="btn outline" href={whatsappLink(b.phone, confirmationMessage(b))} target="_blank" rel="noreferrer">
                  <MessageCircle size={14} /> WhatsApp
                </a>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="config-note">
        Requests reserve the slot immediately. Confirming marks the patient confirmed and keeps the slot blocked.
        Cancelling frees the slot for other patients.
      </p>
    </div>
  );
}

function SlotsTab({ code, noteResult, flash, settings }) {
  const [date, setDate] = useState(todayLocal());
  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    const result = await callApi({ action: 'getDay', code, date });
    setLoading(false);
    if (noteResult(result)) return;
    if (result.ok) setDay(result);
    else setError(result.message || 'Could not load this date.');
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [date]);

  async function toggle(slot, isBlocked) {
    setBusy(slot);
    const result = await callApi({ action: isBlocked ? 'unblock' : 'block', code, date, slot });
    setBusy('');
    if (noteResult(result)) return;
    if (result.ok) { flash(isBlocked ? 'Slot unblocked.' : 'Slot blocked.'); await load(); }
    else setError(result.message || 'Could not update this slot.');
  }

  async function bulk(block) {
    const label = block ? 'Block' : 'Unblock';
    if (!window.confirm(label + ' all clinic slots on ' + prettyDate(date) + '?')) return;
    setBusy('day');
    const result = await callApi({ action: block ? 'blockDay' : 'unblockDay', code, date });
    setBusy('');
    if (noteResult(result)) return;
    if (!result.ok) { setError(result.message || 'Could not update the day.'); return; }
    await load();
    if (block) {
      flash(result.closed ? 'The clinic is closed on this date — nothing to block.' : 'Blocked ' + result.added + ' slot(s).');
    } else {
      flash('Unblocked ' + result.removed + ' slot(s).');
    }
  }

  async function bulkWeek(block) {
    const label = block ? 'Block' : 'Unblock';
    if (!window.confirm(label + ' all clinic slots for 7 days starting ' + prettyDate(date) + '?')) return;
    setBusy('week');
    const result = await callApi({ action: block ? 'blockWeek' : 'unblockWeek', code, date });
    setBusy('');
    if (noteResult(result)) return;
    if (!result.ok) { setError(result.message || 'Could not update the week.'); return; }
    await load();
    flash(block
      ? 'Blocked ' + result.added + ' slot(s) across ' + result.days + ' day(s).'
      : 'Unblocked ' + result.removed + ' slot(s) across ' + result.days + ' day(s).');
  }

  const slots = day && day.slots ? day.slots : [];
  const extra = day && day.extraBlocked ? day.extraBlocked : [];

  return (
    <div>
      <div className="filter-bar">
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button className="btn outline" onClick={() => setDate(todayLocal())}>Today</button>
        <button className="btn outline" disabled={busy === 'day'} onClick={() => bulk(true)}>
          <Ban size={14} /> {busy === 'day' ? 'Working…' : 'Block entire day'}
        </button>
        <button className="btn outline" disabled={busy === 'day'} onClick={() => bulk(false)}>Unblock entire day</button>
        <button className="btn outline" disabled={busy === 'week'} onClick={() => bulkWeek(true)}>
          <Ban size={14} /> {busy === 'week' ? 'Working…' : 'Block next 7 days'}
        </button>
        <button className="btn outline" disabled={busy === 'week'} onClick={() => bulkWeek(false)}>Unblock next 7 days</button>
      </div>

      {error && <div className="form-error"><AlertTriangle size={15} /> {error}</div>}

      {loading ? (
        <p className="hint">Loading…</p>
      ) : day && day.closed ? (
        <div className="notice">
          <CalendarDays size={18} /> {closedText(day)}
          <span className="notice-sub">Clinic hours: {daysLabel(settings)} · {hoursLabel(settings)}</span>
        </div>
      ) : slots.length === 0 && extra.length === 0 ? (
        <div className="empty-state">
          <p>No consultation times are configured for this date.</p>
          <p className="hint">Check the Schedule tab, then try again.</p>
        </div>
      ) : (
        <div className="portal-list">
          {slots.map((s) => (
            <div className={'portal-row slot-row ' + s.status} key={s.slot}>
              <div className="who">
                <div className="row-title">
                  <span>{prettyTime(s.slot)}</span>
                  <span className={'chip ' + s.status}>{s.status === 'booked' ? 'Booked' : s.status === 'blocked' ? 'Blocked' : 'Open'}</span>
                </div>
                {s.status === 'booked' && (
                  <div className="row-meta">
                    <span>{s.name || 'Patient'}</span>
                    <span><Phone size={13} /> {displayPhone(s.phone)}</span>
                    <span>{s.bookingStatus}</span>
                  </div>
                )}
              </div>
              <div className="row-actions">
                {s.status !== 'booked' && (
                  <button className="btn outline" disabled={busy === s.slot} onClick={() => toggle(s.slot, s.status === 'blocked')}>
                    {busy === s.slot ? '…' : s.status === 'blocked' ? 'Unblock' : (<><Ban size={14} /> Block</>)}
                  </button>
                )}
                {s.status === 'booked' && <span className="config-note">Cancel the appointment to free this slot.</span>}
              </div>
            </div>
          ))}
          {extra.map((s) => (
            <div className="portal-row slot-row blocked" key={'extra-' + s.slot}>
              <div className="who">
                <div className="row-title">
                  <span>{prettyTime(s.slot)}</span>
                  <span className="chip blocked">Blocked (outside current hours)</span>
                </div>
              </div>
              <div className="row-actions">
                <button className="btn outline" disabled={busy === s.slot} onClick={() => toggle(s.slot, true)}>Unblock</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="legend" style={{ marginTop: 16 }}>
        <span><i className="dot-open" /> Open</span>
        <span><i className="dot-booked" /> Booked</span>
        <span><i className="dot-blocked" /> Blocked</span>
      </div>
      <p className="config-note">Blocked and booked slots are hidden from patients on the public booking form.</p>
    </div>
  );
}

function SettingsTab({ code, noteResult, flash, settings, setSettings }) {
  const [draft, setDraft] = useState(hydrateSettings(settings));
  const [closedTextValue, setClosedTextValue] = useState((settings.extraClosedDates || []).join(', '));
  const [holidays, setHolidays] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    callApi({ action: 'getSettings', code }).then((result) => {
      setLoading(false);
      if (noteResult(result)) return;
      if (result.ok) {
        const fresh = hydrateSettings(result.settings);
        setDraft(fresh);
        setSettings(fresh);
        setClosedTextValue((fresh.extraClosedDates || []).join(', '));
        setHolidays(result.holidays || {});
      } else {
        setError(result.message || 'Could not load the schedule.');
      }
    });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  function update(patch) {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
  }

  function toggleDay(index) {
    setDraft((d) => {
      const has = d.days.indexOf(index) !== -1;
      return { ...d, days: has ? d.days.filter((x) => x !== index) : d.days.concat(index) };
    });
    setSaved(false);
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    const dates = closedTextValue.split(/[,\s]+/).map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
    if (closedTextValue.trim() && dates.length === 0) {
      setError('Closed dates must look like 2026-12-31, separated by commas.');
      return;
    }
    const payload = { ...draft, extraClosedDates: dates };
    setSaving(true);
    const result = await callApi({ action: 'saveSettings', code, settings: payload });
    setSaving(false);
    if (noteResult(result)) return;
    if (!result.ok) { setError(result.message || 'Could not save the schedule.'); return; }
    const fresh = hydrateSettings(result.settings);
    setDraft(fresh);
    setSettings(fresh);
    setClosedTextValue((fresh.extraClosedDates || []).join(', '));
    setSaved(true);
    flash('Schedule saved. Patients see the new hours immediately.');
  }

  const holidayEntries = useMemo(() => Object.keys(holidays).sort().map((d) => [d, holidays[d]]), [holidays]);

  if (loading) return <p className="hint">Loading schedule…</p>;

  return (
    <form className="settings-form" onSubmit={save}>
      <div className="notice">
        <ShieldCheck size={18} /> Changes take effect immediately on the public booking form.
      </div>

      <label className="switchline">
        Accept online appointment requests
        <input type="checkbox" checked={draft.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
      </label>

      <label>Consultation days</label>
      <div className="days">
        {DAYS.map((d, i) => (
          <button type="button" key={d} className={draft.days.indexOf(i) !== -1 ? 'day active' : 'day'} onClick={() => toggleDay(i)}>{d}</button>
        ))}
      </div>

      <div className="two">
        <label>
          Opening time
          <input type="time" value={draft.start} onChange={(e) => update({ start: e.target.value })} required />
        </label>
        <label>
          Closing time
          <input type="time" value={draft.end} onChange={(e) => update({ end: e.target.value })} required />
        </label>
      </div>

      <div className="two">
        <label>
          Appointment duration
          <select value={draft.duration} onChange={(e) => update({ duration: Number(e.target.value) })}>
            {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </label>
        <label>
          Buffer between patients (min)
          <input type="number" min="0" max="60" value={draft.buffer} onChange={(e) => update({ buffer: Number(e.target.value) })} />
        </label>
      </div>

      <div className="two">
        <label>
          Break starts (optional)
          <input type="time" value={draft.breakStart} onChange={(e) => update({ breakStart: e.target.value })} />
        </label>
        <label>
          Break ends (optional)
          <input type="time" value={draft.breakEnd} onChange={(e) => update({ breakEnd: e.target.value })} />
        </label>
      </div>

      <div className="two">
        <label>
          Consultation fee (optional)
          <input value={draft.fee} maxLength={40} onChange={(e) => update({ fee: e.target.value })} placeholder="e.g. ₹600" />
        </label>
        <label>
          Extra closed dates
          <input value={closedTextValue} onChange={(e) => { setClosedTextValue(e.target.value); setSaved(false); }} placeholder="2026-12-31, 2027-01-01" />
        </label>
      </div>

      <label className="switchline">
        Stay open on gazetted public holidays
        <input type="checkbox" checked={draft.ignoreHolidays} onChange={(e) => update({ ignoreHolidays: e.target.checked })} />
      </label>
      <p className="config-note">Leave this off to close automatically on India's gazetted holidays.</p>

      {error && <div className="form-error"><AlertTriangle size={15} /> {error}</div>}
      {saved && <div className="form-ok"><CheckCircle2 size={15} /> Schedule saved.</div>}

      <button className="btn dark full" disabled={saving}>{saving ? 'Saving…' : 'Save schedule'}</button>

      {holidayEntries.length > 0 && (
        <details className="holiday-details">
          <summary>View gazetted holiday closures ({holidayEntries.length})</summary>
          <div className="holiday-list">
            {holidayEntries.map(([d, name]) => (
              <span key={d}><b>{prettyDate(d)}</b> · {name}</span>
            ))}
          </div>
        </details>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Main site                                                           */
/* ------------------------------------------------------------------ */

export default function App() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [route, setRoute] = useState(() => window.location.hash);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    callApi({ action: 'getConfig' }, { get: true }).then((result) => {
      if (result.ok && result.settings) setSettings(hydrateSettings(result.settings));
    });
  }, []);

  if (route.indexOf('#/sree-clinic-admin') === 0) {
    return (
      <StaffPortal
        settings={settings}
        setSettings={setSettings}
        onExit={() => { window.location.hash = '#top'; }}
      />
    );
  }

  const sree = LOCATIONS[2];

  return (
    <main>
      <header className="nav">
        <a className="brand" href="#top">SV<span>.</span></a>
        <nav className={menu ? 'open' : ''}>
          <a href="#about" onClick={() => setMenu(false)}>About</a>
          <a href="#expertise" onClick={() => setMenu(false)}>Areas of care</a>
          <a href="#locations" onClick={() => setMenu(false)}>Locations</a>
          <a href="#contact" onClick={() => setMenu(false)}>Contact</a>
        </nav>
        <a className="nav-cta" href="#locations">Book a consultation <ArrowUpRight size={15} /></a>
        <button className="mobile-menu" onClick={() => setMenu(!menu)} aria-label="Toggle menu">{menu ? <X /> : <Menu />}</button>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow"><span className="dot" /> WOMEN’S HEALTH · BENGALURU</span>
          <h1>Care that understands <em>every stage</em> of womanhood.</h1>
          <p className="lead">Personalised obstetric and gynaecological care, grounded in clinical experience and thoughtful guidance.</p>
          <div className="hero-actions">
            <a className="btn dark" href="#locations">Find a consultation <ArrowUpRight size={17} /></a>
            <a className="text-link" href="#about">Meet the doctor <ChevronRight size={16} /></a>
          </div>
          <div className="hero-proof">
            <div><strong>21+</strong><span>Years of experience</span></div>
            <i />
            <div><strong>6</strong><span>Languages spoken</span></div>
            <i />
            <div><strong>3</strong><span>Consultation locations</span></div>
          </div>
        </div>
        <div className="portrait-wrap">
          <div className="portrait-frame">
            <img src={PROFILE.photo} alt="Dr. Swetha Vinjamuri" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <div className="portrait-fallback">Dr. Swetha<br />Vinjamuri</div>
          </div>
          <div className="portrait-caption">
            <span>DR. SWETHA VINJAMURI</span>
            <small>Obstetrician &amp; Gynaecologist</small>
          </div>
          <div className="floating-note">
            <HeartPulse size={18} />
            <span>Evidence-based care<br /><b>with a personal touch</b></span>
          </div>
        </div>
      </section>

      <section className="ticker">
        <span>OBSTETRICS</span><b>✳</b><span>GYNAECOLOGY</span><b>✳</b><span>WOMEN’S WELLNESS</span><b>✳</b><span>REPRODUCTIVE HEALTH</span>
      </section>

      <section className="section about" id="about">
        <div className="section-kicker">01 / ABOUT THE DOCTOR</div>
        <div className="about-grid">
          <h2>Clinical experience.<br /><em>Human connection.</em></h2>
          <div>
            <p className="body-lg">Dr. Swetha Vinjamuri is an Obstetrician and Gynaecologist with over 21 years of clinical experience in Bengaluru. Her practice spans pregnancy care, reproductive health and gynaecological concerns.</p>
            <p className="muted">Her approach centres on listening carefully, understanding individual needs and providing clear, evidence-based guidance so patients can make informed decisions about their health.</p>
            <div className="credential">
              <GraduationCap />
              <div><b>Qualifications</b><span>{PROFILE.qualifications.join('  ·  ')}</span></div>
            </div>
            <div className="credential">
              <ShieldCheck />
              <div><b>Professional registration</b><span>{PROFILE.registration} · Memberships: BSOG and Indian Menopause Society</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section expertise" id="expertise">
        <div className="section-kicker">02 / AREAS OF CARE</div>
        <div className="section-head">
          <h2>Support through <em>every chapter.</em></h2>
          <p>Comprehensive care across reproductive, obstetric and gynaecological health.</p>
        </div>
        <div className="care-grid">
          {PROFILE.specialities.map((s, i) => (
            <article className="care-card" key={s}>
              <span>0{i + 1}</span>
              <div className="care-icon">{i === 0 ? <HeartPulse /> : i === 1 ? <Stethoscope /> : <ShieldCheck />}</div>
              <h3>{s}</h3>
              <p>Individualised consultation and guidance based on clinical assessment and patient needs.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section locations" id="locations">
        <div className="section-kicker">03 / CONSULTATION LOCATIONS</div>
        <div className="section-head">
          <h2>Choose where you’d<br /><em>like to be seen.</em></h2>
          <p>Three consultation options. Select the location that works best for you.</p>
        </div>
        <div className="location-grid">
          {LOCATIONS.map((l) => (
            <article className={l.id === 'sree' ? 'location-card featured' : 'location-card'} key={l.id}>
              <div className="loc-top">
                <span>{l.no} / BENGALURU</span>
                {l.id === 'sree' && <span className="pill">DIRECT BOOKING</span>}
              </div>
              <MapPin className="loc-icon" />
              <h3>{l.name}</h3>
              <h4>{l.area}</h4>
              <p>{l.address}</p>
              <div className="loc-bottom">
                <small>{l.id === 'sree' ? daysLabel(settings) + ' · ' + hoursLabel(settings) : l.detail}</small>
                {l.external ? (
                  <a className="btn outline" href={l.link} target="_blank" rel="noreferrer">Visit booking page <ArrowUpRight size={16} /></a>
                ) : (
                  <button className="btn dark" onClick={() => setBookingOpen(true)}>Request appointment <ArrowUpRight size={16} /></button>
                )}
              </div>
            </article>
          ))}
        </div>
        <p className="location-note">Online requests for Sree Women’s Clinic are reviewed by the clinic. Your appointment is confirmed by phone or WhatsApp. Cloudnine appointments are handled by Cloudnine.</p>
      </section>

      <section className="section languages">
        <div>
          <div className="section-kicker">04 / COMMUNICATION</div>
          <h2>Care in a language<br /><em>you’re comfortable with.</em></h2>
        </div>
        <div className="language-list">
          {PROFILE.languages.map((x) => <span key={x}><Languages size={15} /> {x}</span>)}
        </div>
      </section>

      <section className="section contact" id="contact">
        <div>
          <span className="eyebrow light">YOUR HEALTH, YOUR QUESTIONS</span>
          <h2>Start with<br /><em>a conversation.</em></h2>
          <p>Choose a consultation location to view the appropriate appointment route.</p>
          <a className="btn light-btn" href="#locations">Explore locations <ArrowUpRight size={17} /></a>
        </div>
        <div className="contact-side">
          <div>
            <Phone />
            <span><small>Cloudnine appointment assistance</small><br /><b>+91 99728 99728</b></span>
          </div>
          <div>
            <MapPin />
            <span><small>Practice locations</small><br /><b>HRBR Layout · Thanisandra</b></span>
          </div>
          <div>
            <CalendarDays />
            <span><small>Sree Women’s Clinic</small><br /><b>{daysLabel(settings)} · {hoursLabel(settings)}</b></span>
          </div>
        </div>
      </section>

      <footer>
        <a className="brand" href="#top">SV<span>.</span></a>
        <p>Dr. Swetha Vinjamuri · Obstetrician &amp; Gynaecologist · Bengaluru</p>
        <span style={{ display: 'flex', gap: 14 }}>
          <a className="admin-link" href="#/sree-clinic-admin">Clinic staff portal</a>
        </span>
        <span>© {new Date().getFullYear()} · All rights reserved</span>
      </footer>

      {bookingOpen && <BookingModal settings={settings} onClose={() => setBookingOpen(false)} />}
    </main>
  );
}
