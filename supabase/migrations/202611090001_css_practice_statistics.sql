-- The stress case contains a 100,000-element array and 100,000 queries.
-- Expand the existing judge-data limits to hold them while retaining hard caps.
alter table public.test_cases drop constraint if exists test_cases_input_check;
alter table public.test_cases drop constraint if exists test_cases_expected_output_check;
alter table public.test_cases
  add constraint test_cases_input_check check (octet_length(input) <= 4194304),
  add constraint test_cases_expected_output_check check (octet_length(expected_output) <= 4194304);

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
begin
  if auth.role() <> 'service_role' then raise exception 'not allowed'; end if;
  if jsonb_typeof(p_cases) <> 'array' or jsonb_array_length(p_cases) = 0 or jsonb_array_length(p_cases) > 250 then
    raise exception 'Add between 1 and 250 test cases';
  end if;
  select coalesce(sum(octet_length(coalesce(item->>'input','')) + octet_length(coalesce(item->>'expected_output',''))),0)
    into total_bytes from jsonb_array_elements(p_cases) as item;
  if total_bytes > 4194304 then raise exception 'Combined test case data must be at most 4 MB'; end if;
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

do $$
declare
  v_problem_id uuid;
begin
  select p.id into v_problem_id
  from public.problems p
  where p.slug = 'code-quest-tryout-statistics' or lower(p.title) = lower('Code Quest Tryout Statistics')
  order by (p.slug = 'code-quest-tryout-statistics') desc
  limit 1;

  if v_problem_id is null then
    insert into public.problems(
      slug,title,difficulty,statement,input_format,output_format,constraints,
      time_limit_ms,memory_limit_mb,published
    ) values (
      'code-quest-tryout-statistics',
      'Code Quest Tryout Statistics',
      'Medium',
      $statement$## Code Quest Tryout Statistics

Khang has prepared $N$ programming problems for the Code Quest tryouts. Each problem has a score, and the scores are recorded in an array $a_1, a_2, \ldots, a_n$.

Khang wants to analyze these scores by asking two types of queries:

1. Given two integers $l$ and $r$ ($1 \le l \le r \le n$), find the sum of the scores from position $l$ to $r$ in the original array: $\displaystyle \sum_{i=l}^{r} a_i$

2. Let $u_i$ be the $i$-th smallest score (the value at position $i$ when all scores are arranged in non-decreasing order). Given two integers $l$ and $r$ ($1 \le l \le r \le n$), find: $\displaystyle \sum_{i=l}^{r} u_i$

For each query, output the corresponding sum.$statement$,
      $input$The first line contains an integer $n$ ($1 \le n \le 10^5$), the number of challenges.

The second line contains $n$ integers $a_1, a_2, \ldots, a_n$ ($1 \le a_i \le 10^9$), representing their scores.

The third line contains an integer $q$ ($1 \le q \le 10^5$), the number of queries.

Each of the following $q$ lines contains three integers: $type$, $l$, and $r$ ($1 \le type \le 2$, $1 \le l \le r \le n$).

If $type = 1$, answer the first type of query. Otherwise, answer the second type.$input$,
      $output$Print $q$ lines, each containing a single integer representing the answer to the corresponding query.

The answers may exceed the range of a 32-bit integer.$output$,
      $constraints$- $1 \le n \le 10^5$
- $1 \le a_i \le 10^9$
- $1 \le q \le 10^5$
- $1 \le type \le 2$
- $1 \le l \le r \le n$
- The answers may exceed the range of a 32-bit integer.$constraints$,
      2000,256,true
    ) returning id into v_problem_id;
  else
    update public.problems set
      slug='code-quest-tryout-statistics',
      title='Code Quest Tryout Statistics',
      difficulty='Medium',
      statement=$statement$## Code Quest Tryout Statistics

Khang has prepared $N$ programming problems for the Code Quest tryouts. Each problem has a score, and the scores are recorded in an array $a_1, a_2, \ldots, a_n$.

Khang wants to analyze these scores by asking two types of queries:

1. Given two integers $l$ and $r$ ($1 \le l \le r \le n$), find the sum of the scores from position $l$ to $r$ in the original array: $\displaystyle \sum_{i=l}^{r} a_i$

