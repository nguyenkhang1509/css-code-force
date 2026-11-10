# Computer Science Society (American Heritage School Broward)

A full-stack competitive programming platform for a school Computer Science Society. Students can create accounts, practice published problems, run sample tests, submit Python 3 or C++17 solutions to an isolated judge, and follow their progress. Admins maintain the problem bank in the website.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS 4
- Local, accessible UI primitives in `components/ui` following the shadcn/ui component pattern
- Supabase Auth and PostgreSQL with row-level security
- Monaco Editor, Markdown, GitHub-flavoured Markdown, and KaTeX
- Vercel Sandbox SDK (`@vercel/sandbox`) for untrusted code execution
- Vercel Functions for request handling and Vercel deployments from GitHub

## Local development

Requirements: Node.js 22 or later, npm, a Supabase project, and a Vercel project linked to the local folder for Sandbox OIDC.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project and copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY` from the Supabase **Connect** panel and **Project Settings → API Keys**. Never prefix the service role key with `NEXT_PUBLIC_` or commit `.env.local`.

3. Apply the SQL migrations in filename order in **Supabase → SQL Editor**:

   - `supabase/migrations/202611070001_initial_schema.sql`
   - `supabase/migrations/202611070002_seed_problems.sql`

   The first migration creates the schema, triggers, security policies, rate limiter, judge lease, leaderboard functions, and admin-only problem-save function. The second seeds the three example problems and reference solutions.

4. In **Supabase → Authentication → URL Configuration**, add the local URL `http://localhost:3000` and the deployed Vercel URL to the allowed redirect URLs. Email confirmation can remain enabled; students will receive a confirmation email before their first login.

5. Connect the project to Vercel Sandbox for local judging, then pull its development OIDC token:

   ```bash
   npx vercel link
   npx vercel env pull .env.local
   ```

   In a deployed Vercel Function, Sandbox OIDC is provided automatically. Do not pass Supabase or Vercel credentials to the Sandbox.

6. Start the app:

   ```bash
   npm run dev
   ```

The problem list and authentication pages explain when Supabase setup is missing. Judging does not return a successful verdict if the Sandbox or database is unavailable.

## Create the first admin

1. Sign up normally using the account that should administer the problem bank, and confirm its email if confirmation is enabled.
2. Open **Supabase → SQL Editor** and promote that exact account by username:

   ```sql
   update public.profiles
   set role = 'admin'
   where username = 'your_username';
   ```

3. Verify that exactly one row changed, then sign out and back in. `/admin` and every admin API route check the role server-side. RLS denies role changes from user sessions; the service role key remains server-only.

## Add problems and tests

Open `/admin` and choose **New problem**. Write the statement, input/output descriptions, constraints, tags, time/memory limits, and test cases. Problem statements and sample explanations support Markdown and LaTeX (`$x^2$`). At least one test case must be marked **Public sample**. The rest stay private and are only read by the server judge.

The editor accepts up to 250 test cases per problem, with a combined 4 MB input/output cap. Individual judge inputs are capped at 3 MB and expected outputs at 2 MB. The admin form can import a JSON array of cases or an object containing `test_cases`, for example:

```json
[
  { "input": "1 2\n", "expected_output": "3\n", "is_sample": true, "explanation": "1 + 2 = 3." },
  { "input": "-4 7\n", "expected_output": "3\n", "is_sample": false }
]
```

Draft problems are visible to admins only. Reference solutions are private by default and are not included in student problem queries. An admin can choose to publish them from the problem editor.

### Add CSS Practice Statistics

The idempotent seed migration is located at supabase/migrations/202611090001_css_practice_statistics.sql. For an already-created Supabase project, open the project dashboard, select **SQL Editor** in the left sidebar, choose **New query**, paste the entire migration file from the repository, then click **Run**. It preserves the existing UUID if this problem is already present and replaces only this problem's tags, tests, and private reference solution. The database generates a UUID for a new problem because problem IDs in this schema are UUIDs, not sequential numbers.

The migration creates 30 official cases: 2 public examples and 28 hidden tests. Its large hidden case has n = q = 100,000, with alternating full-range and short-range queries. The SQL migration increases the existing test-data caps to fit this case.

## Judge design and limits

`lib/judge/types.ts` defines the replaceable `JudgeProvider` boundary. `VercelSandboxJudge` creates a new disposable Sandbox for each run or submission. Python sandboxes start with outbound networking denied. If C++17's `g++` is missing, the trusted setup step installs it while the firewall is open, then changes the Sandbox to `deny-all` before compilation and student execution. No app credentials or hidden cases enter student code.

