-- Mini "driver 10 minutes away" notice. All data is made up.

create table if not exists users (
  id            serial primary key,
  email         text not null unique,
  password_hash text not null,
  name          text not null,
  role          text not null check (role in ('dispatch', 'driver')),
  vehicle       text,
  check (role <> 'driver' or vehicle is not null)
);

create table if not exists services (
  id            serial primary key,
  client_name   text not null,
  client_phone  text not null,
  pickup_at     timestamptz not null,
  pickup_point  text not null,
  driver_id     integer references users(id),
  created_at    timestamptz not null default now()
);

create index if not exists services_driver_pickup_idx on services (driver_id, pickup_at);

-- One notice per service: the unique key makes a double tap harmless.
create table if not exists notices (
  id          serial primary key,
  service_id  integer not null unique references services(id) on delete cascade,
  message     text not null,
  sent_at     timestamptz not null default now()
);
