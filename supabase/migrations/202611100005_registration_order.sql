-- Server-private checker configuration. Problems without a row keep exact output checking.
create table if not exists public.problem_judge_configs (
  problem_id uuid primary key references public.problems(id) on delete cascade,
  output_checker text not null default 'exact'
    check (output_checker in ('exact','single_reverse_segment')),
  created_at timestamptz not null default now()
);
alter table public.problem_judge_configs enable row level security;
drop policy if exists "No client judge config access" on public.problem_judge_configs;
create policy "No client judge config access" on public.problem_judge_configs
  for all to anon, authenticated using (false) with check (false);
revoke all on public.problem_judge_configs from public, anon, authenticated;
grant all on public.problem_judge_configs to service_role;

do $$
declare
  v_problem_id uuid;
  v_reserved_id constant uuid := 'a0000000-0000-4000-8000-000000000006';
begin
  select id into v_problem_id from public.problems
  where slug='code-quest-tryouts-registration-order'
     or lower(title)=lower('Code Quest Tryouts: Registration Order')
  order by (slug='code-quest-tryouts-registration-order') desc limit 1;

  if v_problem_id is null then
    if exists(select 1 from public.problems where id=v_reserved_id) then
      insert into public.problems(slug,title,section,difficulty,statement,input_format,output_format,constraints,time_limit_ms,memory_limit_mb,published)
      values('code-quest-tryouts-registration-order','Code Quest Tryouts: Registration Order','Code Quest Tryout','Easy',
        $statement$The Computer Science Society (CSS) is preparing the registration list for the Code Quest tryouts.

There are $n$ registered students, each assigned a distinct registration ID. Before the tryouts begin, CSS needs the IDs arranged in strictly increasing order.

However, the current registration list is not necessarily sorted.

The registration system allows only one modification: reversing a single consecutive segment of the list.

Determine whether it is possible to arrange the entire list in strictly increasing order by reversing exactly one segment.

If it is possible, output the starting and ending positions of a segment that should be reversed. Otherwise, output "no".

A segment containing only one element may be reversed. Therefore, an already sorted list is considered valid.$statement$,
        $input$The first line contains an integer $n$ ($1 \le n \le 10^5$), the number of registered students.

The second line contains $n$ distinct integers $a_1, a_2, \ldots, a_n$ ($1 \le a_i \le 10^9$), representing their registration IDs in the current order.$input$,
        'Print `yes` and two 1-indexed positions `l r` if reversing that segment makes the list strictly increasing. Require $1 \le l \le r \le n$. Print `no` if no such reversal exists. For an already sorted list, print `yes` and any single-element segment.',
        $constraints$- $1 \le n \le 10^5$
- All $a_i$ are distinct.
- $1 \le a_i \le 10^9$
- $1 \le l \le r \le n$.$constraints$,1000,256,true)
      returning id into v_problem_id;
    else
      insert into public.problems(id,slug,title,section,difficulty,statement,input_format,output_format,constraints,time_limit_ms,memory_limit_mb,published)
      values(v_reserved_id,'code-quest-tryouts-registration-order','Code Quest Tryouts: Registration Order','Easy',
        $statement$The Computer Science Society (CSS) is preparing the registration list for the Code Quest tryouts.

There are $n$ registered students, each assigned a distinct registration ID. Before the tryouts begin, CSS needs the IDs arranged in strictly increasing order.

However, the current registration list is not necessarily sorted.

The registration system allows only one modification: reversing a single consecutive segment of the list.

Determine whether it is possible to arrange the entire list in strictly increasing order by reversing exactly one segment.

If it is possible, output the starting and ending positions of a segment that should be reversed. Otherwise, output "no".

A segment containing only one element may be reversed. Therefore, an already sorted list is considered valid.$statement$,
        $input$The first line contains an integer $n$ ($1 \le n \le 10^5$), the number of registered students.

The second line contains $n$ distinct integers $a_1, a_2, \ldots, a_n$ ($1 \le a_i \le 10^9$), representing their registration IDs in the current order.$input$,
        'Print `yes` and two 1-indexed positions `l r` if reversing that segment makes the list strictly increasing. Require $1 \le l \le r \le n$. Print `no` if no such reversal exists. For an already sorted list, print `yes` and any single-element segment.',
        $constraints$- $1 \le n \le 10^5$
- All $a_i$ are distinct.
- $1 \le a_i \le 10^9$
- $1 \le l \le r \le n$.$constraints$,1000,256,true)
      returning id into v_problem_id;
    end if;
  else
    update public.problems set
      slug='code-quest-tryouts-registration-order',title='Code Quest Tryouts: Registration Order',
      section='Code Quest Tryout',difficulty='Easy',time_limit_ms=1000,memory_limit_mb=256,
      published=true,updated_at=now()
    where id=v_problem_id;
  end if;

  delete from public.problem_tags where problem_id=v_problem_id;
  delete from public.test_cases where problem_id=v_problem_id;
  delete from public.reference_solutions where problem_id=v_problem_id;
  insert into public.problem_judge_configs(problem_id,output_checker)
  values(v_problem_id,'single_reverse_segment')
  on conflict(problem_id) do update set output_checker=excluded.output_checker;
