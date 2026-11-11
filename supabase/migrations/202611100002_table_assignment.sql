-- Add the Table Assignment problem to the existing, tag-free Code Quest section.
-- This seed is idempotent and changes only this problem and its associated data.
do $$
declare
  v_problem_id uuid;
  v_reserved_id constant uuid := 'a0000000-0000-4000-8000-000000000005';
begin
  select p.id into v_problem_id
  from public.problems p
  where p.slug = 'code-quest-tryouts-table-assignment'
     or lower(p.title) = lower('Code Quest Tryouts: Table Assignment')
  order by (p.slug = 'code-quest-tryouts-table-assignment') desc
  limit 1;

  if v_problem_id is null then
    if exists (select 1 from public.problems p where p.id = v_reserved_id) then
      insert into public.problems(
        slug,title,section,difficulty,statement,input_format,output_format,constraints,
        time_limit_ms,memory_limit_mb,published
      ) values (
        'code-quest-tryouts-table-assignment',
        'Code Quest Tryouts: Table Assignment',
        'Code Quest Tryout',
        'Easy',
        $statement$The Code Quest tryouts have $n$ groups of students. The $i$-th group contains $s_i$ students, where $1 \le s_i \le 4$.

The organizers have tables that each seat at most four students. Students from the same group must sit together, so a group cannot be split across multiple tables. Groups may share a table as long as its capacity is not exceeded.

Find the minimum number of tables needed to seat all groups.$statement$,
        $input$The first line contains an integer $n$ ($1 \le n \le 10^5$), the number of groups.

The second line contains $n$ integers $s_1,s_2,\ldots,s_n$ ($1 \le s_i \le 4$), where $s_i$ is the number of students in the $i$-th group.$input$,
        $output$Print one integer: the minimum number of tables required.$output$,
        $constraints$- $1 \le n \le 10^5$
- $1 \le s_i \le 4$
- Each table seats at most four students.
- A group cannot be split between tables.$constraints$,
        3000,256,true
      ) returning id into v_problem_id;
    else
      insert into public.problems(
        id,slug,title,section,difficulty,statement,input_format,output_format,constraints,
        time_limit_ms,memory_limit_mb,published
      ) values (
        v_reserved_id,
        'code-quest-tryouts-table-assignment',
        'Code Quest Tryouts: Table Assignment',
        'Code Quest Tryout',
        'Easy',
        $statement$The Code Quest tryouts have $n$ groups of students. The $i$-th group contains $s_i$ students, where $1 \le s_i \le 4$.

The organizers have tables that each seat at most four students. Students from the same group must sit together, so a group cannot be split across multiple tables. Groups may share a table as long as its capacity is not exceeded.

Find the minimum number of tables needed to seat all groups.$statement$,
        $input$The first line contains an integer $n$ ($1 \le n \le 10^5$), the number of groups.

The second line contains $n$ integers $s_1,s_2,\ldots,s_n$ ($1 \le s_i \le 4$), where $s_i$ is the number of students in the $i$-th group.$input$,
        $output$Print one integer: the minimum number of tables required.$output$,
        $constraints$- $1 \le n \le 10^5$
- $1 \le s_i \le 4$
- Each table seats at most four students.
- A group cannot be split between tables.$constraints$,
        3000,256,true
      ) returning id into v_problem_id;
    end if;
  else
    update public.problems set
      slug = 'code-quest-tryouts-table-assignment',
      title = 'Code Quest Tryouts: Table Assignment',
      section = 'Code Quest Tryout',
      difficulty = 'Easy',
      statement = $statement$The Code Quest tryouts have $n$ groups of students. The $i$-th group contains $s_i$ students, where $1 \le s_i \le 4$.

The organizers have tables that each seat at most four students. Students from the same group must sit together, so a group cannot be split across multiple tables. Groups may share a table as long as its capacity is not exceeded.

