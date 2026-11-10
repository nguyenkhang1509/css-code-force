-- Add a first-class problem section and allow a few large, efficient judge inputs.
alter table public.problems add column if not exists section text not null default 'General';
alter table public.problems drop constraint if exists problems_section_check;
alter table public.problems add constraint problems_section_check
  check (section in ('General', 'Code Quest Tryout'));
create index if not exists problems_section_published_created_idx
  on public.problems(section, published, created_at desc);

alter table public.test_cases drop constraint if exists test_cases_input_check;
alter table public.test_cases drop constraint if exists test_cases_expected_output_check;
alter table public.test_cases
  add constraint test_cases_input_check check (octet_length(input) <= 8388608),
  add constraint test_cases_expected_output_check check (octet_length(expected_output) <= 2097152);

-- Enforce tag-free Code Quest problems in the database as well as the admin form.
create or replace function public.prevent_tags_on_code_quest_problems()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.problems p
    where p.id = new.problem_id and p.section = 'Code Quest Tryout'
  ) then
    raise exception 'Code Quest tryout problems cannot have topic tags';
  end if;
  return new;
end;
$$;
drop trigger if exists code_quest_problem_tags_guard on public.problem_tags;
create trigger code_quest_problem_tags_guard
before insert or update on public.problem_tags
for each row execute function public.prevent_tags_on_code_quest_problems();

create or replace function public.clear_tags_when_problem_moves_to_code_quest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.section = 'Code Quest Tryout' then
    delete from public.problem_tags where problem_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists clear_code_quest_problem_tags on public.problems;
create trigger clear_code_quest_problem_tags
after update of section on public.problems
for each row execute function public.clear_tags_when_problem_moves_to_code_quest();