2. Let $u_i$ be the $i$-th smallest score (the value at position $i$ when all scores are arranged in non-decreasing order). Given two integers $l$ and $r$ ($1 \le l \le r \le n$), find: $\displaystyle \sum_{i=l}^{r} u_i$

For each query, output the corresponding sum.$statement$,
      input_format=$input$The first line contains an integer $n$ ($1 \le n \le 10^5$), the number of challenges.

The second line contains $n$ integers $a_1, a_2, \ldots, a_n$ ($1 \le a_i \le 10^9$), representing their scores.

The third line contains an integer $q$ ($1 \le q \le 10^5$), the number of queries.

Each of the following $q$ lines contains three integers: $type$, $l$, and $r$ ($1 \le type \le 2$, $1 \le l \le r \le n$).

If $type = 1$, answer the first type of query. Otherwise, answer the second type.$input$,
      output_format=$output$Print $q$ lines, each containing a single integer representing the answer to the corresponding query.

The answers may exceed the range of a 32-bit integer.$output$,
      constraints=$constraints$- $1 \le n \le 10^5$
- $1 \le a_i \le 10^9$
- $1 \le q \le 10^5$
- $1 \le type \le 2$
- $1 \le l \le r \le n$
- The answers may exceed the range of a 32-bit integer.$constraints$,
      time_limit_ms=2000,memory_limit_mb=256,published=true,updated_at=now()
    where id=v_problem_id;
  end if;

  delete from public.problem_tags where problem_id=v_problem_id;
  insert into public.problem_tags(problem_id,tag) values
    (v_problem_id,'Prefix Sums'),
    (v_problem_id,'Sorting'),
    (v_problem_id,'Arrays');

  delete from public.test_cases where problem_id=v_problem_id;
  delete from public.reference_solutions where problem_id=v_problem_id;
end;
$$;

do $$
declare
  fixture record;
  v_problem_id uuid;
  v_n integer;
  v_q integer;
  v_sorted bigint[];
  v_original_prefix bigint[];
  v_sorted_prefix bigint[];
  v_input text;
  v_output text;
  v_type integer;
  v_l integer;
  v_r integer;
  v_i integer;
  v_answer bigint;
  query_row record;
