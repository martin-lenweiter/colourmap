-- Colourmap v0 tables

create extension if not exists "uuid-ossp";

create table if not exists colourmap_sessions (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now()
);

create table if not exists colourmap_messages (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references colourmap_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  state_deltas jsonb,
  created_at timestamptz default now()
);

create table if not exists colourmap_user_state (
  id uuid primary key default uuid_generate_v4(),
  health_attention float default 0.3,
  health_tone text[] default '{}',
  love_attention float default 0.3,
  love_tone text[] default '{}',
  purpose_attention float default 0.3,
  purpose_tone text[] default '{}',
  energy float default 0.5,
  clarity float default 0.5,
  updated_at timestamptz default now()
);

create index if not exists idx_colourmap_messages_session_id on colourmap_messages(session_id);