Find the minimum number of tables needed.$statement$,
      input_format = $input$The first line contains an integer $n$ ($1 \le n \le 10^5$), the number of groups.

The second line contains $n$ integers $s_1,s_2,\ldots,s_n$ ($1 \le s_i \le 4$), where $s_i$ is the number of students in the $i$-th group.$input$,
      output_format = $output$Print one integer: the minimum number of tables required.$output$,
      constraints = $constraints$- $1 \le n \le 10^5$
- $1 \le s_i \le 4$
- Each table seats at most four students.
- A group cannot be split between tables.$constraints$,
      time_limit_ms = 3000,
      memory_limit_mb = 256,
      published = true,
      updated_at = now()
    where id = v_problem_id;
  end if;

  -- Code Quest problems have no topic tags.
  delete from public.problem_tags where problem_id = v_problem_id;
  delete from public.test_cases where problem_id = v_problem_id;
  delete from public.reference_solutions where problem_id = v_problem_id;
end;
$$;

-- Exactly 2 public samples and 29 hidden cases (31 official cases total).
-- The expected values are calculated from the frequency-based reference rule.
do $$
declare
  fixture record;
  v_problem_id uuid;
  c1 integer;
  c2 integer;
  c3 integer;
  c4 integer;
  v_table_count integer;
  ones_left integer;
  expected integer;
begin
  select id into v_problem_id
  from public.problems
  where slug = 'code-quest-tryouts-table-assignment';

  for fixture in
    select * from (values
      (0, array[1,2,4,3,3]::integer[], true, 'The group of size 1 shares a table with one group of size 3. The other group of size 3, the group of size 4, and the group of size 2 each use another table.'::text),
      (1, array[2,3,4,4,2,1,3,1]::integer[], true, null::text),
      (2, array[1]::integer[], false, null::text),
      (3, array[2]::integer[], false, null::text),
      (4, array[3]::integer[], false, null::text),
      (5, array[4]::integer[], false, null::text),
      (6, array[1,3]::integer[], false, null::text),
      (7, array[1,4]::integer[], false, null::text),
      (8, array[1,1,1,1,1]::integer[], false, null::text),
      (9, array[2,2,2,2,2]::integer[], false, null::text),
      (10, array[3,3,3,3,3]::integer[], false, null::text),
      (11, array[4,4,4,4,4]::integer[], false, null::text),
      (12, array[3,3,1,3,1]::integer[], false, null::text),
      (13, array[3,3,3,1]::integer[], false, null::text),
      (14, array[1,1,1,1,1,1,3]::integer[], false, null::text),
      (15, array[2,2,2,2,2,2]::integer[], false, null::text),
      (16, array[2,2,2,1,1,1,1]::integer[], false, null::text),
      (17, array[1,1,1,1,1,1,1,1,1]::integer[], false, null::text),
      (18, array[1,2,3,4,1,2,3,4]::integer[], false, null::text),
      (19, array[3,2,3]::integer[], false, null::text),
      (20, array[1,1,3]::integer[], false, null::text),
      (21, array[1,1,1,3]::integer[], false, null::text),
      (22, array[2,2,1,1,1]::integer[], false, null::text),
      (23, array[2,1,1]::integer[], false, null::text),
      (24, array[4,1,1,1,1]::integer[], false, null::text),
      (25, array[3,3,1,1,1,1,1]::integer[], false, null::text)
    ) as fixtures(case_index, groups, is_sample, explanation)
  loop
    select
      count(*) filter (where size = 1)::integer,
      count(*) filter (where size = 2)::integer,
      count(*) filter (where size = 3)::integer,
      count(*) filter (where size = 4)::integer
    into c1,c2,c3,c4
    from unnest(fixture.groups) as sizes(size);

    v_table_count := c4 + c3 + (c2 / 2);
    ones_left := greatest(0, c1 - c3);
    if c2 % 2 = 1 then
      v_table_count := v_table_count + 1;
      ones_left := greatest(0, ones_left - 2);
    end if;
    expected := v_table_count + ((ones_left + 3) / 4);

    insert into public.test_cases(problem_id,case_index,input,expected_output,is_sample,explanation)
    values (
      v_problem_id,
      fixture.case_index,
      cardinality(fixture.groups)::text || E'\n' || array_to_string(fixture.groups, ' ') || E'\n',
      expected::text || E'\n',
      fixture.is_sample,
      fixture.explanation
    );
  end loop;