begin
  select id into v_problem_id from public.problems where slug='code-quest-tryout-statistics';
  if v_problem_id is null then raise exception 'Code Quest Tryout Statistics problem was not created'; end if;

  for fixture in
    select case_index,
      array(
        select score_value::bigint
        from unnest(string_to_array(trim(both '{}' from score_list), ',')) as parsed(score_value)
      ) as scores,
      queries::jsonb as queries,
      is_sample
    from (values
(0,'{8,3,5,3,10,6}','[[1,2,5],[2,2,4],[1,1,6],[2,5,6]]',true),
(1,'{5,5,2,3}','[[1,2,4],[2,1,3],[1,1,1],[2,2,4]]',true),
(2,'{1}','[[1,1,1]]',false),
(3,'{1000000000}','[[2,1,1]]',false),
(4,'{4,9}','[[1,1,2],[1,1,1],[1,2,2],[1,1,2]]',false),
(5,'{9,4}','[[2,1,2],[2,1,1],[2,2,2],[2,1,2]]',false),
(6,'{30,1,20}','[[1,1,2],[2,1,2],[1,2,3],[2,2,3],[1,1,3],[2,1,1]]',false),
(7,'{1,2,3,4,5,6,7,8}','[[1,1,8],[2,1,8],[1,2,7],[2,2,7],[1,8,8]]',false),
(8,'{8,7,6,5,4,3,2,1}','[[1,1,8],[2,1,8],[1,1,4],[2,1,4],[2,5,8]]',false),
(9,'{17,17,17,17,17,17,17,17}','[[1,1,8],[2,1,8],[1,4,4],[2,7,8]]',false),
(10,'{1,1000000000,1,1000000000,1,1000000000}','[[1,1,6],[2,1,3],[1,2,5],[2,4,6],[1,6,6]]',false),
(11,'{1,2,1,3,2,4,1,5,2,3}','[[1,1,10],[2,1,10],[1,3,7],[2,2,8],[1,5,5]]',false),
(12,'{1000000000,999999999,1000000000,999999998,1000000000}','[[1,1,5],[2,1,5],[1,2,4],[2,2,4]]',false),
(13,'{31,4,87,12,56,3,45,99,22,18,71,9,63,27,5,40}','[[1,1,16],[2,1,16],[1,3,12],[2,5,14],[1,8,8],[2,1,1]]',false),
(14,'{4,7,2,9,1}','[[1,1,5],[1,2,4],[1,3,3],[1,4,5],[1,1,1]]',false),
(15,'{4,7,2,9,1}','[[2,1,5],[2,2,4],[2,3,3],[2,4,5],[2,1,1]]',false),
(16,'{8,3,5,3,10,6}','[[1,1,1],[2,1,1],[1,3,3],[2,3,3],[1,6,6],[2,6,6]]',false),
(17,'{8,3,5,3,10,6}','[[1,1,2],[2,1,2],[1,2,3],[2,2,3],[1,5,6],[2,5,6]]',false),
(18,'{2,4,6,8,10,12}','[[1,1,6],[2,1,6],[1,1,3],[2,4,6],[1,4,6],[2,1,3]]',false),
(19,'{10,1,7,4,8}','[[1,2,4],[1,2,4],[1,2,4],[2,2,4],[2,2,4]]',false),
(20,'{1,2,3,4,5,6,7,8,9,10,11,12}','[[1,1,6],[2,2,8],[1,3,9],[2,4,10],[1,5,12],[2,1,12],[1,2,11]]',false),
(21,'{10,20,30,40,50,60}','[[1,1,3],[2,1,3],[1,4,6],[2,4,6],[1,2,5],[2,2,5],[1,1,6],[2,1,6]]',false),
(22,'{2,4,6,8,10}','[[2,1,5],[2,1,1],[2,2,4],[2,3,5]]',false),
(23,'{9,8,7,6,5,4,3,2,1}','[[2,1,9],[2,1,3],[2,4,6],[2,7,9]]',false),
(24,'{17,3,44,8,25,1,36,12,50,6,29,19,41,2,33,10}','[[1,1,16],[2,1,16],[1,2,15],[2,4,12],[1,7,13],[2,3,9],[1,5,5],[2,16,16]]',false),
(25,'{3,8,1,9,2,7,4,6,5,10}','[[1,1,10],[1,1,5],[1,6,10],[1,3,8],[1,4,4],[1,7,9]]',false),
(26,'{3,8,1,9,2,7,4,6,5,10}','[[2,1,10],[2,1,5],[2,6,10],[2,3,8],[2,4,4],[2,7,9]]',false),
(27,'{5,1,4,2,3}','[[1,1,5],[2,1,5],[1,2,4],[2,2,4],[1,3,3],[2,3,3]]',false),
(28,'{123456789,987654321,555555555,1}','[[1,1,4],[2,1,4],[1,2,3],[2,2,3],[1,4,4],[2,1,1]]',false)
    ) as case_data(case_index,score_list,queries,is_sample)
    order by case_index
  loop
    v_n := cardinality(fixture.scores);
    v_q := jsonb_array_length(fixture.queries);
    select array_agg(value order by value) into v_sorted
      from unnest(fixture.scores) as values_list(value);
    v_original_prefix := array_fill(0::bigint, array[v_n+1]);
    v_sorted_prefix := array_fill(0::bigint, array[v_n+1]);
    for v_i in 1..v_n loop
      v_original_prefix[v_i+1] := v_original_prefix[v_i] + fixture.scores[v_i];
      v_sorted_prefix[v_i+1] := v_sorted_prefix[v_i] + v_sorted[v_i];
    end loop;
    v_input := v_n::text || E'\n' || array_to_string(fixture.scores,' ') || E'\n' || v_q::text || E'\n';
    v_output := '';
    for query_row in select value from jsonb_array_elements(fixture.queries) as query_values(value) loop
      v_type := (query_row.value->>0)::integer;
      v_l := (query_row.value->>1)::integer;
      v_r := (query_row.value->>2)::integer;
      v_input := v_input || v_type::text || ' ' || v_l::text || ' ' || v_r::text || E'\n';
      if v_type=1 then
        v_answer := v_original_prefix[v_r+1] - v_original_prefix[v_l];
      else
        v_answer := v_sorted_prefix[v_r+1] - v_sorted_prefix[v_l];
      end if;
      v_output := v_output || v_answer::text || E'\n';
    end loop;
    insert into public.test_cases(problem_id,case_index,input,expected_output,is_sample,explanation)
    values (v_problem_id,fixture.case_index,v_input,v_output,fixture.is_sample,null);
  end loop;
