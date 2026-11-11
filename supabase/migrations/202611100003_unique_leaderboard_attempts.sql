-- Backfill verified solved progress for older accepted submissions without
-- deleting or changing any submission history.
insert into public.user_problem_progress(user_id, problem_id, solved_at)
select s.user_id, s.problem_id, min(s.created_at)
from public.submissions s
where s.verdict = 'Accepted'
group by s.user_id, s.problem_id
on conflict (user_id, problem_id) do update
set solved_at = least(public.user_problem_progress.solved_at, excluded.solved_at);

-- Return unique problems solved and attempted per user. Multiple submissions
-- to the same problem remain in history but count once in these totals.
drop function if exists public.leaderboard_rows();
create function public.leaderboard_rows()
returns table(
  user_id uuid,
  username text,
  full_name text,
  solved_count bigint,
  accepted_count bigint,
  attempted_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with solved as (
    select upp.user_id, count(distinct upp.problem_id)::bigint as solved_count
    from public.user_problem_progress upp
    group by upp.user_id
  ), submission_totals as (
    select
      s.user_id,
      count(distinct s.problem_id)::bigint as attempted_count,
      count(distinct s.problem_id) filter (where s.verdict = 'Accepted')::bigint as accepted_count
    from public.submissions s
    group by s.user_id
  )
  select
    p.id,
    p.username,
    p.full_name,
    coalesce(solved.solved_count, 0),
    coalesce(submission_totals.accepted_count, 0),
    coalesce(submission_totals.attempted_count, 0)
  from public.profiles p
  left join solved on solved.user_id = p.id
  left join submission_totals on submission_totals.user_id = p.id
  order by
    coalesce(solved.solved_count, 0) desc,
    coalesce(submission_totals.attempted_count, 0) desc,
    p.username asc;
$$;
revoke all on function public.leaderboard_rows() from public;
grant execute on function public.leaderboard_rows() to anon, authenticated, service_role;
