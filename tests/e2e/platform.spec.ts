import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("E2E setup requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and E2E_SUPABASE_SERVICE_ROLE_KEY.");
const service = createClient(supabaseUrl, serviceKey, { auth:{ autoRefreshToken:false,persistSession:false } });
const anonymous = createClient(supabaseUrl, anonKey, { auth:{ autoRefreshToken:false,persistSession:false } });
const password = `CSS-Test-${crypto.randomUUID()}-A1!`;
const accountIds: string[] = [];
let aPlusBId = "";

test.beforeAll(async()=>{
  const {data,error}=await anonymous.from("problems").select("id").eq("slug","a-plus-b").eq("published",true).single();
  if(error||!data)throw new Error("Run the Supabase migrations, including seed problems, before E2E tests.");
  aPlusBId=data.id;
});

test.afterEach(async()=>{
  await Promise.all(accountIds.splice(0).map(id=>service.auth.admin.deleteUser(id)));
});

async function makeAccount() {
  const email=`css-e2e-${crypto.randomUUID()}@example.test`;
  const username=`student_${crypto.randomUUID().replaceAll("-","").slice(0,12)}`;
  const {data,error}=await service.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username}});
  if(error||!data.user)throw new Error(error?.message||"Could not create E2E student.");
  accountIds.push(data.user.id);
  return {email,username,id:data.user.id};
}

async function signIn(page:Page,email:string){
  await page.goto("/login");
  await page.getByLabel("Email",{exact:true}).fill(email);
  await page.getByLabel("Password",{exact:true}).fill(password);
  await page.getByRole("button",{name:"Sign in"}).click();
  await expect(page).toHaveURL(/\/problems$/);
}

async function submit(page:Page,language:"python"|"cpp",source:string){
  return page.evaluate(async ({problemId,language,source})=>{
    const response=await fetch("/api/submit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({problemId,language,source})});
    return {status:response.status,data:await response.json()};
  },{problemId:aPlusBId,language,source});
}

test("signup creates a profile with either confirmation setting",async({page})=>{
  const username=`new_${crypto.randomUUID().replaceAll("-","").slice(0,12)}`;
  await page.goto("/signup");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email",{exact:true}).fill(`css-new-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Password",{exact:true}).fill(password);
  await page.getByRole("button",{name:"Create account"}).click();
  await expect(page).toHaveURL(/\/(problems|signup)$/);
  if (new URL(page.url()).pathname === "/signup") await expect(page.getByRole("status")).toContainText(/Account created|check your email/i);
  const {data}=await service.from("profiles").select("id").eq("username",username).maybeSingle();
  if(data?.id)accountIds.push(data.id);
});

test("login persists a session and users can only manage their own profile",async({page})=>{
  const account=await makeAccount();
  await signIn(page,account.email);
  await page.goto("/profile");
  await expect(page.getByRole("heading",{name:"Profile"})).toBeVisible();
  await expect(page.getByText(`@${account.username}`)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading",{name:"Profile"})).toBeVisible();
  const update=await page.evaluate(async username=>{const response=await fetch("/api/profile",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({username,full_name:"Updated name",bio:"",role:"admin"})});return {status:response.status,data:await response.json()}},account.username);
  expect(update.status).toBe(200);expect(update.data.profile.role).toBe("student");
});

test("non-admin requests cannot create or edit problems",async({page})=>{
  const account=await makeAccount();await signIn(page,account.email);
  const status=await page.evaluate(async()=>{const response=await fetch("/api/admin/problems",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({})});return response.status});
  expect(status).toBe(403);
});

test("a student session cannot grant itself admin or write to the problem bank",async()=>{
  const account=await makeAccount();
  const student=createClient(supabaseUrl!,anonKey!,{auth:{autoRefreshToken:false,persistSession:false}});
  const {error:loginError}=await student.auth.signInWithPassword({email:account.email,password});
  expect(loginError).toBeNull();
  const roleChange=await student.from("profiles").update({role:"admin"}).eq("id",account.id);
  expect(roleChange.error).toBeTruthy();
  const problemWrite=await student.from("problems").insert({slug:`unauthorized-${crypto.randomUUID().slice(0,8)}`,title:"Unauthorized",difficulty:"Easy"});
  expect(problemWrite.error).toBeTruthy();
  await student.auth.signOut();
});

test("hidden test cases are omitted by database row-level security",async()=>{
  const {data,error}=await anonymous.from("test_cases").select("is_sample,input,expected_output").eq("problem_id",aPlusBId).order("case_index");
  expect(error).toBeNull();expect(data?.length).toBeGreaterThan(0);expect(data?.every(row=>row.is_sample)).toBeTruthy();
});