The service compiles C++ once per submission, starts a separate process for each test, and stops at the first failure. Each process has a wall timeout, a shell virtual-address-space cap, a file-size cap, and a 2 MB stdout cap. An overall 80-second test budget, 64 KB source cap, 4 MB total judge-data cap, per-user rate limits, and a database-coordinated three-slot concurrency limit keep requests bounded. Stale concurrency leases expire after three minutes if a function is terminated before cleanup.

Output comparison converts CRLF to LF, ignores trailing spaces/tabs at the end of each line, and ignores final newline characters. Leading whitespace, spaces within a line, and character case remain significant.

Vercel Sandbox reports command duration, which is saved as execution time. The SDK does not provide a trustworthy per-program memory measurement, so the app leaves memory usage blank. The OS virtual-memory cap is best-effort: it is not an RSS meter, and the app reports Memory Limit Exceeded only when the runtime emits a recognizable allocation error. Other resource failures remain runtime errors or judging errors rather than guessed verdicts.

The submission endpoint is synchronous, not a pretend background queue. It has a 180-second Vercel Function maximum and an 80-second total test budget. New Vercel projects use Fluid Compute by default, where Hobby functions support up to 300 seconds; enable Fluid Compute for an older Vercel project before deploying. Without Fluid Compute, Hobby functions have a 60-second maximum and the judge can time out. Infrastructure failures become **Judging Error** and are stored as such. Browser disconnects can make the response unavailable; the saved submission page remains the source of truth.

## Deploy to Vercel

1. Push this folder to a GitHub repository. For the Vercel Hobby plan, use a repository owned by a personal GitHub account: Vercel currently does not connect Hobby projects to GitHub organization-owned repositories. Import it into Vercel to enable automatic preview and production deployments on pushes.
2. Add these environment variables in **Vercel → Project → Settings → Environment Variables** for Preview and Production:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)

   Do not configure `VERCEL_OIDC_TOKEN` for production; Vercel provides its project OIDC identity. For local development, use `vercel link` and `vercel env pull` as shown above.

3. Deploy with the Vercel Git integration, or run `npx vercel` and `npx vercel --prod`. Build command: `npm run build`.
4. Add the production URL to Supabase Auth's allowed redirect URLs. Promote the first admin with the SQL command above.
5. Submit an example Python and C++ solution to confirm that the deployed project can create Vercel Sandboxes. Monitor Sandbox usage and function logs in the Vercel dashboard.

The app has no required paid API or dependency. Vercel currently includes Sandbox usage on Hobby (5 active CPU-hours/month, 420 GB-hours of provisioned memory, 5,000 creations, and 20 GB of data transfer); Sandbox usage is capped and judging may stop when the included quota is consumed. Supabase Free includes 50,000 monthly active users and a 500 MB database; inactive free projects can pause after a week. These quotas are appropriate for a small club, not a large public judge. Vercel Hobby is for personal, non-commercial use, and its GitHub integration excludes organization-owned repositories; check that those account restrictions fit your club before deployment. See the current [Vercel Sandbox pricing and quotas](https://vercel.com/docs/sandbox/pricing), [Vercel Function duration settings](https://vercel.com/docs/functions/configuring-functions/duration), [Vercel Hobby plan](https://vercel.com/docs/plans/hobby), and [Supabase pricing](https://supabase.com/pricing).

## Commands

```bash
npm run dev       # Local development
npm run build     # Production build
npm start         # Run the production build locally
npm run typecheck # TypeScript type check
npm run test:problem # Samples, randomized reference checks, test-set size, and known incorrect approaches
npx playwright install chromium # One-time browser setup for end-to-end tests
npm run test:e2e # Supabase + Vercel Sandbox integration suite
```

The end-to-end suite requires the Supabase migrations, a Vercel-linked local project, and these additional local variables: `E2E_SUPABASE_SERVICE_ROLE_KEY`, plus `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` for the admin CRUD test. Use a disposable Supabase project with email confirmation disabled for the signup test. Run it with `npm run test:e2e`; it creates and removes test accounts and a temporary problem.

## Project map

```text
app/                     App Router pages and authenticated API routes
components/              Navigation, problem editor, Monaco workspace, admin forms
components/ui/           Reusable shadcn-style button, input, and badge primitives
lib/auth.ts              Server-side user and administrator checks
lib/supabase/            Browser, cookie-aware server, and server-only admin clients
lib/judge/               Judge provider contract, output policy, Vercel Sandbox adapter
supabase/migrations/     Database/RLS setup and original seed problems
```