end;
$$;

-- Keep a matching pre-existing title/slug synchronized with the official wording.
update public.problems set
  statement=$statement$The Computer Science Society (CSS) is preparing the registration list for the Code Quest tryouts.

There are $n$ registered students, each assigned a distinct registration ID. Before the tryouts begin, CSS needs the IDs arranged in strictly increasing order.

However, the current registration list is not necessarily sorted.

The registration system allows only one modification: reversing a single consecutive segment of the list.

Determine whether it is possible to arrange the entire list in strictly increasing order by reversing exactly one segment.

If it is possible, output the starting and ending positions of a segment that should be reversed. Otherwise, output "no".

A segment containing only one element may be reversed. Therefore, an already sorted list is considered valid.$statement$,
  input_format=$input$The first line contains an integer $n$ ($1 \le n \le 10^5$), the number of registered students.

The second line contains $n$ distinct integers $a_1, a_2, \ldots, a_n$ ($1 \le a_i \le 10^9$), representing their registration IDs in the current order.$input$,
  output_format=$output$If possible, print `yes` on the first line and two 1-indexed positions `l r` on the second line. Reversing that segment must make the list strictly increasing. Require $1 \le l \le r \le n$. If no reversal works, print `no`.

An already sorted list is possible: print `yes` and any single-element segment.$output$,
  constraints=$constraints$- $1 \le n \le 10^5$
- All $a_i$ are distinct.
- $1 \le a_i \le 10^9$
- $1 \le l \le r \le n$.$constraints$,
  updated_at=now()
where slug='code-quest-tryouts-registration-order';

-- 40 official test cases: four public examples, 31 small hidden cases, and five large hidden cases.
do $$
declare
  fixture record;
  v_problem_id uuid;
  v_values bigint[];
  v_sorted bigint[];
  v_n integer;
  v_left integer;
  v_right integer;
  v_i integer;
  v_possible boolean;
  v_candidate bigint;
  v_expected text;
begin
  select id into v_problem_id from public.problems where slug='code-quest-tryouts-registration-order';
  for fixture in
    select * from (values
      (0,array[2,5,9,8,7,12]::bigint[],true,'Reversing positions 3 through 5 makes the list increasing.'::text),
      (1,array[1,7,4,3,10]::bigint[],true,null::text),
      (2,array[4,2,3,1,5]::bigint[],true,null::text),
      (3,array[3,6,9,12]::bigint[],true,'An already sorted list is valid using a single-element segment.'::text),
      (4,array[1]::bigint[],false,null::text),
      (5,array[2,1]::bigint[],false,null::text),
      (6,array[1,2]::bigint[],false,null::text),
      (7,array[3,2,1]::bigint[],false,null::text),
      (8,array[1,3,2,4]::bigint[],false,null::text),
      (9,array[4,3,2,1]::bigint[],false,null::text),
      (10,array[2,6,5,4,3,7]::bigint[],false,null::text),
      (11,array[6,5,4,3,2,1]::bigint[],false,null::text),
      (12,array[2,1,3,4]::bigint[],false,null::text),
      (13,array[1,2,4,3]::bigint[],false,null::text),
      (14,array[10,20,15,25]::bigint[],false,null::text),
      (15,array[8,6,7,5,3,1]::bigint[],false,null::text),
      (16,array[1000000000,999999999,999999998]::bigint[],false,null::text),
      (17,array[1,1000000000,5]::bigint[],false,null::text),
      (18,array[2,4,3,1,5]::bigint[],false,null::text),
      (19,array[1,5,4,6,3,7]::bigint[],false,null::text),
      (20,array[12,9,7,3,1]::bigint[],false,null::text),
      (21,array[5,1,2,3,4]::bigint[],false,null::text),
      (22,array[1,2,6,5,4,3,7,8]::bigint[],false,null::text),
      (23,array[1,3,2,5,4,6]::bigint[],false,null::text),
      (24,array[100,1,2,3]::bigint[],false,null::text),
      (25,array[1,2,3,4,5,6,7]::bigint[],false,null::text),
      (26,array[9,8,7,6,5,4,3]::bigint[],false,null::text),
      (27,array[1,2,3,9,8,7,6,10]::bigint[],false,null::text),
      (28,array[1,4,5,2,3,6,7]::bigint[],false,null::text),
      (29,array[999999997,999999999,999999998,1000000000]::bigint[],false,null::text),
      (30,array[2,1,4,3,6,5]::bigint[],false,null::text),
      (31,array[1,9,8,7,6,5,10,11]::bigint[],false,null::text),
      (32,array[2,3,1,4]::bigint[],false,null::text),
      (33,array[1,4,3,2,5,7,6,8]::bigint[],false,null::text),
      (34,array[7,2,5,3,6,1,4]::bigint[],false,null::text)
    ) as fixtures(case_index,registration_ids,is_sample,explanation)
    order by case_index
  loop
    v_values:=fixture.registration_ids;
    v_n:=cardinality(v_values);
    select array_agg(value order by value) into v_sorted from unnest(v_values) as entries(value);
    v_left:=1;
    while v_left<=v_n and v_values[v_left]=v_sorted[v_left] loop v_left:=v_left+1; end loop;
    if v_left>v_n then
      v_left:=1; v_right:=1; v_possible:=true;
    else
      v_right:=v_n;
      while v_values[v_right]=v_sorted[v_right] loop v_right:=v_right-1; end loop;
      v_possible:=true;
      for v_i in 1..v_n loop
        v_candidate:=case when v_i between v_left and v_right then v_values[v_left+v_right-v_i] else v_values[v_i] end;
        if v_candidate<>v_sorted[v_i] then v_possible:=false; exit; end if;
      end loop;
    end if;
    v_expected:=case when v_possible then 'yes'||E'\n'||v_left::text||' '||v_right::text||E'\n' else 'no'||E'\n' end;
    if fixture.case_index=0 then v_expected:='yes'||E'\n3 5\n'; end if;
    if fixture.case_index=1 then v_expected:='yes'||E'\n2 4\n'; end if;
    if fixture.case_index=2 then v_expected:='no'||E'\n'; end if;
    if fixture.case_index=3 then v_expected:='yes'||E'\n1 1\n'; end if;
    insert into public.test_cases(problem_id,case_index,input,expected_output,is_sample,explanation)
    values(v_problem_id,fixture.case_index,v_n::text||E'\n'||array_to_string(v_values,' ')||E'\n',v_expected,fixture.is_sample,fixture.explanation);
  end loop;