-- Keep the existing admin save RPC, adding section support and a 16 MB total cap.
create or replace function public.admin_save_problem(
  p_problem jsonb,
  p_cases jsonb,
  p_tags text[],
  p_reference jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_problem_id uuid;
  total_bytes bigint;
  current_id uuid;
  v_section text;
begin
  if auth.role() <> 'service_role' then raise exception 'not allowed'; end if;
  if jsonb_typeof(p_cases) <> 'array' or jsonb_array_length(p_cases) = 0 or jsonb_array_length(p_cases) > 250 then
    raise exception 'Add between 1 and 250 test cases';
  end if;
  select coalesce(sum(octet_length(coalesce(item->>'input','')) + octet_length(coalesce(item->>'expected_output',''))),0)
    into total_bytes from jsonb_array_elements(p_cases) as item;
  if total_bytes > 16777216 then raise exception 'Combined test case data must be at most 16 MB'; end if;
  v_section := coalesce(p_problem->>'section','General');
  if v_section not in ('General','Code Quest Tryout') then raise exception 'Invalid problem section'; end if;

  current_id := nullif(p_problem->>'id','')::uuid;
  if current_id is null then
    insert into public.problems(slug,title,section,difficulty,statement,input_format,output_format,constraints,time_limit_ms,memory_limit_mb,published,created_by)
    values (p_problem->>'slug',p_problem->>'title',v_section,p_problem->>'difficulty',coalesce(p_problem->>'statement',''),coalesce(p_problem->>'input_format',''),coalesce(p_problem->>'output_format',''),coalesce(p_problem->>'constraints',''),coalesce((p_problem->>'time_limit_ms')::int,1000),coalesce((p_problem->>'memory_limit_mb')::int,256),coalesce((p_problem->>'published')::boolean,false),nullif(p_problem->>'created_by','')::uuid)
    returning id into v_problem_id;
  else
    update public.problems set slug=p_problem->>'slug',title=p_problem->>'title',section=v_section,difficulty=p_problem->>'difficulty',statement=coalesce(p_problem->>'statement',''),input_format=coalesce(p_problem->>'input_format',''),output_format=coalesce(p_problem->>'output_format',''),constraints=coalesce(p_problem->>'constraints',''),time_limit_ms=coalesce((p_problem->>'time_limit_ms')::int,1000),memory_limit_mb=coalesce((p_problem->>'memory_limit_mb')::int,256),published=coalesce((p_problem->>'published')::boolean,false),updated_at=now()
    where id=current_id returning id into v_problem_id;
    if v_problem_id is null then raise exception 'Problem not found'; end if;
  end if;

  delete from public.problem_tags where problem_id=v_problem_id;
  if v_section = 'General' then
    insert into public.problem_tags(problem_id,tag)
    select v_problem_id, lower(trim(tag)) from unnest(coalesce(p_tags, array[]::text[])) tag
    where trim(tag) <> '' on conflict do nothing;
  elsif cardinality(coalesce(p_tags, array[]::text[])) > 0 then
    raise exception 'Code Quest tryout problems cannot have topic tags';
  end if;

  delete from public.test_cases where problem_id=v_problem_id;
  insert into public.test_cases(problem_id,case_index,input,expected_output,is_sample,explanation)
  select v_problem_id, (item->>'case_index')::int, coalesce(item->>'input',''), coalesce(item->>'expected_output',''), coalesce((item->>'is_sample')::boolean,false), item->>'explanation'
  from jsonb_array_elements(p_cases) as item;

  if coalesce(p_reference->>'python','') = '' and coalesce(p_reference->>'cpp','') = '' and coalesce((p_reference->>'published')::boolean,false) = false then
    delete from public.reference_solutions where problem_id=v_problem_id;
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

-- Move yesterday's Code Quest Statistics problem into its section and remove tags.
do $$
declare
  v_stats_id uuid;
begin
  select p.id into v_stats_id
  from public.problems p
  where p.slug in ('css-practice-statistics','code-quest-tryout-statistics')
     or lower(p.title) in ('css practice statistics','code quest tryout statistics')
  order by (p.slug = 'code-quest-tryout-statistics') desc
  limit 1;
  if v_stats_id is not null then
    update public.problems set section='Code Quest Tryout',updated_at=now() where id=v_stats_id;
    delete from public.problem_tags where problem_id=v_stats_id;
  end if;
end;
$$;

-- Upsert the new problem without changing an existing UUID or unrelated rows.
do $$
declare
  v_problem_id uuid;
  v_reserved_id constant uuid := 'a0000000-0000-4000-8000-000000000004';
begin
  select p.id into v_problem_id
  from public.problems p
  where p.slug='code-quest-tryouts-score-audit'
     or lower(p.title)=lower('Code Quest Tryouts: Score Audit')
  order by (p.slug='code-quest-tryouts-score-audit') desc
  limit 1;

  if v_problem_id is null then
    if exists (select 1 from public.problems p where p.id=v_reserved_id) then
      insert into public.problems(slug,title,section,difficulty,statement,input_format,output_format,constraints,time_limit_ms,memory_limit_mb,published)
      values ('code-quest-tryouts-score-audit','Code Quest Tryouts: Score Audit','Code Quest Tryout','Medium',
        $statement$The Computer Science Society (CSS) is organizing tryouts for the Lockheed Martin Code Quest competition.

There are $n$ students, numbered from $1$ to $n$, each initially having a score of $0$.

During the tryouts, $q$ scoring adjustments are made. The $i$-th adjustment adds $x_i$ points to every student's score from position $l_i$ to $r_i$, inclusive. Adjustments may be positive or negative.

However, Khang discovers that exactly one adjustment was recorded incorrectly. Its actual value was an integer $y \ne x_i$, while all other adjustments and ranges were recorded correctly.

You are given the recorded adjustments and the actual final scores $B_1, B_2, \ldots, B_n$.

Determine which adjustment could have been recorded incorrectly and what its correct value should be.

If multiple valid corrections exist, choose the adjustment with the smallest index.

Both the recorded and corrected adjustment values must be between $-10^9$ and $10^9$.

It is guaranteed that at least one valid correction exists.$statement$,
        $input$The first line contains two integers $n$ and $q$, the number of students and scoring adjustments.

Each of the next $q$ lines contains three integers $l_i$, $r_i$, and $x_i$, describing an adjustment that adds $x_i$ points to every student from position $l_i$ to $r_i$.

The final line contains $n$ integers $B_1, B_2, \ldots, B_n$, representing the actual final scores.$input$,
        $output$Print two integers: the 1-based index of the incorrectly recorded adjustment and its corrected value $y$.

If multiple corrections are possible, choose the adjustment with the smallest index.$output$,
        $constraints$- $1 \le n,q \le 200{,}000$
- $1 \le l_i \le r_i \le n$
- $-10^9 \le x_i \le 10^9$
- $-q \times 10^9 \le B_i \le q \times 10^9$
- $-10^9 \le y \le 10^9$
- $y \ne x_i$
- All input values are integers.$constraints$,
        1000,256,true
      ) returning id into v_problem_id;
    else
      insert into public.problems(id,slug,title,section,difficulty,statement,input_format,output_format,constraints,time_limit_ms,memory_limit_mb,published)
      values (v_reserved_id,'code-quest-tryouts-score-audit','Code Quest Tryouts: Score Audit','Code Quest Tryout','Medium',
        $statement$The Computer Science Society (CSS) is organizing tryouts for the Lockheed Martin Code Quest competition.

There are $n$ students, numbered from $1$ to $n$, each initially having a score of $0$.

During the tryouts, $q$ scoring adjustments are made. The $i$-th adjustment adds $x_i$ points to every student's score from position $l_i$ to $r_i$, inclusive. Adjustments may be positive or negative.

However, Khang discovers that exactly one adjustment was recorded incorrectly. Its actual value was an integer $y \ne x_i$, while all other adjustments and ranges were recorded correctly.

You are given the recorded adjustments and the actual final scores $B_1, B_2, \ldots, B_n$.

Determine which adjustment could have been recorded incorrectly and what its correct value should be.

If multiple valid corrections exist, choose the adjustment with the smallest index.

Both the recorded and corrected adjustment values must be between $-10^9$ and $10^9$.

It is guaranteed that at least one valid correction exists.$statement$,
        $input$The first line contains two integers $n$ and $q$, the number of students and scoring adjustments.

Each of the next $q$ lines contains three integers $l_i$, $r_i$, and $x_i$, describing an adjustment that adds $x_i$ points to every student from position $l_i$ to $r_i$.

The final line contains $n$ integers $B_1, B_2, \ldots, B_n$, representing the actual final scores.$input$,
        $output$Print two integers: the 1-based index of the incorrectly recorded adjustment and its corrected value $y$.

If multiple corrections are possible, choose the adjustment with the smallest index.$output$,
        $constraints$- $1 \le n,q \le 200{,}000$
- $1 \le l_i \le r_i \le n$
- $-10^9 \le x_i \le 10^9$
- $-q \times 10^9 \le B_i \le q \times 10^9$
- $-10^9 \le y \le 10^9$
- $y \ne x_i$
- All input values are integers.$constraints$,
        1000,256,true
      ) returning id into v_problem_id;
    end if;
  else
    update public.problems set
      slug='code-quest-tryouts-score-audit',
      title='Code Quest Tryouts: Score Audit',
      section='Code Quest Tryout',
      difficulty='Medium',
      statement=$statement$The Computer Science Society (CSS) is organizing tryouts for the Lockheed Martin Code Quest competition.

There are $n$ students, numbered from $1$ to $n$, each initially having a score of $0$.

During the tryouts, $q$ scoring adjustments are made. The $i$-th adjustment adds $x_i$ points to every student's score from position $l_i$ to $r_i$, inclusive. Adjustments may be positive or negative.

However, Khang discovers that exactly one adjustment was recorded incorrectly. Its actual value was an integer $y \ne x_i$, while all other adjustments and ranges were recorded correctly.

You are given the recorded adjustments and the actual final scores $B_1, B_2, \ldots, B_n$.

Determine which adjustment could have been recorded incorrectly and what its correct value should be.

If multiple valid corrections exist, choose the adjustment with the smallest index.

Both the recorded and corrected adjustment values must be between $-10^9$ and $10^9$.

It is guaranteed that at least one valid correction exists.$statement$,
      input_format=$input$The first line contains two integers $n$ and $q$, the number of students and scoring adjustments.

Each of the next $q$ lines contains three integers $l_i$, $r_i$, and $x_i$, describing an adjustment that adds $x_i$ points to every student from position $l_i$ to $r_i$.

The final line contains $n$ integers $B_1, B_2, \ldots, B_n$, representing the actual final scores.$input$,
      output_format=$output$Print two integers: the 1-based index of the incorrectly recorded adjustment and its corrected value $y$.

If multiple corrections are possible, choose the adjustment with the smallest index.$output$,
      constraints=$constraints$- $1 \le n,q \le 200{,}000$
- $1 \le l_i \le r_i \le n$
- $-10^9 \le x_i \le 10^9$
- $-q \times 10^9 \le B_i \le q \times 10^9$
- $-10^9 \le y \le 10^9$
- $y \ne x_i$
- All input values are integers.$constraints$,
      time_limit_ms=1000,memory_limit_mb=256,published=true,updated_at=now()
    where id=v_problem_id;
  end if;

  delete from public.problem_tags where problem_id=v_problem_id;
  delete from public.test_cases where problem_id=v_problem_id;
  delete from public.reference_solutions where problem_id=v_problem_id;
end;
$$;

-- Generate the two public examples and 28 deterministic small hidden fixtures.
-- The same generator algorithm and independent brute-force verifier live under tests/fixtures.
do $$
declare
  fixture record;
  operation_row record;
  v_problem_id uuid;
  v_recorded_diff bigint[];
  v_actual_diff bigint[];
  v_deltas bigint[];
  v_input text;
  v_scores text;
  v_output text;
  v_l integer;
  v_r integer;
  v_x bigint;
  v_actual_x bigint;
  v_running_recorded bigint;
  v_running_actual bigint;
  v_delta bigint;
  v_first integer;
  v_last integer;
  v_expected_delta bigint;
  v_corrected bigint;
  v_q integer;
  v_i integer;
begin
  select id into v_problem_id from public.problems where slug='code-quest-tryouts-score-audit';
  for fixture in
    select * from (values
      (0,5,'[[1,3,2],[2,5,1],[4,4,-3]]'::jsonb,2,4::bigint,true,'The second adjustment was recorded as adding 1 point to students 2 through 5. The actual final scores show it added 4 points.'::text),
      (1,4,'[[1,4,4],[2,3,6],[2,3,2]]'::jsonb,2,3::bigint,true,'Changing adjustment 2 from 6 to 3 works. Changing adjustment 3 from 2 to -1 also works, so choose the smaller index.'::text),
      (2,1,'[[1,1,0]]'::jsonb,1,4::bigint,false,null::text),
      (3,1,'[[1,1,5],[1,1,-2],[1,1,0]]'::jsonb,2,-9::bigint,false,null::text),
      (4,8,'[[1,8,-3]]'::jsonb,1,10::bigint,false,null::text),
      (5,5,'[[1,1,9],[2,5,3]]'::jsonb,1,-1::bigint,false,null::text),
      (6,5,'[[1,3,4],[5,5,0]]'::jsonb,2,4::bigint,false,null::text),
      (7,5,'[[1,5,4],[2,4,-2],[1,5,1]]'::jsonb,3,8::bigint,false,null::text),
      (8,7,'[[2,6,0]]'::jsonb,1,9::bigint,false,null::text),
      (9,6,'[[3,4,-4],[1,6,8]]'::jsonb,1,0::bigint,false,null::text),
      (10,6,'[[1,6,-5],[2,4,-9],[4,6,3]]'::jsonb,1,-20::bigint,false,null::text),
      (11,4,'[[1,4,1000000000]]'::jsonb,1,-1000000000::bigint,false,null::text),
      (12,4,'[[2,3,-1000000000]]'::jsonb,1,1000000000::bigint,false,null::text),
      (13,3,'[[1,2,17]]'::jsonb,1,1000000000::bigint,false,null::text),
      (14,3,'[[2,3,-17]]'::jsonb,1,-1000000000::bigint,false,null::text),
      (15,2,'[[1,2,1000000000],[1,2,1000000000],[1,2,1000000000]]'::jsonb,2,999999999::bigint,false,null::text),
      (16,8,'[[1,5,3],[4,8,-2],[2,7,8],[5,6,-4]]'::jsonb,3,-11::bigint,false,null::text),
      (17,9,'[[1,9,4],[2,8,-5],[4,6,9],[5,5,-2]]'::jsonb,2,12::bigint,false,null::text),
      (18,7,'[[1,2,3],[3,5,-4],[6,7,8],[2,6,1]]'::jsonb,2,-10::bigint,false,null::text),
      (19,6,'[[2,4,0],[2,4,1],[2,4,2]]'::jsonb,3,9::bigint,false,null::text),
      (20,4,'[[1,2,1000000000],[1,2,0],[2,3,10]]'::jsonb,2,20::bigint,false,null::text),
      (21,5,'[[2,5,100],[1,3,-20],[2,5,-7],[4,5,2]]'::jsonb,3,3::bigint,false,null::text),
      (22,10,'[[1,1,4],[2,2,-3],[5,8,0],[10,10,2]]'::jsonb,4,-9::bigint,false,null::text),
      (23,8,'[[1,8,-1000000000],[2,7,-1000000000],[3,6,-1000000000]]'::jsonb,1,-999999999::bigint,false,null::text),
      (24,7,'[[1,7,6],[1,3,-4],[4,7,2],[2,6,-8]]'::jsonb,3,-13::bigint,false,null::text),
      (25,5,'[[2,2,0],[1,5,0]]'::jsonb,1,-3::bigint,false,null::text),
      (26,5,'[[1,5,-3],[1,5,11]]'::jsonb,2,0::bigint,false,null::text),
      (27,6,'[[1,3,9],[2,6,-4],[4,6,7],[1,6,-2]]'::jsonb,3,-1000000000::bigint,false,null::text),
      (28,3,'[[1,1,-9],[2,2,12],[3,3,-15]]'::jsonb,1,-1000000000::bigint,false,null::text),
      (29,12,'[[1,12,0],[3,10,8],[6,6,-5],[3,10,-3]]'::jsonb,4,0::bigint,false,null::text),
      (30,12,'[[1,12,0],[3,10,8],[6,6,-5],[3,10,-3]]'::jsonb,4,0::bigint,false,null::text)
    ) as fixture_data(case_index,n,operations,wrong_index,actual_amount,is_sample,explanation)
    order by case_index
  loop
    v_q := jsonb_array_length(fixture.operations);
    v_recorded_diff := array_fill(0::bigint,array[fixture.n+2]);
    v_actual_diff := array_fill(0::bigint,array[fixture.n+2]);
    v_input := fixture.n::text || ' ' || v_q::text || E'\n';

    for operation_row in
      select value, ordinality from jsonb_array_elements(fixture.operations) with ordinality
    loop
      v_l := (operation_row.value->>0)::integer;
      v_r := (operation_row.value->>1)::integer;
      v_x := (operation_row.value->>2)::bigint;
      v_actual_x := case when operation_row.ordinality=fixture.wrong_index then fixture.actual_amount else v_x end;
      v_recorded_diff[v_l] := v_recorded_diff[v_l] + v_x;
      v_recorded_diff[v_r+1] := v_recorded_diff[v_r+1] - v_x;
      v_actual_diff[v_l] := v_actual_diff[v_l] + v_actual_x;
      v_actual_diff[v_r+1] := v_actual_diff[v_r+1] - v_actual_x;
      v_input := v_input || v_l::text || ' ' || v_r::text || ' ' || v_x::text || E'\n';
    end loop;

    v_scores := '';
    v_running_recorded := 0;
    v_running_actual := 0;
    for v_i in 1..fixture.n loop
      v_running_actual := v_running_actual + v_actual_diff[v_i];
      v_scores := v_scores || case when v_i=1 then '' else ' ' end || v_running_actual::text;
    end loop;
    v_input := v_input || v_scores || E'\n';

    v_deltas := array_fill(0::bigint,array[fixture.n]);
    v_running_recorded := 0;
    v_running_actual := 0;
    v_first := 0;
    v_last := 0;
    v_expected_delta := 0;
    for v_i in 1..fixture.n loop
      v_running_recorded := v_running_recorded + v_recorded_diff[v_i];
      v_running_actual := v_running_actual + v_actual_diff[v_i];
      v_delta := v_running_actual - v_running_recorded;
      v_deltas[v_i] := v_delta;
      if v_delta <> 0 then
        if v_first=0 then v_first := v_i; v_expected_delta := v_delta; end if;
        v_last := v_i;
      end if;
    end loop;
    if v_first=0 or v_expected_delta=0 then raise exception 'Invalid generated case % has no discrepancy',fixture.case_index; end if;
    for v_i in 1..fixture.n loop
      if v_deltas[v_i] <> (case when v_i between v_first and v_last then v_expected_delta else 0 end) then
        raise exception 'Invalid generated case % has a non-constant discrepancy',fixture.case_index;
      end if;
    end loop;

    v_output := null;
    for operation_row in
      select value, ordinality from jsonb_array_elements(fixture.operations) with ordinality
    loop
      v_l := (operation_row.value->>0)::integer;
      v_r := (operation_row.value->>1)::integer;
      v_x := (operation_row.value->>2)::bigint;
      v_corrected := v_x + v_expected_delta;
      if v_l=v_first and v_r=v_last and v_corrected between -1000000000 and 1000000000 and v_corrected<>v_x then
        v_output := operation_row.ordinality::text || ' ' || v_corrected::text || E'\n';
        exit;
      end if;
    end loop;
    if v_output is null then raise exception 'No valid correction found in generated case %',fixture.case_index; end if;

    insert into public.test_cases(problem_id,case_index,input,expected_output,is_sample,explanation)
    values (v_problem_id,fixture.case_index,v_input,v_output,fixture.is_sample,fixture.explanation)
    on conflict(problem_id,case_index) do update
    set input=excluded.input,expected_output=excluded.expected_output,is_sample=excluded.is_sample,explanation=excluded.explanation;
  end loop;
end;
$$;

-- Maximum-size repeated full-range adjustments: a quadratic scan would require 40 billion visits.
with operation_text as (
  select string_agg('1 200000 0',E'\n' order by i) as value from generate_series(1,200000) as series(i)
), score_text as (
  select string_agg('1',' ' order by i) as value from generate_series(1,200000) as series(i)
)
insert into public.test_cases(problem_id,case_index,input,expected_output,is_sample,explanation)
 select p.id,31,E'200000 200000\n'||operation_text.value||E'\n'||score_text.value||E'\n','1 1'||E'\n',false,null
from public.problems p cross join operation_text cross join score_text
where p.slug='code-quest-tryouts-score-audit'
on conflict(problem_id,case_index) do update set input=excluded.input,expected_output=excluded.expected_output,is_sample=false,explanation=null;

-- Maximum-size deterministic pseudo-random ranges and nonzero signed values.
with labeled_operations as (
  select i,
    case when i=200000 then 200000 else (mod(i::bigint*48271+17,199999)+1)::integer end as l,
    case when i=200000 then 7 else (mod(i::bigint*104729+91,2001)-1000)::integer end as x
  from generate_series(1,200000) as series(i)
), operations as (
  select i,l,
    case when i=200000 then 200000 else l+mod(i::bigint*7919+23,(200000-l+1)::bigint)::integer end as r,
    x
  from labeled_operations
), operation_text as (
  select string_agg(l::text||' '||r::text||' '||x::text,E'\n' order by i) as value from operations
), events as (
  select l as position,x::bigint as change from operations
  union all select r+1,-x::bigint from operations
  union all select 200000,-18::bigint
  union all select 200001,18::bigint
), event_sums as (
  select position,sum(change) as change from events group by position
), scores as (
  select i as position,
    sum(coalesce(event_sums.change,0)) over(order by i rows between unbounded preceding and current row) as value
  from generate_series(1,200000) as series(i)
  left join event_sums on event_sums.position=i
), score_text as (
  select string_agg(value::text,' ' order by position) as value from scores
)
insert into public.test_cases(problem_id,case_index,input,expected_output,is_sample,explanation)
 select p.id,32,E'200000 200000\n'||operation_text.value||E'\n'||score_text.value||E'\n','200000 -11'||E'\n',false,null
from public.problems p cross join operation_text cross join score_text
where p.slug='code-quest-tryouts-score-audit'
on conflict(problem_id,case_index) do update set input=excluded.input,expected_output=excluded.expected_output,is_sample=false,explanation=null;

-- Maximum-size repeated nested intervals, with the earliest matching correction at operation 100.
with operations as (
  select i,((i-1)%100)+1 as l,200000-(((i-1)%100)+1)+1 as r
  from generate_series(1,200000) as series(i)
), operation_text as (
  select string_agg(l::text||' '||r::text||' 0',E'\n' order by i) as value from operations
), events as (
  select 100 as position,-7::bigint as change
  union all select 200000-100+2,7::bigint
), event_sums as (
  select position,sum(change) as change from events group by position
), scores as (
  select i as position,
    sum(coalesce(event_sums.change,0)) over(order by i rows between unbounded preceding and current row) as value
  from generate_series(1,200000) as series(i)
  left join event_sums on event_sums.position=i
), score_text as (
  select string_agg(value::text,' ' order by position) as value from scores
)
insert into public.test_cases(problem_id,case_index,input,expected_output,is_sample,explanation)
 select p.id,33,E'200000 200000\n'||operation_text.value||E'\n'||score_text.value||E'\n','100 -7'||E'\n',false,null
from public.problems p cross join operation_text cross join score_text
where p.slug='code-quest-tryouts-score-audit'
on conflict(problem_id,case_index) do update set input=excluded.input,expected_output=excluded.expected_output,is_sample=false,explanation=null;

-- Private 64-bit reference solutions are stored only in the server-side table.
insert into public.reference_solutions(problem_id,python,cpp,published)
select p.id,
$python$import sys

def solve():
    data = list(map(int, sys.stdin.buffer.read().split()))
    pos = 0
    n, q = data[pos], data[pos + 1]
    pos += 2
    operations = []
    difference = [0] * (n + 2)
    for _ in range(q):
        left, right, recorded = data[pos], data[pos + 1], data[pos + 2]
        pos += 3
        operations.append((left, right, recorded))
        difference[left] += recorded
        difference[right + 1] -= recorded

    actual = data[pos:pos + n]
    delta = [0] * (n + 1)
    running = 0
    first = last = 0
    change = 0
    for i in range(1, n + 1):
        running += difference[i]
        delta[i] = actual[i - 1] - running
        if delta[i] != 0:
            if first == 0:
                first = i
                change = delta[i]
            last = i

    for i in range(1, n + 1):
        expected = change if first <= i <= last else 0
        if delta[i] != expected:
            raise ValueError("The score differences do not match one adjustment")

    for index, (left, right, recorded) in enumerate(operations, 1):
        corrected = recorded + change
        if left == first and right == last and corrected != recorded and -10**9 <= corrected <= 10**9:
            print(index, corrected)
            return

if __name__ == "__main__":
    solve()$python$,
$cpp$#include <bits/stdc++.h>
using namespace std;

struct Operation {
    int left;
    int right;
    long long recorded;
};

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, q;
    cin >> n >> q;
    vector<Operation> operations(q);
    vector<long long> difference(n + 2, 0);
    for (auto &operation : operations) {
        cin >> operation.left >> operation.right >> operation.recorded;
        difference[operation.left] += operation.recorded;
        difference[operation.right + 1] -= operation.recorded;
    }

    vector<long long> actual(n + 1);
    for (int i = 1; i <= n; ++i) cin >> actual[i];

    int first = 0, last = 0;
    long long change = 0, running = 0;
    vector<long long> delta(n + 1, 0);
    for (int i = 1; i <= n; ++i) {
        running += difference[i];
        delta[i] = actual[i] - running;
        if (delta[i] != 0) {
            if (first == 0) {
                first = i;
                change = delta[i];
            }
            last = i;
        }
    }

    for (int i = 1; i <= n; ++i) {
        long long expected = first <= i && i <= last ? change : 0;
        if (delta[i] != expected) return 0;
    }

    for (int i = 0; i < q; ++i) {
        const auto &operation = operations[i];
        long long corrected = operation.recorded + change;
        if (operation.left == first && operation.right == last &&
            corrected != operation.recorded && -1000000000LL <= corrected && corrected <= 1000000000LL) {
            cout << i + 1 << ' ' << corrected << '\n';
            return 0;
        }
    }
    return 0;
}$cpp$,
false
from public.problems p
where p.slug='code-quest-tryouts-score-audit'
on conflict(problem_id) do update
set python=excluded.python,cpp=excluded.cpp,published=false,updated_at=now();
