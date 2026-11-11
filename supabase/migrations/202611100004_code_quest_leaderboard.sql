-- A separate scoreboard limited to Code Quest Tryout problems.
-- Participation requires at least one accepted solution in this section.
create or replace function public.code_quest_leaderboard_rows()
returns table(
  user_id uuid,
  username text,
  full_name text,
  solved_count bigint,
  attempted_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with tryout_submissions as (
    select s.user_id, s.problem_id, s.verdict
    from public.submissions s
    join public.problems p on p.id = s.problem_id
    where p.section = 'Code Quest Tryout'
  ), totals as (
    select
      ts.user_id,
      count(distinct ts.problem_id)::bigint as attempted_count,
      count(distinct ts.problem_id) filter (where ts.verdict = 'Accepted')::bigint as solved_count
    from tryout_submissions ts
    group by ts.user_id
  )
  select
    profile.id,
    profile.username,
    profile.full_name,
    totals.solved_count,
    totals.attempted_count
  from totals
  join public.profiles profile on profile.id = totals.user_id
  where totals.solved_count > 0
  order by totals.solved_count desc, totals.attempted_count desc, profile.username asc;
$$;
revoke all on function public.code_quest_leaderboard_rows() from public;
grant execute on function public.code_quest_leaderboard_rows() to anon, authenticated, service_role;
