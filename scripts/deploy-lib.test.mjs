// Run with: node --test scripts/
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
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
  swapIn,
  writeState,
} from "./deploy-lib.mjs";

describe("planSync", () => {
  it("fast-forwards a clean checkout of main that is behind origin", () => {
    assert.deepEqual(planSync({ branch: "main", dirty: false, relation: "behind" }), { action: "fast_forward" });
  });
  it("builds what is already checked out when main is level with origin", () => {
    assert.deepEqual(planSync({ branch: "main", dirty: false, relation: "equal" }), { action: "current" });
  });
  it("leaves a checkout on another branch alone", () => {
    assert.deepEqual(planSync({ branch: "feat/x", dirty: false, relation: "behind" }), { action: "skip", why: "not_on_main" });
  });
  it("never touches a checkout with uncommitted changes", () => {
    assert.deepEqual(planSync({ branch: "main", dirty: true, relation: "behind" }), { action: "skip", why: "uncommitted_changes" });
  });
  it("does not deploy commits that were never pushed", () => {
    assert.deepEqual(planSync({ branch: "main", dirty: false, relation: "ahead" }), { action: "skip", why: "unpushed_commits" });
  });
  it("does not guess when history has diverged", () => {
    assert.deepEqual(planSync({ branch: "main", dirty: false, relation: "diverged" }), { action: "skip", why: "diverged" });
  });
});

describe("needsBuild", () => {
  const a = "a".repeat(40);
  const b = "b".repeat(40);
  it("builds a commit that is not deployed yet", () => assert.equal(needsBuild({ headSha: b, deployedSha: a }), true));
  it("builds when nothing was ever deployed", () => assert.equal(needsBuild({ headSha: b, deployedSha: undefined }), true));
  it("does nothing when the deployed commit is current", () => assert.equal(needsBuild({ headSha: a, deployedSha: a }), false));
  it("does not retry a commit that already failed", () => assert.equal(needsBuild({ headSha: b, deployedSha: a, failedSha: b }), false));
  it("builds again once a newer commit arrives after a failure", () => assert.equal(needsBuild({ headSha: a, deployedSha: undefined, failedSha: b }), true));
  it("force rebuilds even a current or failed commit", () => {
    assert.equal(needsBuild({ headSha: a, deployedSha: a, force: true }), true);
    assert.equal(needsBuild({ headSha: b, deployedSha: a, failedSha: b, force: true }), true);
  });
});

describe("classifyChanges", () => {
  it("rebuilds for frontend source but not for docs-only changes", () => {
    assert.equal(classifyChanges(["frontend/src/map/MapCanvas.tsx"]).rebuild, true);
    assert.equal(classifyChanges(["README.md", "docs/plan.md", "DESIGN.md"]).rebuild, false);
  });
  it("installs frontend packages only when the manifest or lockfile changed", () => {
    assert.equal(classifyChanges(["frontend/package-lock.json"]).installFrontend, true);
    assert.equal(classifyChanges(["frontend/package.json"]).installFrontend, true);
    assert.equal(classifyChanges(["frontend/src/App.tsx"]).installFrontend, false);
  });
  it("reinstalls the backend only when its dependencies changed", () => {
    assert.equal(classifyChanges(["backend/pyproject.toml"]).installBackend, true);
    assert.equal(classifyChanges(["backend/app/routes.py"]).installBackend, false);
  });
  it("restarts the backend for app code but not for test-only changes", () => {
    assert.equal(classifyChanges(["backend/app/providers/maps.py"]).restartBackend, true);
    assert.equal(classifyChanges(["backend/tests/test_maps.py"]).restartBackend, false);
    assert.equal(classifyChanges(["backend/tests/test_maps.py"]).testBackend, true);
    assert.equal(classifyChanges(["frontend/src/App.tsx"]).testBackend, false);
  });
  it("assumes the worst when the previous build is unknown", () => {
    assert.deepEqual(classifyChanges(null), { rebuild: true, installFrontend: false, installBackend: false, restartBackend: true, testBackend: true });
  });
});

