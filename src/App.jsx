import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, MapPin, Phone, ArrowUpRight, Menu, X, CheckCircle2, Stethoscope, Languages, GraduationCap, HeartPulse, ShieldCheck, ChevronRight, LockKeyhole, Ban } from 'lucide-react';
import doctorPhoto from './assets/dr-swetha.jpg';

const SHEETS_URL = import.meta.env.VITE_SHEETS_WEBAPP_URL || '';
const ADMIN_PASSCODE = import.meta.env.VITE_ADMIN_PASSCODE || 'sree2026';

async function postToSheet(payload) {
  if (!SHEETS_URL) return { ok: false, error: 'not_configured' };
  try {
    const res = await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { ok: res.ok, raw: text }; }
  } catch { return { ok: false, error: 'network' }; }
}
async function fetchBlocked(date) {
  if (!SHEETS_URL) return [];
  try {
    const res = await fetch(`${SHEETS_URL}?action=getBlocked${date ? '&date=' + date : ''}`);
    const data = await res.json();
    return data.ok ? data.blocked.map(b => b.slot) : [];
  } catch { return []; }
}
async function fetchBookings(date) {
  if (!SHEETS_URL) return [];
  try {
    const res = await fetch(`${SHEETS_URL}?action=getBookings${date ? '&date=' + date : ''}`);
    const data = await res.json();
    return data.ok ? data.bookings : [];
  } catch { return []; }
}
function whatsappLink(phone, text) {
  return 'https://wa.me/' + phone.replace(/\D/g, '') + '?text=' + encodeURIComponent(text);
}

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
  { id: 'sree', no: '03', name: "Sree Women's Clinic", area: 'Thanisandra / Meganahalli', address: 'Clinic address and map pin to be confirmed by the clinic.', type: 'Direct clinic appointment', detail: 'Book directly through the integrated appointment request.', external: false }
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const INDIA_PUBLIC_HOLIDAYS = [
  '2026-01-26', '2026-03-04', '2026-03-21', '2026-03-26', '2026-03-31', '2026-04-03',
  '2026-05-01', '2026-05-27', '2026-06-26', '2026-08-15', '2026-08-26', '2026-09-04',
  '2026-10-02', '2026-10-20', '2026-11-08', '2026-11-24', '2026-12-25',
  '2027-01-26', '2027-03-10', '2027-03-23', '2027-03-26', '2027-04-15', '2027-04-19',
  '2027-05-17', '2027-05-20', '2027-06-16', '2027-08-15', '2027-08-25', '2027-10-02',
  '2027-10-09', '2027-10-29', '2027-11-14', '2027-12-25'
];
const HOLIDAY_NAMES = {
  '2026-01-26': 'Republic Day', '2026-03-04': 'Holi', '2026-03-21': 'Id-ul-Fitr',
  '2026-03-26': 'Ram Navami', '2026-03-31': 'Mahavir Jayanti', '2026-04-03': 'Good Friday',
  '2026-05-01': 'Buddha Purnima', '2026-05-27': 'Id-ul-Zuha / Bakrid', '2026-06-26': 'Muharram',
  '2026-08-15': 'Independence Day', '2026-08-26': 'Milad-un-Nabi', '2026-09-04': 'Janmashtami',
  '2026-10-02': "Mahatma Gandhi's Birthday", '2026-10-20': 'Dussehra / Vijayadashami',
  '2026-11-08': 'Diwali / Deepavali', '2026-11-24': "Guru Nanak's Birthday",
  '2026-12-25': 'Christmas Day', '2027-01-26': 'Republic Day', '2027-03-10': 'Id-ul-Fitr',
  '2027-03-23': 'Holi', '2027-03-26': 'Good Friday', '2027-04-15': 'Ram Navami',
  '2027-04-19': 'Mahavir Jayanti', '2027-05-17': 'Id-ul-Zuha / Bakrid',
  '2027-05-20': 'Buddha Purnima', '2027-06-16': 'Muharram', '2027-08-15': 'Independence Day',
  '2027-08-25': 'Janmashtami', '2027-10-02': "Mahatma Gandhi's Birthday",
  '2027-10-09': 'Dussehra / Vijayadashami', '2027-10-29': 'Diwali / Deepavali',
  '2027-11-14': "Guru Nanak's Birthday", '2027-12-25': 'Christmas Day'
};
const isHoliday = (date) => INDIA_PUBLIC_HOLIDAYS.includes(date);
const holidayName = (date) => HOLIDAY_NAMES[date] || 'Public holiday';
function getUnavailabilityReason(date, cfg) {
  if (!cfg.enabled) return 'booking_not_enabled';
  if (!date) return null;
  const d = new Date(date + 'T12:00:00');
  if (!cfg.days.includes(d.getDay())) return 'clinic_closed_sunday';
  if (isHoliday(date)) return 'public_holiday';
  return null;
}
const DEFAULT_CONFIG = { enabled: true, days: [1, 2, 3, 4, 5, 6], start: '14:00', end: '17:00', duration: 15, breakStart: '', breakEnd: '', buffer: 0, fee: '', holdMinutes: 5 };