end;
$$;

-- Five 100,000-group cases exercise maximum input size with varied group mixes.
with kinds(case_index, kind) as (
  values (26,'ones'), (27,'fours'), (28,'ones-threes'), (29,'twos-threes'), (30,'deterministic-random')
), group_values as (
  select k.case_index, i,
    case k.kind
      when 'ones' then 1
      when 'fours' then 4
      when 'ones-threes' then case when i % 2 = 1 then 1 else 3 end
      when 'twos-threes' then case when i % 2 = 1 then 2 else 3 end
      else mod(i::bigint * 48271 + 17, 4)::integer + 1
    end as size
  from kinds k
  cross join generate_series(1,100000) as series(i)
), summaries as (
  select case_index,
    string_agg(size::text, ' ' order by i) as sizes_text,
    count(*) filter (where size=1)::integer as c1,
    count(*) filter (where size=2)::integer as c2,
    count(*) filter (where size=3)::integer as c3,
    count(*) filter (where size=4)::integer as c4
  from group_values
  group by case_index
), counts as (
  select case_index, sizes_text,
    c4 + c3 + (c2 / 2) + case when c2 % 2 = 1 then 1 else 0 end
      + ((greatest(0, greatest(0,c1-c3) - case when c2 % 2 = 1 then 2 else 0 end) + 3) / 4) as answer
  from summaries
)
insert into public.test_cases(problem_id,case_index,input,expected_output,is_sample,explanation)
select p.id, counts.case_index,
  E'100000\n' || counts.sizes_text || E'\n',
  counts.answer::text || E'\n',
  false,
  null
from counts
cross join public.problems p
where p.slug = 'code-quest-tryouts-table-assignment'
on conflict(problem_id,case_index) do update
set input=excluded.input, expected_output=excluded.expected_output,
    is_sample=false, explanation=null;

-- Private judge references; never publish these to student-facing queries.
insert into public.reference_solutions(problem_id,python,cpp,published)
select p.id,
$python$import sys

def solve():
    data = list(map(int, sys.stdin.buffer.read().split()))
    n = data[0]
    counts = [0, 0, 0, 0, 0]
    for size in data[1:1 + n]:
        counts[size] += 1

    ones, twos, threes, fours = counts[1:]
    tables = fours + threes + twos // 2
    ones = max(0, ones - threes)
    if twos % 2:
        tables += 1
        ones = max(0, ones - 2)
    tables += (ones + 3) // 4
    print(tables)

if __name__ == "__main__":
    solve()$python$,
$cpp$#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    long long count1 = 0, count2 = 0, count3 = 0, count4 = 0;
    for (int i = 0; i < n; ++i) {
        int size;
        cin >> size;
        if (size == 1) ++count1;
        else if (size == 2) ++count2;
        else if (size == 3) ++count3;
        else ++count4;
    }

    long long tables = count4 + count3 + count2 / 2;
    count1 = max(0LL, count1 - count3);
    if (count2 % 2 != 0) {
        ++tables;
        count1 = max(0LL, count1 - 2);
    }
    tables += (count1 + 3) / 4;
    cout << tables << '\n';
    return 0;
}$cpp$,
false
from public.problems p
where p.slug = 'code-quest-tryouts-table-assignment'
on conflict(problem_id) do update
set python=excluded.python, cpp=excluded.cpp, published=false, updated_at=now();