end;
$$;

-- Five maximum-size private tests. All inputs are permutations with distinct IDs.
with cases(case_index,expected_output,kind) as (
  values (35,'yes'||E'\n1 1\n','sorted'),
         (36,'yes'||E'\n1 100000\n','reversed'),
         (37,'yes'||E'\n25001 75000\n','one-reversed-segment'),
         (38,'no'||E'\n','two-swaps'),
         (39,'no'||E'\n','affine-permutation')
), lists as (
  select cases.case_index,cases.expected_output,i,
    case cases.kind
      when 'sorted' then i::bigint
      when 'reversed' then (100001-i)::bigint
      when 'one-reversed-segment' then case when i between 25001 and 75000 then (100001-i)::bigint else i::bigint end
      when 'two-swaps' then case
        when i=25000 then 25001::bigint when i=25001 then 25000::bigint
        when i=75000 then 75001::bigint when i=75001 then 75000::bigint else i::bigint end
      else (mod(i::bigint*48271+17,100000)+1)::bigint
    end as value
  from cases cross join generate_series(1,100000) as positions(i)
), packed as (
  select case_index,expected_output,E'100000\n'||string_agg(value::text,' ' order by i)||E'\n' as input
  from lists group by case_index,expected_output
)
insert into public.test_cases(problem_id,case_index,input,expected_output,is_sample,explanation)
select p.id,packed.case_index,packed.input,packed.expected_output,false,null
from packed cross join public.problems p
where p.slug='code-quest-tryouts-registration-order';

-- Private reference implementations; the browser receives only public samples.
insert into public.reference_solutions(problem_id,python,cpp,published)
select p.id,
$python$import sys

def solve():
    data = list(map(int, sys.stdin.buffer.read().split()))
    n = data[0]
    values = data[1:1 + n]
    ordered = sorted(values)
    left = 0
    while left < n and values[left] == ordered[left]:
        left += 1
    if left == n:
        print("yes")
        print(1, 1)
        return
    right = n - 1
    while values[right] == ordered[right]:
        right -= 1
    candidate = values[:left] + values[left:right + 1][::-1] + values[right + 1:]
    if candidate == ordered:
        print("yes")
        print(left + 1, right + 1)
    else:
        print("no")

if __name__ == "__main__":
    solve()$python$,
$cpp$#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    cin >> n;
    vector<long long> values(n);
    for (auto &value : values) cin >> value;
    vector<long long> ordered = values;
    sort(ordered.begin(), ordered.end());
    int left = 0;
    while (left < n && values[left] == ordered[left]) ++left;
    if (left == n) {
        cout << "yes\n1 1\n";
        return 0;
    }
    int right = n - 1;
    while (values[right] == ordered[right]) --right;
    reverse(values.begin() + left, values.begin() + right + 1);
    if (values == ordered) cout << "yes\n" << left + 1 << ' ' << right + 1 << '\n';
    else cout << "no\n";
    return 0;
}$cpp$,
false
from public.problems p
where p.slug='code-quest-tryouts-registration-order'
on conflict(problem_id) do update
set python=excluded.python,cpp=excluded.cpp,published=false,updated_at=now();