function makeSlots(date, cfg) {
  if (!cfg.enabled || !date || !cfg.start || !cfg.end) return [];
  const d = new Date(date + 'T12:00:00');
  if (!cfg.days.includes(d.getDay())) return [];
  if (isHoliday(date)) return [];
  const toMin = (v) => { const [h, m] = v.split(':').map(Number); return h * 60 + m; };
  const from = toMin(cfg.start), to = toMin(cfg.end), step = Number(cfg.duration) + Number(cfg.buffer);
  if (!Number.isFinite(step) || step <= 0) return [];
  const out = [];
  for (let t = from; t + Number(cfg.duration) <= to; t += step) {
    if (cfg.breakStart && cfg.breakEnd && t < toMin(cfg.breakEnd) && t + Number(cfg.duration) > toMin(cfg.breakStart)) continue;
    out.push(String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'));
  }
  return out;
}
const pretty = (t) => new Date('2000-01-01T' + t + ':00').toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

function BookingModal({ onClose, config }) {
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState([]);
  const [booked, setBooked] = useState([]);
  const allSlots = useMemo(() => makeSlots(date, config), [date, config]);
  const unavailabilityReason = useMemo(() => getUnavailabilityReason(date, config), [date, config]);
  const minDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  function renderSlots() {
    return allSlots.map((s) => {
      const isBlocked = blocked.includes(s);
      const isBooked = booked.some((b) => b.slot === s);
      return (
        <button type="button" key={s}
          className={isBooked ? 'slot booked' : isBlocked ? 'slot blocked' : slot === s ? 'slot selected' : 'slot open'}
          onClick={isBooked || isBlocked ? undefined : () => setSlot(s)}
          disabled={isBooked || isBlocked}
        >
          {isBooked ? 'Booked' : isBlocked ? 'Blocked' : pretty(s)}
        </button>
      );
    });
  }

  useEffect(() => {
    if (!date) { setBlocked([]); setBooked([]); return; }
    let live = true;
    fetchBlocked(date).then((b) => { if (live) setBlocked(b); });
    fetchBookings(date).then((b) => { if (live) setBooked(b.filter((x) => x.status !== 'Confirmed')); });
    return () => { live = false; };
  }, [date]);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || phone.replace(/\D/g, '').length < 10 || !date || !slot) return;
    setSending(true);
    await postToSheet({ action: 'book', date: date, slot: slot, name: name.trim(), phone: phone.trim() });
    setSending(false);
    setDone(true);
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="modal">
        <button className="close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        {done ? (
          <div className="success">
            <CheckCircle2 size={42} />
            <h2>Request sent</h2>
            <p>{SHEETS_URL ? 'Your request has been recorded. The clinic will confirm your appointment by phone.' : 'This prototype is not yet connected to a live sheet (VITE_SHEETS_WEBAPP_URL is unset), so nothing was actually saved.'}</p>
            <button className="btn dark" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <span className="eyebrow">SREE WOMEN’S CLINIC</span>
            <h2>Request an appointment</h2>
            <p className="muted">Choose a date and an available consultation time.</p>
            {!config.enabled && (
              <div className="notice">
                <ShieldCheck size={18} /> Online booking is being configured. The clinic must confirm its consultation schedule before appointments can be accepted.
              </div>
            )}
            {unavailabilityReason === 'public_holiday' && (
              <div className="notice">
                <CalendarDays size={18} /> Clinic closed on {date} — {holidayName(date)} (public holiday).
              </div>
            )}
            {unavailabilityReason === 'clinic_closed_sunday' && (
              <div className="notice">
                <CalendarDays size={18} /> Clinic is closed on Sundays. Please choose Monday–Saturday.
              </div>
            )}
            <form onSubmit={submit}>
              <label>
                Appointment date
                <input type="date" min={minDate} value={date} onChange={(e) => { setDate(e.target.value); setSlot(''); }} required disabled={!config.enabled} />
              </label>
              <label>Available time slots</label>
              {!date ? (
                <p className="hint">Select a date to view slots.</p>
              ) : allSlots.length === 0 && !unavailabilityReason ? (
                <p className="hint">No configured slots for this date. Please contact the clinic.</p>
              ) : (
                <div className="slots">{renderSlots()}</div>
              )}
              <div className="two">
                <label>
                  Patient name
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required disabled={!config.enabled} />
                </label>
                <label>
                  Mobile number
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit number" inputMode="tel" required disabled={!config.enabled} />
                </label>
              </div>
              <button className="btn dark full" disabled={sending || !config.enabled || !date || !slot || !name.trim() || phone.replace(/\D/g, '').length < 10}>
                {sending ? 'Sending…' : <span>Continue <ChevronRight size={17} /></span>}
              </button>
              <p className="fine">Your details should be handled through a secure, access-controlled booking service once backend integration is enabled.</p>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

function PatientBookingRow({ booking, sendingMsg, sendWhatsApp, confirmBooking }) {
  const isConfirmed = booking.status === 'Confirmed';
  return (
    <div className="portal-slot">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>
          <span>{booking.name}</span>
          <span style={{ color: 'var(--muted)' }}>{booking.date} • {booking.slot}</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{booking.phone}</div>
        <div style={{ fontSize: 10, color: isConfirmed ? '#4a7c59' : '#b4493a', fontWeight: 700, marginTop: 2 }}>Status: {booking.status}</div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {!isConfirmed && (
          <button className="btn outline" disabled={sendingMsg === booking.phone} onClick={() => confirmBooking(booking)} style={{ fontSize: 10, padding: '6px 10px' }}>
            {sendingMsg === booking.phone ? 'Sending…' : 'Confirm'}
          </button>
        )}
        <button className="btn outline" onClick={() => sendWhatsApp(booking)} style={{ fontSize: 10, padding: '6px 10px' }}>
          {sendingMsg === booking.phone ? 'Sending…' : 'WhatsApp'}
        </button>
      </div>
    </div>
  );
}

function BookingsList({ bookingsDate, setBookingsDate, bookings, bookingsLoading, sendingMsg, sendWhatsApp, confirmBooking }) {
  return (
    <div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 11, fontWeight: 700, maxWidth: 220 }}>
        Filter by date
        <input type="date" value={bookingsDate} onChange={(e) => { setBookingsDate(e.target.value); }} />
      </label>
      {bookingsLoading ? (
        <p className="hint">Loading bookings…</p>
      ) : bookings.length === 0 ? (
        <p className="hint">No bookings for {bookingsDate || 'today'}.</p>
      ) : (
        <div>
          <p className="hint" style={{ marginBottom: 10 }}>{bookings.length} booking{bookings.length !== 1 ? 's' : ''} on {bookingsDate}</p>
          <div className="portal-grid">
            {bookings.map((b) => (
              <PatientBookingRow key={b.timestamp + b.slot} booking={b} sendingMsg={sendingMsg} sendWhatsApp={sendWhatsApp} confirmBooking={confirmBooking} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SreeAdminPortal({ config, setConfig }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('sreeAdminOk') === '1');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [date, setDate] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busySlot, setBusySlot] = useState('');
  const [view, setView] = useState('slots');
  const [bookingsDate, setBookingsDate] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [sendingMsg, setSendingMsg] = useState('');
  const allSlots = useMemo(() => makeSlots(date, config), [date, config]);

  function login(e) {
    e.preventDefault();
    if (code === ADMIN_PASSCODE) { sessionStorage.setItem('sreeAdminOk', '1'); setAuthed(true); } else setErr('Incorrect passcode.');
  }
  async function refresh() {
    setLoading(true);
    setBlocked(await fetchBlocked(date));
    setLoading(false);
  }
  useEffect(() => { if (authed) refresh(); }, [authed, date]);

  async function toggle(slot) {
    setBusySlot(slot);
    const isBlocked = blocked.includes(slot);
    const result = await postToSheet({ action: isBlocked ? 'unblock' : 'block', date: date, slot: slot });
    if (result.ok) {
      await refresh();
    } else {
      alert('Failed to ' + (isBlocked ? 'unblock' : 'block') + ' slot. Please check the Google Sheets Web App URL is deployed with CORS headers.');
    }
    setBusySlot('');
  }

  async function loadBookings() {
    setBookingsLoading(true);
    setBookings(await fetchBookings(bookingsDate));
    setBookingsLoading(false);
  }
  useEffect(() => { if (authed && view === 'bookings') loadBookings(); }, [authed, view, bookingsDate]);

  async function sendWhatsApp(b) {
    setSendingMsg(b.phone);
    const text = 'Hello ' + b.name + ', this is Sree Women\'s Clinic. Your appointment on ' + b.date + ' at ' + b.slot + ' has been confirmed. Please save this date. Thank you!';
    window.open(whatsappLink(b.phone, text), '_blank');
    setSendingMsg('');
  }

  async function confirmBooking(b) {
    setSendingMsg(b.phone);
    const result = await postToSheet({ action: 'confirm', date: b.date, slot: b.slot, name: b.name, phone: b.phone });
    if (result.ok) {
      setBookings(await fetchBookings(bookingsDate));
    } else {
      alert('Failed to confirm booking. Please check the Google Sheets Web App URL.');
    }
    setSendingMsg('');
    const text = 'Hello ' + b.name + ', this is Sree Women\'s Clinic. Your appointment on ' + b.date + ' at ' + b.slot + ' has been confirmed. Please save this date. Thank you!';
    window.open(whatsappLink(b.phone, text), '_blank');
  }

  async function blockEntireDay() {
    if (!window.confirm('Block ALL slots for ' + date + '?')) return;
    setBusySlot('all');
    const results = await Promise.all(allSlots.map(async (s) => {
      const isBlocked = blocked.includes(s);
      if (!isBlocked) {
        await postToSheet({ action: 'block', date: date, slot: s });
      }
    }));
    await refresh();
    setBusySlot('');
  }

  async function blockEntireWeek() {
    if (!window.confirm('Block ALL slots for the next 7 days starting ' + date + '?')) return;
    setBusySlot('week');
    const base = new Date(date + 'T12:00:00');
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const dStr = d.toISOString().slice(0, 10);
      const dSlots = makeSlots(dStr, config);
      const dBlocked = await fetchBlocked(dStr);
      for (const s of dSlots) {
        if (!dBlocked.includes(s)) {
          await postToSheet({ action: 'block', date: dStr, slot: s });
        }
      }
    }
    await refresh();
    setBusySlot('');
  }

  if (!authed) {
    return (
      <div className="portal">
        <div className="portal-login">
          <LockKeyhole size={22} />
          <h2>Sree Clinic — Staff Portal</h2>
          <p className="muted">Enter the clinic passcode to manage appointments.</p>
          <form onSubmit={login} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="password" placeholder="Passcode" value={code} onChange={(e) => { setCode(e.target.value); setErr(''); }} autoFocus />
            {err && <span style={{ color: '#b4493a', fontSize: 11 }}>{err}</span>}
            <button className="btn dark full">Enter</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="portal">
      <div className="portal-header">
        <h2 style={{ margin: 0, font: '500 26px var(--serif)' }}>Sree Clinic — Staff Portal</h2>
        <a href="#top">Back to site</a>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <button className={view === 'slots' ? 'btn dark' : 'btn outline'} onClick={() => setView('slots')}>Slot Blocking</button>
        <button className={view === 'bookings' ? 'btn dark' : 'btn outline'} onClick={() => setView('bookings')}>Patient Bookings</button>
        <button className={view === 'schedule' ? 'btn dark' : 'btn outline'} onClick={() => setView('schedule')}>Schedule Setup</button>
      </div>
      {!SHEETS_URL && (
        <div className="notice">
          <ShieldCheck size={18} /> VITE_SHEETS_WEBAPP_URL isn't set. Data won't persist. Set it in GitHub repo secrets or .env.
        </div>
      )}
      {view === 'slots' && (
        <div>
          {!config.enabled && (
            <div className="notice">
              <ShieldCheck size={18} /> Online booking isn't enabled yet. Turn it on in Schedule Setup.
            </div>
          )}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 11, fontWeight: 700, maxWidth: 220 }}>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <button className="btn outline" disabled={busySlot === 'all' || loading} onClick={blockEntireDay}>
              {busySlot === 'all' ? 'Blocking…' : 'Block Entire Day'}
            </button>
            <button className="btn outline" disabled={busySlot === 'week' || loading} onClick={blockEntireWeek}>
              {busySlot === 'week' ? 'Blocking…' : 'Block Entire Week'}
            </button>
          </div>
          {loading ? (
            <p className="hint">Loading…</p>
          ) : allSlots.length === 0 ? (
            <p className="hint">No clinic slots configured for this date.</p>
          ) : (
            <div className="portal-grid">
              {allSlots.map((s) => {
                const isBlocked = blocked.includes(s);
                return (
                  <div className={isBlocked ? 'portal-slot blocked' : 'portal-slot'} key={s}>
                    <span>{pretty(s)}</span>
                    <button className="btn outline" disabled={busySlot === s || loading} onClick={() => toggle(s)}>
                      {busySlot === s ? '…' : isBlocked ? <span><Ban size={13} /> Unblock</span> : 'Block'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <p className="config-note">Blocked slots are removed from what patients see on the public booking form for this date.</p>
        </div>
      )}
      {view === 'bookings' && (
        <BookingsList
          bookingsDate={bookingsDate}
          setBookingsDate={setBookingsDate}
          bookings={bookings}
          bookingsLoading={bookingsLoading}
          sendingMsg={sendingMsg}
          sendWhatsApp={sendWhatsApp}
          confirmBooking={confirmBooking}
        />
      )}
      {view === 'schedule' && (
        <div>
          <label className="switchline">
            Enable booking preview
            <input type="checkbox" checked={config.enabled} onChange={(e) => setConfig((c) => ({ ...c, enabled: e.target.checked }))} />
          </label>
          <label>Consultation days</label>
          <div className="days">{DAYS.map((d, i) => (
            <button key={d} onClick={() => setConfig((c) => ({ ...c, days: c.days.includes(i) ? c.days.filter((x) => x !== i) : [...c.days, i] }))} className={config.days.includes(i) ? 'day active' : 'day'}>
              {d}
            </button>
          ))}</div>
          <div className="two">
            <label>
              Opening time
              <input type="time" value={config.start} onChange={(e) => setConfig((c) => ({ ...c, start: e.target.value }))} />
            </label>
            <label>
              Closing time
              <input type="time" value={config.end} onChange={(e) => setConfig((c) => ({ ...c, end: e.target.value }))} />
            </label>
          </div>
          <div className="two">
            <label>
              Appointment duration
              <select value={config.duration} onChange={(e) => setConfig((c) => ({ ...c, duration: Number(e.target.value) }))}>
                <option value="15">15 minutes</option>
                <option value="20">20 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
              </select>
            </label>
            <label>
              Buffer between patients (min)
              <input type="number" min="0" value={config.buffer} onChange={(e) => setConfig((c) => ({ ...c, buffer: Number(e.target.value) }))} />
            </label>
          </div>
          <div className="two">
            <label>
              Break starts
              <input type="time" value={config.breakStart} onChange={(e) => setConfig((c) => ({ ...c, breakStart: e.target.value }))} />
            </label>
            <label>
              Break ends
              <input type="time" value={config.breakEnd} onChange={(e) => setConfig((c) => ({ ...c, breakEnd: e.target.value }))} />
            </label>
          </div>
          <label>
            Consultation fee (optional)
            <input value={config.fee} onChange={(e) => setConfig((c) => ({ ...c, fee: e.target.value }))} placeholder="e.g. ₹600" />
          </label>
          <button className="btn dark full" onClick={() => { setConfig((c) => ({ ...c })); }}>Save schedule settings</button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [booking, setBooking] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [menu, setMenu] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [route, setRoute] = useState(() => window.location.hash);
  useEffect(() => {
    const h = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  if (route.startsWith('#/sree-clinic-admin')) return <SreeAdminPortal config={config} setConfig={setConfig} />;
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
        <button className="mobile-menu" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>
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
            <div className="portrait-fallback">Dr. Swetha<br/>Vinjamuri</div>
          </div>
          <div className="portrait-caption">
            <span>DR. SWETHA VINJAMURI</span>
            <small>Obstetrician & Gynaecologist</small>
          </div>
          <div className="floating-note">
            <HeartPulse size={18} />
            <span>Evidence-based care<br/><b>with a personal touch</b></span>
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
              <div>
                <b>Qualifications</b>
                <span>{PROFILE.qualifications.join('  ·  ')}</span>
              </div>
            </div>
            <div className="credential">
              <ShieldCheck />
              <div>
                <b>Professional registration</b>
                <span>{PROFILE.registration} · Memberships: BSOG and Indian Menopause Society</span>
              </div>
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
                <small>{l.detail}</small>
                {l.external ? (
                  <a className="btn outline" href={l.link} target="_blank" rel="noreferrer">Visit booking page <ArrowUpRight size={16} /></a>
                ) : (
                  <button className="btn dark" onClick={() => setBooking(true)}>Request appointment <ArrowUpRight size={16} /></button>
                )}
              </div>
            </article>
          ))}
        </div>
        <p className="location-note">Cloudnine appointments are handled by Cloudnine. Sree Women’s Clinic online booking will become active after the clinic confirms its schedule and the secure booking integrations are configured.</p>
      </section>
      <section className="section languages">
        <div>
          <div className="section-kicker">04 / COMMUNICATION</div>
          <h2>Care in a language<br /><em>you’re comfortable with.</em></h2>
        </div>
        <div className="language-list">
          {PROFILE.languages.map((x) => (
            <span key={x}><Languages size={15} /> {x}</span>
          ))}
        </div>
      </section>
      <section className="section contact" id="contact">
        <div>
          <span className="eyebrow light">YOUR HEALTH, YOUR QUESTIONS</span>
          <h2>Start with a<br /><em>a conversation.</em></h2>
          <p>Choose a consultation location to view the appropriate appointment route.</p>
          <a className="btn light-btn" href="#locations">Explore locations <ArrowUpRight size={17} /></a>
        </div>
        <div className="contact-side">
          <div>
            <Phone />
            <span>
              <small>Cloudnine appointment assistance</small>
              <br />
              <b>+91 99728 99728</b>
            </span>
          </div>
          <div>
            <MapPin />
            <span>
              <small>Practice locations</small>
              <br />
              <b>HRBR Layout · Thanisandra</b>
            </span>
          </div>
          <div>
            <CalendarDays />
            <span>
              <small>Clinic appointment</small>
              <br />
              <b>Sree Women’s Clinic</b>
            </span>
          </div>
        </div>
      </section>
      <footer>
        <a className="brand" href="#top">SV<span>.</span></a>
        <p>Dr. Swetha Vinjamuri · Obstetrician & Gynaecologist · Bengaluru</p>
        <span style={{ display: 'flex', gap: 14 }}>
          <a className="admin-link" href="#/sree-clinic-admin">Clinic staff portal</a>
        </span>
        <span>© {new Date().getFullYear()} · All rights reserved</span>
      </footer>
      {booking && <BookingModal onClose={() => setBooking(false)} config={config} />}
      {admin && <SreeAdminPortal config={config} setConfig={setConfig} />}
    </main>
  );
}
