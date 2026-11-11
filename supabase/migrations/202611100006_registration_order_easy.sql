-- Set the Registration Order problem's difficulty to Easy, preserving its
-- problem ID, test cases, checker configuration, and submissions.
update public.problems
set difficulty = 'Easy', updated_at = now()
where slug = 'code-quest-tryouts-registration-order'
   or lower(title) = lower('Code Quest Tryouts: Registration Order');
