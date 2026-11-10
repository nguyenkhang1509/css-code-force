-- Accepted counts are unique per user and problem. Total submissions continue
-- to count every attempt.

create or replace function public.leaderboard_rows()
returns table(user_id uuid, username text, full_name text, solved_count bigint, accepted_count bigint)
language sql stable security definer set search_path = '' as $$
  select
    p.id,
    p.username,
    p.full_name,
    count(distinct upp.problem_id),
    count(distinct s.problem_id) filter (where s.verdict = 'Accepted')
  from public.profiles p
  left join public.user_problem_progress upp on upp.user_id = p.id
  left join public.submissions s on s.user_id = p.id
  group by p.id, p.username, p.full_name
  order by
    count(distinct upp.problem_id) desc,
    count(distinct s.problem_id) filter (where s.verdict = 'Accepted') desc,
    p.username asc;
$$;
revoke all on function public.leaderboard_rows() from public;
grant execute on function public.leaderboard_rows() to anon, authenticated, service_role;

-- The homepage uses this aggregate rather than loading submissions into the
-- browser or counting multiple accepted attempts for the same user/problem.
create or replace function public.unique_accepted_problem_count()
returns bigint
language plpgsql stable security definer set search_path = '' as $$
declare
  accepted_pair_count bigint;
begin
  if auth.role() <> 'service_role' then raise exception 'not allowed'; end if;

  select count(*) into accepted_pair_count
  from (
    select s.user_id, s.problem_id
    from public.submissions s
    where s.verdict = 'Accepted'
    group by s.user_id, s.problem_id
  ) accepted_pairs;

  return accepted_pair_count;
end;
$$;
revoke all on function public.unique_accepted_problem_count() from public, anon, authenticated;
grant execute on function public.unique_accepted_problem_count() to service_role;

-- Admin problem statistics count attempts as before, but each user's accepted
-- solution to a given problem contributes only once.
create or replace function public.problem_submission_stats()
returns table(problem_id uuid, total_submissions bigint, accepted_submissions bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'not allowed'; end if;

  return query
  select
    s.problem_id,
    count(*)::bigint,
    count(distinct s.user_id) filter (where s.verdict = 'Accepted')
  from public.submissions s
  group by s.problem_id;
end;
$$;
revoke all on function public.problem_submission_stats() from public, anon, authenticated;
grant execute on function public.problem_submission_stats() to service_role;
