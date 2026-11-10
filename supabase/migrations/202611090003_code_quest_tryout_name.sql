-- Rename the existing problem and update only its student-facing statement.
-- Test cases, tags, reference solutions, submissions, and the problem ID stay intact.
with target_problem as (
  select p.id
  from public.problems p
  where p.slug in ('css-practice-statistics', 'code-quest-tryout-statistics')
     or lower(p.title) in ('css practice statistics', 'code quest tryout statistics')
  order by (p.slug = 'code-quest-tryout-statistics') desc
  limit 1
)
update public.problems p
set slug = 'code-quest-tryout-statistics',
    title = 'Code Quest Tryout Statistics',
    statement = $statement$## Code Quest Tryout Statistics

Khang has prepared $N$ programming problems for the Code Quest tryouts. Each problem has a score, and the scores are recorded in an array $a_1, a_2, \ldots, a_n$.

Khang wants to analyze these scores by asking two types of queries:

1. Given two integers $l$ and $r$ ($1 \le l \le r \le n$), find the sum of the scores from position $l$ to $r$ in the original array: $\displaystyle \sum_{i=l}^{r} a_i$

2. Let $u_i$ be the $i$-th smallest score (the value at position $i$ when all scores are arranged in non-decreasing order). Given two integers $l$ and $r$ ($1 \le l \le r \le n$), find: $\displaystyle \sum_{i=l}^{r} u_i$

For each query, output the corresponding sum.$statement$,
    updated_at = now()
from target_problem t
where p.id = t.id;
