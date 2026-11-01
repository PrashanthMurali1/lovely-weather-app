// Integration tests: real git, TypeScript, Vitest and Vite in disposable repositories.
// Run: node --test scripts/relay-build.test.mjs (requires frontend/node_modules).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const source = dirname(fileURLToPath(import.meta.url));
const dependencies = join(source, "..", "frontend", "node_modules");
// Match Relay's inherited environment allowlist; no developer-shell extras.
const allowed = new Set("SYSTEMROOT WINDIR COMSPEC TEMP TMP TMPDIR HOME USERPROFILE APPDATA LOCALAPPDATA PATH PATHEXT LANG LC_ALL TZ".split(" "));
const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.has(key.toUpperCase())));
// Allocate then close a valid port: success exercises the stopped-deployment path.
// Port 0 produces EADDRNOTAVAIL on Windows rather than connection refused.
const reservation = createServer();
await new Promise((resolve, reject) => {
  reservation.once("error", reject);
  reservation.listen(0, "127.0.0.1", resolve);
});
const healthPort = reservation.address().port;
await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function put(repo, name, content) {
  const path = join(repo, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), "relay-build-"));
  // This path is created here, never derived from user input. Remove the junction
  // separately so recursive cleanup cannot traverse the shared dependencies.
  const work = join(base, "work");
  t.after(() => {
    const link = join(work, "frontend", "node_modules");
    if (existsSync(link)) rmSync(link, { recursive: true });
    rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });
  const origin = join(base, "origin.git");
  const other = join(base, "other");
  git(base, "init", "--bare", "-b", "main", origin);
  git(base, "clone", origin, other);
  git(other, "config", "user.name", "Fixture");
  git(other, "config", "user.email", "fixture@example.invalid");
  put(other, ".gitignore", "node_modules/\ndist/\ndist-next/\ndist-prev/\n.deploy/\n");
  put(other, "frontend/package.json", '{"private":true,"type":"module"}\n');
  put(other, "frontend/tsconfig.json", JSON.stringify({ compilerOptions: { target: "ES2022", module: "Preserve", types: [], skipLibCheck: true }, include: ["src/**/*.ts"] }));
  put(other, "frontend/src/main.ts", 'document.body.dataset.version = "old";\n');
  put(other, "frontend/index.html", '<html><body>fixture<script type="module" src="/src/main.ts"></script></body></html>');
  put(other, "frontend/vite.config.mjs", `export default { plugins: [{ name: 'fixture-sw', generateBundle() { this.emitFile({ type: 'asset', fileName: 'sw.js', source: '// fixture' }); } }] };\n`);
  put(other, "frontend/gate.test.js", "import { test, expect } from 'vitest'; test('gate', () => expect(1).toBe(1));\n");
  for (const file of ["relay-build.mjs", "deploy-lib.mjs", "venv-python.mjs"]) {
    mkdirSync(join(other, "scripts"), { recursive: true });
    copyFileSync(join(source, file), join(other, "scripts", file));
  }
  git(other, "add", ".");
  git(other, "commit", "-m", "fixture baseline");
  git(other, "push", "origin", "main");
  const baseline = git(other, "rev-parse", "HEAD");
  git(base, "clone", origin, work);
  symlinkSync(dependencies, join(work, "frontend", "node_modules"), process.platform === "win32" ? "junction" : "dir");
  put(work, "frontend/dist/index.html", "old build");
  put(work, "frontend/dist/sw.js", "old worker");
  put(work, ".deploy/deployed.json", JSON.stringify({ commit: baseline }));
  return { work, other, baseline };
}

function publish(other, name, content) {
  put(other, name, content);
  git(other, "add", ".");
  git(other, "commit", "-m", "fixture update");
  git(other, "push", "origin", "main");
  return git(other, "rev-parse", "HEAD");
}

function run(work, ...flags) {
  const result = spawnSync(process.execPath, [join(work, "scripts", "relay-build.mjs"), "run", ...flags], {
    cwd: work, env: { ...environment, WEATHER_WEB_PORT: String(healthPort) }, encoding: "utf8", windowsHide: true, timeout: 120_000,
  });
  assert.ifError(result.error);
  return { ...result, events: result.stdout.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line)) };
}

function state(work, name) {
  return JSON.parse(readFileSync(join(work, ".deploy", name), "utf8"));
}

for (const gate of ["typecheck", "tests"]) {
  // Catches bypassed gates, swaps before tests, and missing failed-commit suppression.
  test(`${gate} failure preserves the old build and suppresses the next run`, { timeout: 120_000 }, (t) => {
    const { work, other, baseline } = fixture(t);
    const commit = gate === "typecheck"
      ? publish(other, "frontend/src/main.ts", 'const broken: number = "invalid";\n')
      : publish(other, "frontend/gate.test.js", `import { test, expect } from 'vitest';
import { appendFileSync } from 'node:fs';
test('gate', () => { appendFileSync('../.deploy/attempts', 'attempt\\n'); expect(1).toBe(2); });\n`);
    const first = run(work);
    assert.equal(first.status, 1, first.stdout + first.stderr);
    assert.equal(first.events.at(-1).phase, "test");
    assert.equal(first.events.at(-1).reason, "command_failed");
    assert.equal(git(work, "rev-parse", "HEAD"), commit, "actually fast-forwarded");
    assert.deepEqual(first.events.filter((e) => ["build", "activate", "verify"].includes(e.phase)), []);
    assert.equal(readFileSync(join(work, "frontend/dist/index.html"), "utf8"), "old build");
    assert.equal(readFileSync(join(work, "frontend/dist/sw.js"), "utf8"), "old worker");
    assert.equal(existsSync(join(work, "frontend/dist-next")), false);
    assert.equal(existsSync(join(work, "frontend/dist-prev")), false);
    assert.equal(state(work, "deployed.json").commit, baseline);
    assert.equal(state(work, "failed.json").commit, commit);
    assert.match(readFileSync(join(work, ".deploy/last-failure.log"), "utf8"), gate === "typecheck" ? /not assignable/ : /expected 1 to be 2/);
    if (gate === "tests") assert.equal(readFileSync(join(work, ".deploy/attempts"), "utf8"), "attempt\nattempt\n", "one retry");
    const second = run(work);
    assert.equal(second.status, 0, second.stderr);
    assert.equal(second.events.at(-1).outcome, "skipped");
    assert.equal(second.events.at(-1).commit_sha, commit);
    assert.equal(second.events.some((e) => e.phase === "test"), false);
  });
}

// Catches skipping the merge/build or recording the old SHA after a new commit.
test("a new origin commit fast-forwards, passes real gates and replaces the build", { timeout: 120_000 }, (t) => {
  const { work, other } = fixture(t);
  const commit = publish(other, "frontend/src/main.ts", 'document.body.dataset.version = "new";\n');
  const result = run(work);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.events.at(-1).outcome, "success");
  assert.equal(git(work, "rev-parse", "HEAD"), commit);
  assert.equal(state(work, "deployed.json").commit, commit);
  assert.match(readFileSync(join(work, "frontend/dist/index.html"), "utf8"), /assets\//);
  assert.equal(readFileSync(join(work, "frontend/dist/sw.js"), "utf8"), "// fixture");
  assert.equal(existsSync(join(work, "frontend/dist-prev")), false);
  assert.equal(existsSync(join(work, "frontend/dist-next")), false);
  assert.equal(existsSync(join(work, ".deploy/failed.json")), false);
  const again = run(work);
  assert.equal(again.status, 0);
  assert.equal(again.events.at(-1).outcome, "skipped");
});