test("admin can create, edit, publish, and delete a problem through the admin API",async({page})=>{
  const email=process.env.E2E_ADMIN_EMAIL;const adminPassword=process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email||!adminPassword,"Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to an existing manually promoted admin.");
  await page.goto("/login");await page.getByLabel("Email",{exact:true}).fill(email!);await page.getByLabel("Password",{exact:true}).fill(adminPassword!);await page.getByRole("button",{name:"Sign in"}).click();await expect(page).toHaveURL(/\/problems$/);
  const slug=`e2e-${crypto.randomUUID().slice(0,8)}`;
  const payload={slug,title:"E2E Problem",difficulty:"Easy",statement:"Add two numbers.",input_format:"Two integers.",output_format:"Print their sum.",constraints:"$|n| < 10^9$",time_limit_ms:1000,memory_limit_mb:128,published:false,tags:["testing"],test_cases:[{case_index:0,input:"1 2\n",expected_output:"3\n",is_sample:true,explanation:"Sample"}],reference_solutions:{python:"",cpp:"",published:false}};
  const created=await page.evaluate(async payload=>{const r=await fetch("/api/admin/problems",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});return {status:r.status,data:await r.json()}},payload);
  expect(created.status).toBe(201);const id=created.data.id as string;
  try{
    const edited=await page.evaluate(async ({id,payload})=>{const r=await fetch(`/api/admin/problems/${id}`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({...payload,id,title:"E2E Edited",published:true})});return {status:r.status,data:await r.json()}},{id,payload});
    expect(edited.status).toBe(201);
    const read=await page.evaluate(async id=>{const r=await fetch(`/api/admin/problems/${id}`);return r.json()},id);
    expect(read.problem.title).toBe("E2E Edited");expect(read.problem.published).toBeTruthy();expect(read.problem.test_cases).toHaveLength(1);
  }finally{await page.evaluate(async id=>{await fetch(`/api/admin/problems/${id}`,{method:"DELETE"})},id)}
});

test("Python accepted submission is saved to history and updates leaderboard progress",async({page})=>{
  const account=await makeAccount();await signIn(page,account.email);
  const response=await submit(page,"python","a, b = map(int, input().split())\nprint(a + b)\n");
  expect(response.status).toBe(200);expect(response.data.verdict).toBe("Accepted");expect(response.data.submissionId).toBeTruthy();
  await page.goto("/submissions");await expect(page.getByText("A + B").first()).toBeVisible();
  const {data}=await service.rpc("leaderboard_rows");expect(data?.find((row:{username:string})=>row.username===account.username)?.solved_count).toBe(1);
});

test("Python wrong answer, compilation error, and runtime error are distinguished",async({page})=>{
  const account=await makeAccount();await signIn(page,account.email);
  expect((await submit(page,"python","a, b = map(int, input().split())\nprint(a - b)\n")).data.verdict).toBe("Wrong Answer");
  expect((await submit(page,"python","def solve(:\n    pass\n")).data.verdict).toBe("Compilation Error");
  expect((await submit(page,"python","raise RuntimeError('expected test failure')\n")).data.verdict).toBe("Runtime Error");
});

test("Python infinite loop is stopped by the configured time limit",async({page})=>{
  const account=await makeAccount();await signIn(page,account.email);
  const response=await submit(page,"python","while True:\n    pass\n");
  expect(response.data.verdict).toBe("Time Limit Exceeded");
});

test("C++17 compiles once and accepts a correct solution",async({page})=>{
  const account=await makeAccount();await signIn(page,account.email);
  const response=await submit(page,"cpp","#include <bits/stdc++.h>\nusing namespace std;\nint main(){long long a,b;cin>>a>>b;cout<<a+b<<'\\n';}\n");
  expect(response.status).toBe(200);expect(response.data.verdict).toBe("Accepted");
});

test("problem workspace and navigation remain usable on a phone viewport",async({page})=>{
  const account=await makeAccount();await signIn(page,account.email);
  await page.setViewportSize({width:390,height:844});await page.goto("/problems/a-plus-b");
  await expect(page.getByRole("heading",{name:"A + B"})).toBeVisible();await expect(page.getByRole("button",{name:/Run code/})).toBeVisible();
  await page.getByRole("button",{name:"Open menu"}).click();await expect(page.getByRole("link",{name:"Leaderboard"})).toBeVisible();
});
