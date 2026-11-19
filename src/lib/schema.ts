export const SCHEMA_SQL = `
drop table if exists app_user, audit_log, outbox, alert, collation_entry, submission, witness, polling_unit, ward, lga cascade;

create table app_user (
  id serial primary key,
  email text not null,
  name text not null,
  role text not null check (role in ('admin','observer','witness')),
  pass_hash text not null,
  phone text,
  phone_verified boolean not null default false,
  otp_hash text,
  otp_expires timestamptz,
  otp_tries int not null default 0,
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index app_user_email on app_user (lower(email));
-- a phone number belongs to one *verified* account; unverified claims can't lock the real owner out
create unique index app_user_phone on app_user (phone) where phone_verified;

create table lga (
  id serial primary key,
  code text unique not null,
  name text not null,
  state text not null
);

create table ward (
  id serial primary key,
  lga_id int not null references lga(id),
  number int not null,
  name text not null,
  unique (lga_id, number)
);

create table polling_unit (
  id serial primary key,
  ward_id int not null references ward(id),
  code text unique not null,         -- 3-digit PU code used in SMS/USSD
  name text not null,
  registered int not null
);

create table witness (
  phone text primary key,
  lang text not null default 'en',
  voice boolean not null default false,   -- also receive a spoken alert call
  created_at timestamptz not null default now()
);

-- One row per witness submission of a polling-unit (EC8A) result
create table submission (
  id serial primary key,
  pu_id int not null references polling_unit(id),
  phone text not null,
  source text not null check (source in ('sms','photo','whatsapp')),
  results jsonb not null,
  raw text,
  photo_hash text,
  photo_path text,
  confidence real,
  created_at timestamptz not null default now(),
  unique (pu_id, phone)
);

-- Figures announced at a collation hop (what the collation officer read out)
create table collation_entry (
  id serial primary key,
  level text not null check (level in ('pu_at_ward','ward','lga','state')),
  ward_id int references ward(id),
  lga_id int references lga(id),
  pu_id int references polling_unit(id),
  results jsonb,                      -- null when the PU was dropped
  dropped boolean not null default false,
  source text not null default 'manual',
  transcript text,
  created_at timestamptz not null default now()
);

create table alert (
  id serial primary key,
  kind text not null,                 -- pu_changed | pu_dropped | ward_inflated | lga_mismatch
  severity text not null default 'red',
  level text not null,
  ward_id int references ward(id),
  lga_id int references lga(id),
  pu_id int references polling_unit(id),
  message text not null,
  detail jsonb,
  fingerprint text unique not null,
  created_at timestamptz not null default now()
);

create table outbox (
  id serial primary key,
  channel text not null default 'sms',  -- sms | voice
  to_phone text not null,
  lang text not null,
  body text not null,
  alert_id int references alert(id),
  status text not null default 'sent',
  created_at timestamptz not null default now()
);

create table audit_log (
  id serial primary key,
  event text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index on submission (pu_id);
create index on collation_entry (level, ward_id, lga_id, pu_id, id desc);
create index on outbox (to_phone, id desc);
`;
