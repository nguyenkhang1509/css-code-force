create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9_]{3,24}$'),
  full_name text,
  bio text not null default '',
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now()
);
create unique index profiles_username_lower_unique on public.profiles (lower(username));
create index profiles_created_at_idx on public.profiles (created_at desc);

create or replace function public.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare desired_username text;
begin
  desired_username := lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
  if desired_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must be 3–24 letters, numbers, or underscores';
  end if;
  insert into public.profiles (id, username, full_name)
  values (new.id, desired_username, nullif(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;
create trigger auth_user_profile_created after insert on auth.users
for each row execute function public.create_profile_for_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

create table public.problems (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  difficulty text not null check (difficulty in ('Easy','Medium','Hard')),
  statement text not null default '',
  input_format text not null default '',
  output_format text not null default '',
  constraints text not null default '',
  time_limit_ms integer not null default 1000 check (time_limit_ms between 100 and 5000),
  memory_limit_mb integer not null default 256 check (memory_limit_mb between 64 and 1024),
  published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index problems_published_created_idx on public.problems (published, created_at desc);
create index problems_difficulty_idx on public.problems (difficulty);

create table public.problem_tags (
  problem_id uuid not null references public.problems(id) on delete cascade,
  tag text not null check (char_length(tag) between 1 and 32),
  primary key (problem_id, tag)
);
create index problem_tags_tag_idx on public.problem_tags (tag);

create table public.test_cases (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems(id) on delete cascade,
  case_index integer not null check (case_index >= 0),
  input text not null,
  expected_output text not null,
  is_sample boolean not null default false,
  explanation text,
  created_at timestamptz not null default now(),
  unique(problem_id, case_index),
  check (octet_length(input) <= 65536),
  check (octet_length(expected_output) <= 65536)
);
create index test_cases_problem_public_idx on public.test_cases(problem_id, is_sample, case_index);

create table public.reference_solutions (
  problem_id uuid primary key references public.problems(id) on delete cascade,
  python text,
  cpp text,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  language text not null check (language in ('python','cpp')),
  source_code text not null check (octet_length(source_code) <= 65536),
  verdict text not null default 'Pending' check (verdict in ('Pending','Accepted','Wrong Answer','Time Limit Exceeded','Memory Limit Exceeded','Runtime Error','Compilation Error','Judging Error')),
  execution_time_ms integer check (execution_time_ms >= 0),
  memory_used_kb integer check (memory_used_kb >= 0),
  passed_test_cases integer not null default 0 check (passed_test_cases >= 0),
  total_test_cases integer not null default 0 check (total_test_cases >= 0),
  error_message text,
  created_at timestamptz not null default now()
);
create index submissions_user_created_idx on public.submissions(user_id, created_at desc);
create index submissions_problem_verdict_idx on public.submissions(problem_id, verdict);
create index submissions_accepted_user_problem_idx on public.submissions(user_id, problem_id) where verdict = 'Accepted';

create table public.user_problem_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  solved_at timestamptz not null default now(),
  primary key(user_id, problem_id)
);
create index progress_problem_idx on public.user_problem_progress(problem_id);

create or replace function public.record_accepted_progress()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.verdict = 'Accepted' then
    insert into public.user_problem_progress(user_id, problem_id, solved_at)
    values (new.user_id, new.problem_id, new.created_at)
    on conflict (user_id, problem_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger submission_acceptance_progress after insert or update of verdict on public.submissions
for each row execute function public.record_accepted_progress();

create table public.judge_leases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check(action in ('run','submit')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 seconds')
);
create index judge_leases_active_idx on public.judge_leases(expires_at);

create table public.judge_rate_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check(action in ('run','submit')),
  created_at timestamptz not null default now()
);
create index judge_rate_events_user_action_time_idx on public.judge_rate_events(user_id,action,created_at desc);
alter table public.judge_rate_events enable row level security;
create policy "No client judge rate access" on public.judge_rate_events for all using (false) with check (false);

create or replace function public.claim_judge_lease(p_user_id uuid, p_action text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare lease_id uuid; per_minute_limit integer;
begin
  if auth.role() <> 'service_role' then raise exception 'not allowed'; end if;
  if p_action not in ('run','submit') then raise exception 'invalid action'; end if;
  perform pg_advisory_xact_lock(hashtext('css_global_judge_slots'));
  delete from public.judge_leases where expires_at < now();
  delete from public.judge_rate_events where created_at < now() - interval '7 days';
  per_minute_limit := case when p_action = 'submit' then 4 else 8 end;
  if (select count(*) from public.judge_rate_events where user_id = p_user_id and action = p_action and created_at > now() - interval '1 minute') >= per_minute_limit then
    return null;
  end if;
  if (select count(*) from public.judge_leases where expires_at > now()) >= 3 then return null; end if;
  insert into public.judge_leases(user_id, action,expires_at) values (p_user_id, p_action,now()+interval '180 seconds') returning id into lease_id;
  insert into public.judge_rate_events(user_id,action) values (p_user_id,p_action);
  return lease_id;
end;
$$;
revoke all on function public.claim_judge_lease(uuid,text) from public, authenticated;
grant execute on function public.claim_judge_lease(uuid,text) to service_role;

create or replace function public.release_judge_lease(p_lease_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.judge_leases where id = p_lease_id and auth.role() = 'service_role';
$$;
revoke all on function public.release_judge_lease(uuid) from public, authenticated;
grant execute on function public.release_judge_lease(uuid) to service_role;

create or replace function public.admin_save_problem(p_problem jsonb, p_cases jsonb, p_tags text[], p_reference jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_problem_id uuid; total_bytes bigint; current_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'not allowed'; end if;
  if jsonb_typeof(p_cases) <> 'array' or jsonb_array_length(p_cases) = 0 or jsonb_array_length(p_cases) > 250 then
    raise exception 'Add between 1 and 250 test cases';
  end if;
  select coalesce(sum(octet_length(coalesce(item->>'input','')) + octet_length(coalesce(item->>'expected_output',''))),0)
    into total_bytes from jsonb_array_elements(p_cases) as item;
  if total_bytes > 262144 then raise exception 'Combined test case data must be at most 256 KB'; end if;
  current_id := nullif(p_problem->>'id','')::uuid;
  if current_id is null then
    insert into public.problems(slug,title,difficulty,statement,input_format,output_format,constraints,time_limit_ms,memory_limit_mb,published,created_by)
    values (p_problem->>'slug',p_problem->>'title',p_problem->>'difficulty',coalesce(p_problem->>'statement',''),coalesce(p_problem->>'input_format',''),coalesce(p_problem->>'output_format',''),coalesce(p_problem->>'constraints',''),coalesce((p_problem->>'time_limit_ms')::int,1000),coalesce((p_problem->>'memory_limit_mb')::int,256),coalesce((p_problem->>'published')::boolean,false),nullif(p_problem->>'created_by','')::uuid)
    returning id into v_problem_id;
  else
    update public.problems set slug=p_problem->>'slug',title=p_problem->>'title',difficulty=p_problem->>'difficulty',statement=coalesce(p_problem->>'statement',''),input_format=coalesce(p_problem->>'input_format',''),output_format=coalesce(p_problem->>'output_format',''),constraints=coalesce(p_problem->>'constraints',''),time_limit_ms=coalesce((p_problem->>'time_limit_ms')::int,1000),memory_limit_mb=coalesce((p_problem->>'memory_limit_mb')::int,256),published=coalesce((p_problem->>'published')::boolean,false),updated_at=now()
    where id=current_id returning id into v_problem_id;
    if v_problem_id is null then raise exception 'Problem not found'; end if;
  end if;
  delete from public.problem_tags where problem_tags.problem_id=v_problem_id;
  insert into public.problem_tags(problem_id,tag)
  select v_problem_id, lower(trim(tag)) from unnest(coalesce(p_tags, array[]::text[])) tag
  where trim(tag) <> '' on conflict do nothing;
  delete from public.test_cases where test_cases.problem_id=v_problem_id;
  insert into public.test_cases(problem_id,case_index,input,expected_output,is_sample,explanation)
  select v_problem_id, (item->>'case_index')::int, coalesce(item->>'input',''), coalesce(item->>'expected_output',''), coalesce((item->>'is_sample')::boolean,false), item->>'explanation'
  from jsonb_array_elements(p_cases) as item;
  if coalesce(p_reference->>'python','') = '' and coalesce(p_reference->>'cpp','') = '' and coalesce((p_reference->>'published')::boolean,false) = false then
    delete from public.reference_solutions where reference_solutions.problem_id=v_problem_id;
  else
    insert into public.reference_solutions(problem_id,python,cpp,published,updated_at)
    values (v_problem_id,nullif(p_reference->>'python',''),nullif(p_reference->>'cpp',''),coalesce((p_reference->>'published')::boolean,false),now())
    on conflict(problem_id) do update set python=excluded.python,cpp=excluded.cpp,published=excluded.published,updated_at=now();
  end if;
  return v_problem_id;
end;
$$;
revoke all on function public.admin_save_problem(jsonb,jsonb,text[],jsonb) from public, authenticated;
grant execute on function public.admin_save_problem(jsonb,jsonb,text[],jsonb) to service_role;

create or replace function public.leaderboard_rows()
returns table(user_id uuid, username text, full_name text, solved_count bigint, accepted_count bigint)
language sql stable security definer set search_path = '' as $$
  select p.id,p.username,p.full_name,count(distinct upp.problem_id),count(distinct s.id) filter(where s.verdict='Accepted')
  from public.profiles p
  left join public.user_problem_progress upp on upp.user_id=p.id
  left join public.submissions s on s.user_id=p.id
  group by p.id,p.username,p.full_name
  order by count(distinct upp.problem_id) desc,count(distinct s.id) filter(where s.verdict='Accepted') desc,p.username asc;
$$;
revoke all on function public.leaderboard_rows() from public;
grant execute on function public.leaderboard_rows() to anon, authenticated, service_role;

create or replace function public.profile_activity(p_username text)
returns table(submission_id uuid,problem_title text,problem_slug text,verdict text,language text,execution_time_ms integer,submitted_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.id,p.title,p.slug,s.verdict,s.language,s.execution_time_ms,s.created_at
  from public.submissions s
  join public.profiles profile on profile.id=s.user_id
  left join public.problems p on p.id=s.problem_id
  where lower(profile.username)=lower(p_username)
  order by s.created_at desc limit 10;
$$;
revoke all on function public.profile_activity(text) from public;
grant execute on function public.profile_activity(text) to anon,authenticated,service_role;

create or replace function public.problem_submission_stats()
returns table(problem_id uuid,total_submissions bigint,accepted_submissions bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'not allowed'; end if;
  return query
  select s.problem_id,count(*)::bigint,count(*) filter(where s.verdict='Accepted')::bigint
  from public.submissions s group by s.problem_id;
end;
$$;
revoke all on function public.problem_submission_stats() from public,anon,authenticated;
grant execute on function public.problem_submission_stats() to service_role;

alter table public.profiles enable row level security;
alter table public.problems enable row level security;
alter table public.problem_tags enable row level security;
alter table public.test_cases enable row level security;
alter table public.reference_solutions enable row level security;
alter table public.submissions enable row level security;
alter table public.user_problem_progress enable row level security;
alter table public.judge_leases enable row level security;

grant all on public.profiles, public.problems, public.problem_tags, public.test_cases,
  public.reference_solutions, public.submissions, public.user_problem_progress,
  public.judge_leases, public.judge_rate_events to service_role;

create policy "Profiles are public" on public.profiles for select using (true);
create policy "Users update their public profile" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
grant select on public.profiles to anon, authenticated;
revoke update on public.profiles from anon, authenticated;
grant update(username,full_name,bio) on public.profiles to authenticated;

create policy "Published problems are public; admins see all" on public.problems for select to anon,authenticated using (published or public.is_admin());
create policy "Admins manage problems" on public.problems for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.problems to anon,authenticated;
grant insert,update,delete on public.problems to authenticated;

create policy "Tags follow published visibility" on public.problem_tags for select to anon,authenticated using (exists(select 1 from public.problems p where p.id=problem_id and (p.published or public.is_admin())));
create policy "Admins manage problem tags" on public.problem_tags for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.problem_tags to anon,authenticated;
grant insert,update,delete on public.problem_tags to authenticated;

create policy "Samples on published problems are public" on public.test_cases for select to anon,authenticated using (is_sample and exists(select 1 from public.problems p where p.id=problem_id and p.published));
create policy "Admins manage test cases" on public.test_cases for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.test_cases to anon,authenticated;
grant insert,update,delete on public.test_cases to authenticated;

create policy "Reference solutions only published when enabled" on public.reference_solutions for select to anon,authenticated using (public.is_admin() or (published and exists(select 1 from public.problems p where p.id=problem_id and p.published)));
create policy "Admins manage reference solutions" on public.reference_solutions for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.reference_solutions to anon,authenticated;
grant insert,update,delete on public.reference_solutions to authenticated;

create policy "Users see their submissions" on public.submissions for select to authenticated using (user_id=auth.uid());
grant select on public.submissions to authenticated;
revoke insert,update,delete on public.submissions from anon,authenticated;

create policy "Solved progress is public" on public.user_problem_progress for select to anon,authenticated using (true);
grant select on public.user_problem_progress to anon,authenticated;

create policy "No client judge lease access" on public.judge_leases for all using (false) with check (false);

-- A project owner promotes the first administrator in the Supabase SQL Editor:
-- update public.profiles set role='admin' where username='your_chosen_username';
-- The role column is not writable by user sessions.
