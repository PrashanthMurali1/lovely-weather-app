// Production build automation, run by Relay (the local automation service) and usable by hand.
//
//   node scripts/relay-build.mjs run            bring the local deployment up to date with origin/main
//   node scripts/relay-build.mjs run --force    rebuild the current commit even if it is already deployed
//   node scripts/relay-build.mjs check          read-only: is this checkout able to run the job?
//   node scripts/relay-build.mjs verify         read-only: is the deployed build in place?
//   node scripts/relay-build.mjs plan           read-only: what would `run` do right now?
//
// `run` fast-forwards main from origin, installs changed dependencies, gates on type checks and tests,
// builds into a staging folder, swaps it in atomically, checks the live site, and rolls back if that fails.
// While it works the previous build keeps serving. Relay keeps only a fixed set of event fields, so this
// program prints those and writes anything longer to .deploy/last-failure.log.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  branchName,
  changedFiles,
  checkSite,
  classifyChanges,
  currentBranch,
  git,
  hasTrackedChanges,
  headSha,
  needsBuild,
  planSync,
  readState,
  relationToRemote,
  remoteName,
  root,
  stateDir,
  swapIn,
  writeState,
} from "./deploy-lib.mjs";
import { venvPython } from "./venv-python.mjs";

const frontend = join(root, "frontend");
const live = join(frontend, "dist");
const staged = join(frontend, "dist-next");
const previous = join(frontend, "dist-prev");
const webPort = process.env.WEATHER_WEB_PORT || "4280";

const [command = "run", ...flags] = process.argv.slice(2);
const force = flags.includes("--force");
const started = Date.now();

// ---- events (the only output Relay keeps) ----------------------------------------------------------

// `done` and `fail` end the run by throwing Finished. They must not call process.exit: with a network request
// still closing, Node on Windows aborts with a libuv assertion and a nonzero exit code, which Relay would
// record as a failed run even though the deployment worked.
class Finished extends Error {
  constructor(code) {
    super("finished");
    this.code = code;
  }
}
const emit = (event, fields = {}) => console.log(JSON.stringify({ event, severity: "INFO", ...fields }));
const progress = (phase) => emit("automation_progress", { phase });
const done = (outcome, fields = {}) => {
  emit("automation_completed", { outcome, duration_ms: Date.now() - started, ...fields });
  throw new Finished(0);
};
const fail = (phase, reason, detail) => {
  if (detail) {
    mkdirSync(stateDir(), { recursive: true });
    writeFileSync(join(stateDir(), "last-failure.log"), `${new Date().toISOString()} ${phase}\n${detail}\n`);
  }
  console.log(JSON.stringify({ event: "automation_failed", severity: "ERROR", phase, reason, outcome: "failed", duration_ms: Date.now() - started }));
  throw new Finished(1);
};

// ---- running tools without a shell --------------------------------------------------------------------

const npmCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const tool = (cwd, script) => ({ cwd, run: (args, timeout) => run(process.execPath, [join(cwd, "node_modules", ...script), ...args], cwd, timeout) });

