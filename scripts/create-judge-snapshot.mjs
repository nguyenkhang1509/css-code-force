import { loadEnvConfig } from "@next/env";
import { Sandbox } from "@vercel/sandbox";

// Load local Vercel OIDC credentials for this one-time setup command. Values
// are not printed or passed as environment variables into the sandbox.
loadEnvConfig(process.cwd());

if (!process.env.VERCEL_OIDC_TOKEN) {
  throw new Error("No VERCEL_OIDC_TOKEN is available. Link this folder with `npx vercel link`, then refresh local Vercel variables with `npx vercel env pull .env.local` and retry.");
}

const sandbox = await Sandbox.create({
  persistent: false,
  timeout: 5 * 60 * 1000,
  resources: { vcpus: 1 },
  networkPolicy: "allow-all",
});

let snapshotCreated = false;
try {
  const install = await sandbox.runCommand({
    cmd: "bash",
    args: ["-lc", "apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3 g++ coreutils"],
    sudo: true,
    timeoutMs: 180_000,
  });
  if (install.exitCode !== 0) {
    throw new Error(`Could not install the Python and C++ judge runtimes (setup exit code ${install.exitCode}). Check Sandbox network access and retry.`);
  }

  const verify = await sandbox.runCommand({
    cmd: "bash",
    args: ["-lc", "python3 --version && g++ --version >/dev/null && timeout --version >/dev/null"],
    timeoutMs: 10_000,
  });
  if (verify.exitCode !== 0) throw new Error("Runtime verification failed; no snapshot was created.");

  // Keep the prepared image network-isolated too. The judging service still
  // uses a distinct disposable sandbox for each untrusted submission.
  await sandbox.update({ networkPolicy: "deny-all" });
  const snapshot = await sandbox.snapshot({ expiration: 30 * 24 * 60 * 60 * 1000 });
  snapshotCreated = true;
  console.log(`Judge snapshot created: ${snapshot.snapshotId}`);
  console.log("Set VERCEL_SANDBOX_SNAPSHOT_ID to this ID in Vercel Production and Preview, then redeploy.");
} finally {
  if (!snapshotCreated) await sandbox.stop().catch(() => undefined);
}
