create extension if not exists pgcrypto;

create table if not exists public.clinic_settings (
  id uuid primary key default gen_random_uuid(),
  clinic_name text not null default 'Sree Women''s Clinic',
  timezone text not null default 'Asia/Kolkata',
  enabled boolean not null default false,
  consultation_days integer[] not null default '{1,2,3,4,5,6}',
  opening_time time,
  closing_time time,
  break_start time,
  break_end time,
  appointment_minutes integer not null default 20 check (appointment_minutes > 0),
  buffer_minutes integer not null default 0 check (buffer_minutes >= 0),
  consultation_fee numeric(10,2),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_name text not null,
  patient_phone text not null,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  location text not null default 'Sree Women''s Clinic',
  status text not null default 'confirmed'
    check (status in ('held','confirmed','cancelled','completed','no_show')),
  hold_expires_at timestamptz,
  google_sheet_synced_at timestamptz,
  whatsapp_confirmation_status text,
  whatsapp_reminder_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists appointments_active_slot_unique
on public.appointments (appointment_date, start_time, location)
where status in ('held','confirmed');

create index if not exists appointments_date_idx
on public.appointments (appointment_date, status);

alter table public.clinic_settings enable row level security;
alter table public.appointments enable row level security;
