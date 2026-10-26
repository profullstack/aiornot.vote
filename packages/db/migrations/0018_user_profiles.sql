-- The shared Profullstack profile (@profullstack/profile): email, first and
-- last name, company domain, job title and LinkedIn URL, one row per user,
-- asked for on /signup and editable in account settings. Private: only the
-- owner reads it, through /api/v1/me/profile. No backfill: users.display_name
-- is a leaderboard handle, not a person's name.

create table if not exists "user_profiles" (
  "user_id" text primary key,
  "email" text,
  "first_name" text,
  "last_name" text,
  "company_domain" text,
  "job_title" text,
  "linkedin_url" text,
  "created_at" text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_at" text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create index if not exists "user_profiles_email" on "user_profiles" (lower("email"));
create index if not exists "user_profiles_company_domain" on "user_profiles" ("company_domain");