// ---- real git, in throwaway repositories ---------------------------------------------------------

function sh(cwd, ...args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, `git ${args.join(" ")} failed: ${r.stderr}`);
  return r.stdout.trim();
}

function makeRepos() {
  const base = mkdtempSync(join(tmpdir(), "deploy-lib-"));
  const origin = join(base, "origin.git");
  const work = join(base, "work");
  const other = join(base, "other");
  sh(base, "init", "-q", "--bare", "-b", "main", origin);
  sh(base, "clone", "-q", origin, work);
  for (const dir of [work]) {
    sh(dir, "config", "user.email", "t@example.com");
    sh(dir, "config", "user.name", "t");
  }
  writeFileSync(join(work, "a.txt"), "1\n");
  sh(work, "add", ".");
  sh(work, "commit", "-q", "-m", "first");
  sh(work, "push", "-q", "origin", "main");
  sh(base, "clone", "-q", origin, other);
  sh(other, "config", "user.email", "t@example.com");
  sh(other, "config", "user.name", "t");
  return { base, origin, work, other };
}

function pushFromOther(other, file, text) {
  mkdirSync(join(other, file, ".."), { recursive: true });
  writeFileSync(join(other, file), text);
  sh(other, "add", ".");
  sh(other, "commit", "-q", "-m", `change ${file}`);
  sh(other, "push", "-q", "origin", "main");
}

describe("git helpers on real repositories", () => {
  it("sees a checkout level with origin as equal", () => {
    const { work } = makeRepos();
    assert.equal(relationToRemote(work).relation, "equal");
    assert.equal(currentBranch(work), "main");
  });

  it("sees new commits on origin as behind, fast-forwards, and lists the changed files", () => {
    const { work, other } = makeRepos();
    const before = headSha(work);
    pushFromOther(other, "frontend/src/new.ts", "x\n");
    git(["fetch", "origin", "main"], { cwd: work });
    assert.equal(relationToRemote(work).relation, "behind");
    assert.ok(git(["merge", "--ff-only", "origin/main"], { cwd: work }).ok);
    assert.equal(relationToRemote(work).relation, "equal");
    assert.deepEqual(changedFiles(before, headSha(work), work), ["frontend/src/new.ts"]);
  });

  it("sees unpushed local commits as ahead", () => {
    const { work } = makeRepos();
    writeFileSync(join(work, "b.txt"), "2\n");
    sh(work, "add", ".");
    sh(work, "commit", "-q", "-m", "local only");
    assert.equal(relationToRemote(work).relation, "ahead");
  });

  it("sees both sides having new commits as diverged", () => {
    const { work, other } = makeRepos();
    writeFileSync(join(work, "b.txt"), "2\n");
    sh(work, "add", ".");
    sh(work, "commit", "-q", "-m", "local only");
    pushFromOther(other, "c.txt", "3\n");
    git(["fetch", "origin", "main"], { cwd: work });
    assert.equal(relationToRemote(work).relation, "diverged");
  });

  it("counts edits to tracked files as changes but not new untracked files", () => {
    const { work } = makeRepos();
    writeFileSync(join(work, "untracked.txt"), "new\n");
    assert.equal(hasTrackedChanges(work), false);
    writeFileSync(join(work, "a.txt"), "edited\n");
    assert.equal(hasTrackedChanges(work), true);
  });

  it("returns null for a previous commit it has never seen", () => {
    const { work } = makeRepos();
    assert.equal(changedFiles("f".repeat(40), headSha(work), work), null);
    assert.equal(changedFiles(undefined, headSha(work), work), null);
  });
});