function run(file, args, cwd, timeout = 900_000) {
  const r = spawnSync(file, args, { cwd, encoding: "utf8", timeout, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  const tail = `${r.stdout ?? ""}\n${r.stderr ?? ""}`.trim().split("\n").slice(-60).join("\n");
  return { ok: r.status === 0, code: r.status ?? -1, timedOut: r.error?.code === "ETIMEDOUT", tail };
}

const tsc = tool(frontend, ["typescript", "bin", "tsc"]);
const vite = tool(frontend, ["vite", "bin", "vite.js"]);
const vitest = tool(frontend, ["vitest", "vitest.mjs"]);

// ---- read-only commands -----------------------------------------------------------------------------------

if (command === "check") {
  const ok = git(["rev-parse", "--is-inside-work-tree"]).ok && existsSync(join(frontend, "package.json")) && existsSync(join(frontend, "node_modules")) && existsSync(npmCli);
  process.exit(ok ? 0 : 1);
}

if (command === "verify") {
  process.exit(existsSync(join(live, "index.html")) ? 0 : 1);
}

if (command === "plan") {
  const fetched = git(["fetch", remoteName, branchName], { timeout: 90_000 });
  const rel = relationToRemote();
  const sync = planSync({ branch: currentBranch(), dirty: hasTrackedChanges(), relation: rel.relation });
  const deployed = readState("deployed.json");
  const failed = readState("failed.json");
  const target = sync.action === "fast_forward" ? rel.remote : rel.local;
  console.log(
    JSON.stringify(
      {
        fetched: fetched.ok,
        branch: currentBranch(),
        relation: rel.relation,
        sync,
        head: rel.local,
        origin: rel.remote,
        deployed: deployed?.commit ?? null,
        failedCommit: failed?.commit ?? null,
        wouldBuild: sync.action !== "skip" && needsBuild({ headSha: target, deployedSha: deployed?.commit, failedSha: failed?.commit, force }),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (command !== "run") {
  console.error("usage: relay-build.mjs run [--force] | check | verify | plan");
  process.exit(2);
}

// ---- run ---------------------------------------------------------------------------------------------------------

try {
  await main();
} catch (e) {
  if (e instanceof Finished) process.exitCode = e.code;
  else {
    console.log(JSON.stringify({ event: "automation_failed", severity: "ERROR", outcome: "failed", reason: "command_failed", duration_ms: Date.now() - started }));
    mkdirSync(stateDir(), { recursive: true });
    writeFileSync(join(stateDir(), "last-failure.log"), `${new Date().toISOString()} unexpected\n${e?.stack ?? e}\n`);
    process.exitCode = 1;
  }
}

async function main() {
emit("automation_started");
progress("preflight");

if (!git(["rev-parse", "--is-inside-work-tree"]).ok) fail("preflight", "unavailable", "not a git work tree");
if (!existsSync(npmCli)) fail("preflight", "unavailable", `npm not found at ${npmCli}`);

progress("fetch");
if (!git(["fetch", remoteName, branchName], { timeout: 90_000 }).ok) {
  done("deferred", { reason: "unavailable" }); // offline or GitHub unreachable: try again at the next slot
}

const rel = relationToRemote();
const sync = planSync({ branch: currentBranch(), dirty: hasTrackedChanges(), relation: rel.relation });
if (sync.action === "skip") done("skipped", { reason: "ownership_conflict" }); // someone is working in this checkout

const deployed = readState("deployed.json");
const failed = readState("failed.json");
const target = sync.action === "fast_forward" ? rel.remote : rel.local;
if (!needsBuild({ headSha: target, deployedSha: deployed?.commit, failedSha: failed?.commit, force })) {
  done("skipped", { commit_sha: target });
}

const previousCommit = deployed?.commit;
if (sync.action === "fast_forward") {
  const merged = git(["merge", "--ff-only", `${remoteName}/${branchName}`], { timeout: 120_000 });
  if (!merged.ok) fail("fetch", "command_failed", merged.err);
}
const commit = headSha();
const changes = classifyChanges(changedFiles(previousCommit, commit));
if (!changes.rebuild && !force && existsSync(join(live, "index.html"))) {
  // Documentation only: nothing to build, but remember this commit so it is not reconsidered.
  writeState("deployed.json", { commit, at: new Date().toISOString() });
  done("skipped", { commit_sha: commit });
}

const stop = (phase, step) => {
  // A failure is remembered against the commit so the next slot does not repeat it. A newer commit, or a
  // manual rebuild, tries again. The site keeps serving the previous build throughout.
  writeState("failed.json", { commit, phase, at: new Date().toISOString() });
  fail(phase, step.timedOut ? "command_timeout" : "command_failed", step.tail);
};

// Packages. (`npm install`, not `npm ci`: ci deletes node_modules, which Windows will not do while the preview server has files open.)
if (changes.installFrontend || !existsSync(join(frontend, "node_modules"))) {
  progress("build");
  const r = run(process.execPath, [npmCli, "install", "--no-audit", "--no-fund"], frontend);
  if (!r.ok) stop("build", r);
}
if (changes.installBackend) {
  progress("build");
  const r = run(venvPython(), ["-m", "pip", "install", "-e", "backend[dev]"], root);
  if (!r.ok) stop("build", r);
}

// Gate: nothing is built or swapped in unless the checks pass.
progress("test");
const typecheck = tsc.run(["--noEmit"], 300_000);
if (!typecheck.ok) stop("test", typecheck);
let tests = vitest.run(["run"], 900_000);
if (!tests.ok) tests = vitest.run(["run"], 900_000); // one retry: a busy machine can time out slow UI tests
if (!tests.ok) stop("test", tests);
if (changes.testBackend) {
  const backend = run(process.execPath, [join(root, "scripts", "test-backend.mjs")], root, 900_000);
  if (!backend.ok) stop("test", backend);
}

// Build into a staging folder; the live one is untouched until it is complete.
progress("build");
rmSync(staged, { recursive: true, force: true });
const built = vite.run(["build", "--outDir", "dist-next", "--emptyOutDir"], 600_000);
if (!built.ok || !existsSync(join(staged, "index.html")) || !existsSync(join(staged, "sw.js"))) {
  stop("build", built.ok ? { ...built, tail: "build output is missing index.html or sw.js" } : built);
}

// Swap, check the live site, roll back if it is unhealthy.
progress("activate");
let swap;
try {
  swap = swapIn({ live, next: staged, previous });
} catch (e) {
  stop("activate", { ok: false, timedOut: false, tail: String(e.stack ?? e) });
}

progress("verify");
const health = await checkSite(webPort);
if (health === "unhealthy") {
  swap.rollback();
  emit("automation_progress", { phase: "rollback", rollback: "succeeded" });
  writeState("failed.json", { commit, phase: "verify", at: new Date().toISOString() });
  fail("verify", "health_failed", "the live site did not return 200 for / and /sw.js after the swap; the previous build was restored");
}
swap.commit();

writeState("deployed.json", { commit, at: new Date().toISOString() });
rmSync(join(stateDir(), "failed.json"), { force: true });
if (changes.restartBackend || changes.installBackend) writeState("restart-backend.json", { commit, at: new Date().toISOString() });

done("success", { commit_sha: commit, services: changes.restartBackend || changes.installBackend ? ["frontend", "backend"] : ["frontend"] });
}