end;
$$;

with score_values as (
  select i::integer as i, (mod(i::bigint*48271+12345,1000000000)+1)::bigint as score
  from generate_series(1,100000) as series(i)
),
original_prefixes as (
  select i, sum(score) over(order by i rows between unbounded preceding and current row) as prefix
  from score_values
),
sorted_prefixes as (
  select row_number() over(order by score,i)::integer as i,
    sum(score) over(order by score,i rows between unbounded preceding and current row) as prefix
  from score_values
),
queries as (
  select i as query_index,
    case when i%2=1 then 1 else 2 end as query_type,
    case when i%4 in (1,2) then 1 else ((i*7919)%100000)+1 end as l,
    case when i%4 in (1,2) then 100000 else least(100000,((i*7919)%100000)+1+(i%2)) end as r
  from generate_series(1,100000) as series(i)
),
scores_text as (
  select string_agg(score::text,' ' order by i) as value from score_values
),
queries_text as (
  select string_agg(query_type::text||' '||l::text||' '||r::text,E'\n' order by query_index) as value
  from queries
),
answer_text as (
  select string_agg((case when q.query_type=1 then ohi.prefix-coalesce(olo.prefix,0)
                          else shi.prefix-coalesce(slo.prefix,0) end)::text,E'\n' order by q.query_index) as value
  from queries q
  join original_prefixes ohi on ohi.i=q.r
  left join original_prefixes olo on olo.i=q.l-1
  join sorted_prefixes shi on shi.i=q.r
  left join sorted_prefixes slo on slo.i=q.l-1
)
insert into public.test_cases(problem_id,case_index,input,expected_output,is_sample,explanation)
select (select id from public.problems where slug='code-quest-tryout-statistics'),29,
  E'100000\n'||scores_text.value||E'\n100000\n'||queries_text.value||E'\n',
  answer_text.value||E'\n',false,null
from scores_text,queries_text,answer_text;

insert into public.reference_solutions(problem_id,python,cpp,published)
values (
  (select id from public.problems where slug='code-quest-tryout-statistics'),
  $python$import sys

def solve():
    data = list(map(int, sys.stdin.buffer.read().split()))
    pos = 0
    n = data[pos]
    pos += 1
    scores = data[pos:pos + n]
    pos += n
    q = data[pos]
    pos += 1

    original_prefix = [0] * (n + 1)
    for i, value in enumerate(scores, 1):
        original_prefix[i] = original_prefix[i - 1] + value

    ordered = sorted(scores)
    sorted_prefix = [0] * (n + 1)
    for i, value in enumerate(ordered, 1):
        sorted_prefix[i] = sorted_prefix[i - 1] + value

    answers = []
    for _ in range(q):
        query_type, left, right = data[pos:pos + 3]
        pos += 3
        prefix = original_prefix if query_type == 1 else sorted_prefix
        answers.append(str(prefix[right] - prefix[left - 1]))
    sys.stdout.write("\n".join(answers))

if __name__ == "__main__":
    solve()$python$,
  $cpp$#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    vector<long long> scores(n), ordered;
    for (long long &score : scores) cin >> score;

    vector<long long> originalPrefix(n + 1, 0);
    for (int i = 0; i < n; ++i)
        originalPrefix[i + 1] = originalPrefix[i] + scores[i];

    ordered = scores;
    sort(ordered.begin(), ordered.end());
    vector<long long> sortedPrefix(n + 1, 0);
    for (int i = 0; i < n; ++i)
        sortedPrefix[i + 1] = sortedPrefix[i] + ordered[i];

    int q;
    cin >> q;
    for (int queryIndex = 0; queryIndex < q; ++queryIndex) {
        int type, left, right;
        cin >> type >> left >> right;
        const auto &prefix = (type == 1 ? originalPrefix : sortedPrefix);
        cout << prefix[right] - prefix[left - 1] << '\n';
    }
    return 0;
}$cpp$,
  false
)
on conflict(problem_id) do update
set python=excluded.python,cpp=excluded.cpp,published=false,updated_at=now();