describe("checkSite", () => {
  function listen(handler) {
    return new Promise((resolve) => {
      const server = createServer(handler);
      server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
    });
  }

  it("is healthy when / and /sw.js both answer 200", async () => {
    const { server, port } = await listen((_, res) => res.end("ok"));
    assert.equal(await checkSite(port), "healthy");
    server.close();
  });

  it("is unhealthy when any page answers an error", async () => {
    const { server, port } = await listen((req, res) => {
      res.statusCode = req.url === "/sw.js" ? 500 : 200;
      res.end("x");
    });
    assert.equal(await checkSite(port), "unhealthy");
    server.close();
  });

  it("is unhealthy when the site accepts the connection but never answers", async () => {
    const { server, port } = await listen(() => {});
    assert.equal(await checkSite(port, 300), "unhealthy");
    server.closeAllConnections();
    server.close();
  });

  it("is not running when nothing is listening, which is not a failure of the deploy", async () => {
    const { server, port } = await listen((_, res) => res.end("x"));
    await new Promise((r) => server.close(r));
    assert.equal(await checkSite(port), "not_running");
  });
});

describe("state files", () => {
  it("round-trips and returns null when absent", () => {
    const repo = mkdtempSync(join(tmpdir(), "deploy-state-"));
    assert.equal(readState("deployed.json", repo), null);
    writeState("deployed.json", { commit: "abc" }, repo);
    assert.deepEqual(readState("deployed.json", repo), { commit: "abc" });
  });
});

describe("swapIn", () => {
  function folders() {
    const base = mkdtempSync(join(tmpdir(), "deploy-swap-"));
    const dir = (name, marker) => {
      mkdirSync(join(base, name), { recursive: true });
      writeFileSync(join(base, name, "index.html"), marker);
      return join(base, name);
    };
    return { base, live: dir("dist", "old"), next: dir("dist-next", "new"), previous: join(base, "dist-prev"), dir };
  }
  const read = (d) => readFileSync(join(d, "index.html"), "utf8");

  it("serves the new build after the swap and drops the old one on commit", () => {
    const { live, next, previous } = folders();
    const swap = swapIn({ live, next, previous });
    assert.equal(read(live), "new");
    assert.ok(existsSync(previous), "old build is kept until committed");
    swap.commit();
    assert.equal(existsSync(previous), false);
    assert.equal(existsSync(next), false);
  });

  it("puts the old build back on rollback", () => {
    const { live, next, previous } = folders();
    swapIn({ live, next, previous }).rollback();
    assert.equal(read(live), "old");
    assert.equal(existsSync(previous), false);
  });

  it("restores the live build when activating the staged directory fails", () => {
    const { live, previous } = folders();
    // A nested staging directory moves away with live, causing the second rename
    // to fail on the real filesystem after the old build was moved to previous.
    const next = join(live, "staged");
    mkdirSync(next);
    writeFileSync(join(next, "index.html"), "new");
    assert.throws(() => swapIn({ live, next, previous }), /ENOENT/);
    assert.equal(read(live), "old", "failed activation must leave the old build serving");
    assert.equal(existsSync(previous), false);
  });

  it("refuses a staged build that has no index.html and leaves the live one alone", () => {
    const { live, next, previous } = folders();
    writeFileSync(join(next, "index.html"), "x");
    // Remove it so the staged folder is empty of an entry point.
    spawnSync(process.execPath, ["-e", `require('fs').rmSync(${JSON.stringify(join(next, "index.html"))})`]);
    assert.throws(() => swapIn({ live, next, previous }), /no index\.html/);
    assert.equal(read(live), "old");
  });

  it("repairs a crash that left only the previous build behind", () => {
    const { live, next, previous, dir } = folders();
    spawnSync(process.execPath, ["-e", `require('fs').renameSync(${JSON.stringify(live)}, ${JSON.stringify(previous)})`]);
    assert.equal(existsSync(live), false);
    swapIn({ live, next, previous }).rollback();
    assert.equal(read(live), "old"); // the restored old build, since the swap was rolled back
    void dir;
  });
});
