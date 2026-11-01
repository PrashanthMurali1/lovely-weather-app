// Decisions and helpers for the production build automation (relay-build.mjs).
// Everything that can be decided without side effects lives here so it can be tested.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const branchName = "main";
export const remoteName = "origin";

/** Where the automation keeps its own state. Git-ignored. */
export const stateDir = (repo = root) => join(repo, ".deploy");

// ---- decisions -----------------------------------------------------------------------------------

/**
 * What to do about the checkout before building.
 * relation: how local main relates to origin/main ("equal" | "behind" | "ahead" | "diverged").
 */
export function planSync({ branch, dirty, relation }) {
  if (branch !== branchName) return { action: "skip", why: "not_on_main" };
  if (dirty) return { action: "skip", why: "uncommitted_changes" };
  if (relation === "behind") return { action: "fast_forward" };
  if (relation === "equal") return { action: "current" };
  if (relation === "ahead") return { action: "skip", why: "unpushed_commits" };
  return { action: "skip", why: "diverged" };
}

/** Whether the commit now checked out needs a build. */
export function needsBuild({ headSha, deployedSha, failedSha, force }) {
  if (force) return true;
  if (failedSha && failedSha === headSha) return false; // already failed once; wait for a new commit
  return deployedSha !== headSha;
}

const DOC_ONLY = /(\.md$|^docs\/|^\.superpowers\/|^\.impeccable\/)/;

/** What a set of changed files means for the build. `files` is null when the previous build is unknown. */
export function classifyChanges(files) {
  if (files === null) {
    return { rebuild: true, installFrontend: false, installBackend: false, restartBackend: true, testBackend: true };
  }
  const touches = (re) => files.some((f) => re.test(f));
  return {
    rebuild: files.some((f) => !DOC_ONLY.test(f)),
    installFrontend: touches(/^frontend\/package(-lock)?\.json$/),
    installBackend: touches(/^backend\/pyproject\.toml$/),
    restartBackend: touches(/^backend\/(?!tests\/)/),
    testBackend: touches(/^backend\//),
  };
}

// ---- git -----------------------------------------------------------------------------------------

export function git(args, { cwd = root, timeout = 60_000 } = {}) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", timeout, windowsHide: true });
  return { ok: r.status === 0, code: r.status ?? -1, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

export const headSha = (cwd = root) => git(["rev-parse", "HEAD"], { cwd }).out;
export const currentBranch = (cwd = root) => git(["rev-parse", "--abbrev-ref", "HEAD"], { cwd }).out;
/** Tracked files with local changes. New untracked files never block a fast-forward. */
export const hasTrackedChanges = (cwd = root) => git(["status", "--porcelain", "--untracked-files=no"], { cwd }).out !== "";

export function relationToRemote(cwd = root) {
  const local = headSha(cwd);
  const remote = git(["rev-parse", `${remoteName}/${branchName}`], { cwd }).out;
  if (!remote) return { relation: "diverged", local, remote };
  if (local === remote) return { relation: "equal", local, remote };
  if (git(["merge-base", "--is-ancestor", local, remote], { cwd }).ok) return { relation: "behind", local, remote };
  if (git(["merge-base", "--is-ancestor", remote, local], { cwd }).ok) return { relation: "ahead", local, remote };
  return { relation: "diverged", local, remote };
}

/** Files that differ between two commits, or null when `from` is unknown to this clone. */
export function changedFiles(from, to, cwd = root) {
  if (!from || !/^[0-9a-f]{40}$/.test(from)) return null;
  if (!git(["cat-file", "-e", `${from}^{commit}`], { cwd }).ok) return null;
  const r = git(["diff", "--name-only", from, to], { cwd });
  return r.ok ? r.out.split("\n").filter(Boolean) : null;
}

// ---- live site check -----------------------------------------------------------------------------

/**
 * "healthy": / and /sw.js both answer 200.
 * "unhealthy": the site answered wrongly, or accepted a connection and never answered.
 * "not_running": nothing is listening. The deployment being stopped is not this job's failure.
 */
export async function checkSite(port, timeoutMs = 15_000) {
  for (const path of ["/", "/sw.js"]) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(timeoutMs), headers: { connection: "close" } });
      await res.arrayBuffer(); // finish the response so its connection can close
      if (res.status !== 200) return "unhealthy";
    } catch (e) {
      return e?.cause?.code === "ECONNREFUSED" ? "not_running" : "unhealthy";
    }
  }
  return "healthy";
}

// ---- state files ---------------------------------------------------------------------------------

export function readState(name, repo = root) {
  try {
    return JSON.parse(readFileSync(join(stateDir(repo), name), "utf8"));
  } catch {
    return null;
  }
}

export function writeState(name, value, repo = root) {
  mkdirSync(stateDir(repo), { recursive: true });
  const file = join(stateDir(repo), name);
  writeFileSync(`${file}.tmp`, JSON.stringify(value) + "\n");
  renameSync(`${file}.tmp`, file);
}

// ---- atomic swap of the served folder -------------------------------------------------------------

function renameWithRetry(from, to) {
  // Windows can briefly hold a directory open (antivirus, the preview server mid-request).
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(from, to);
      return;
    } catch (e) {
      if (attempt >= 20 || !["EBUSY", "EPERM", "EACCES"].includes(e.code)) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
}

/**
 * Make `next` the served folder, keeping the old one as `previous` until `commit` is called.
 * A folder that is missing or half-swapped from an earlier crash is repaired first.
 */
export function swapIn({ live, next, previous }) {
  if (!existsSync(live) && existsSync(previous)) renameWithRetry(previous, live); // earlier crash: restore
  if (!existsSync(join(next, "index.html"))) throw new Error("staged build has no index.html");
  if (existsSync(previous)) rmDir(previous);
  if (existsSync(live)) renameWithRetry(live, previous);
  try {
    renameWithRetry(next, live);
  } catch (error) {
    // A rejected activation must restore service now: the failed commit will be
    // suppressed on subsequent runs, so crash repair cannot be relied upon.
    if (existsSync(previous)) renameWithRetry(previous, live);
    throw error;
  }
  return {
    /** Put the old folder back. */
    rollback() {
      if (existsSync(live)) rmDir(live);
      if (existsSync(previous)) renameWithRetry(previous, live);
    },
    /** Keep the new folder; drop the old one. */
    commit() {
      if (existsSync(previous)) rmDir(previous);
    },
  };
}

import { rmSync } from "node:fs";
function rmDir(dir) {
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
