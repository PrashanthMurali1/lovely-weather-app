# Handoff: production build automation for the weather app (via Relay)

Written 2026-11-01 for the agent (Codex) picking this up. The user stopped the previous session because they hit a usage limit; the work is mid-flight but in a safe, working state.

## Follow-up verification (2026-11-01)

Latest follow-up: the user approved committing and pushing everything, and declined reboot persistence. Relay manual `weather.rebuild` completed the full real pipeline successfully twice on clean `main` (temporarily stashed and restored only `.gitignore`). The final run, `e20c7234df834bdcb9b58ed8f17532a7`, exited 0 with `outcome: success`, test/build/activate/verify phases, and deployed commit `2c2bbfc4bfe5a18550b80d6a7cd974ecf9a0bce9` at `2026-11-01T13:59:49.143Z`. Thus a full successful build under Relay is now verified; the earlier unverified notes below are historical.

Review found that failure of the second activation rename could leave the live folder absent. Added a real-filesystem regression, watched it fail, then fixed `swapIn` to restore the previous folder immediately before rethrowing. Reviewer confirmed the fix. Deployment tests now total **36 passed** (33 helper tests + 3 integration tests). Full `npm.cmd test` passed: **92 backend + 195 frontend**. The initial sandboxed pytest attempt had 31 permission errors cleaning its pre-existing temporary directory; the same command outside the sandbox passed. README now documents deployment automation. Work is being committed and pushed on `automation/relay-build`; no merge is authorized. After the PR is merged, return this checkout to clean `main` for scheduled updates. Reboot persistence remains out of scope.

- Relay's scheduled `weather.build` run at 13:35 UTC (19:05 IST), ID `1618a89923404352b6a52220113022ec`, exited 0. Captured events confirm `skipped` / `ownership_conflict` after fetch, as expected while `.gitignore` is modified. No Relay source or manifest changes were needed.
- Existing deployment needed no restart: `/`, `/sw.js`, and `/api/radar` on port 4280 returned 200 before and after verification.
- Original deployment tests: 32 passed, 0 failed. Frontend: 195 passed across 21 files using `npx.cmd vitest run` (PowerShell blocks `npx.ps1`). The frontend type check also exited 0.
- Added `scripts/relay-build.test.mjs`: 3 passing integration tests using disposable origins/clones and real TypeScript, Vitest and Vite under Relay's inherited environment allowlist. Real type-check and test failures preserve the old build, record the failed commit, and suppress its next run; failing Vitest runs retry once. A new origin commit really fast-forwards, builds and swaps successfully. No extra app server is started; successful fixture deployment uses the stopped-service health path.
- Mutation checks on disposable script copies: bypassing either gate or removing the fast-forward makes its regression test fail. No production scripts changed.
- Still unverified: a full successful build executed by Relay itself, the first update to this real checkout after merge, and Relay's recovery-required UI flow. Do not claim these were exercised.
- Nothing committed, pushed, merged or opened as a PR. README deployment documentation still awaits the user's agreement to proceed. Reboot persistence has not been implemented.

## 1. What the user asked for

"Go through `C:\Users\prash\Documents\LLM Projects\automation-service` (the Relay app). Set up a production build automation for this app."

Standing preferences from the same conversation (treat as rules):

- **One local deployment only.** The app is unreleased: no separate dev/test/prod copies running side by side. Deploy features so the user can test them, without being asked.
- **Never commit or push unless the user asks.** The user merges via GitHub pull requests (PR #1, #2 so far).
- The user is direct and dislikes being asked trivial questions. Pick a sensible default, say what you chose, and move on.
- Do not touch the user's own servers: Vite on `:5173`, the `arizona-election-data` backend on `:8000`, and Relay itself on `:8765`.

## 2. Where things stand

### Already merged to `main` (PR #2, commit `2c2bbfc`)
The radar/cyclone map feature is finished and deployed: GPU radar renderer with MSN-style colour steps, OpenFreeMap street layer (zoom capped at 10.5), offline caching, scale bar, etc. Frontend tests: 195 passing. See `README.md` and `DESIGN.md`.

### This session's new work (all uncommitted)
`git status` in `lovely-weather-app` shows exactly:

```
 M .gitignore                      # adds .deploy/, frontend/dist-next/, frontend/dist-prev/
?? scripts/deploy-lib.mjs          # decisions + git/swap/health helpers (pure, tested)
?? scripts/deploy-lib.test.mjs     # 32 tests: node --test scripts/deploy-lib.test.mjs
?? scripts/relay-build.mjs         # the job Relay runs (run | run --force | check | verify | plan)
?? scripts/serve.mjs               # supervisor for the ONE local deployment (backend + built frontend)
?? HANDOFF-relay-build.md          # this file
```

Outside this repo: `C:\Users\prash\Documents\LLM Projects\automation-service\.local\applications\weather.json` (the Relay manifest; `.local/` is git-ignored in that repo). **No Relay source code was changed**, and none should be: Relay's design is manifest-only onboarding.

### What `scripts/relay-build.mjs run` does
1. `git fetch origin main`. If offline, report `deferred` and try again at the next slot.
2. Only proceeds if the checkout is on `main` with **no changes to tracked files** (untracked files are fine). Otherwise reports `skipped` with reason `ownership_conflict`. This guard is deliberate: the user and other agents work in the same checkout.
3. If behind origin: `git merge --ff-only origin/main`. If ahead or diverged: skip.
4. Skips if this commit is already deployed (`.deploy/deployed.json`) or already failed (`.deploy/failed.json`, a newer commit or `--force` retries). Docs-only changes are recorded and skipped.
5. `npm install` only if `frontend/package*.json` changed; `pip install -e backend[dev]` only if `backend/pyproject.toml` changed.
6. Gate: `tsc --noEmit`, `vitest run` (one retry, because slow UI tests can time out on a busy machine), backend pytest if `backend/` changed.
7. Builds into `frontend/dist-next`, swaps it atomically for `frontend/dist` (old one kept as `dist-prev`).
8. Health check: `GET /` and `/sw.js` on `WEATHER_WEB_PORT` (default 4280). Unhealthy or hung: **rolls back** to the old build and fails with reason `health_failed`. Connection refused means the deployment is simply stopped and is not a failure.
9. On success writes `.deploy/deployed.json`; if backend code changed also writes `.deploy/restart-backend.json`, which `serve.mjs` notices and restarts the backend.

Relay only keeps a fixed allowlist of event fields (`backend/logging_safe.py` in the Relay repo: events `automation_started/progress/completed/failed`; phases `preflight, fetch, test, build, activate, verify, rollback`; outcomes `success, failed, skipped, deferred, ...`; numbers; a 40-hex `commit_sha`). The job prints only those. Longer failure detail goes to `.deploy/last-failure.log`.

### Relay registration (`weather.json`)
- Application `weather` ("India Weather"), two automations:
  - **`weather.build`**: scheduled every 300 s (Asia/Kolkata anchor), `enabled: true`, runs `node scripts/relay-build.mjs run`, timeout 1800 s.
  - **`weather.rebuild`**: manual only (`enabled: false`), runs `... run --force`.
- Both use resource `deployment` (serialized), retry policy `manual`, preflight guard `relay-build.mjs check`, recovery guard `relay-build.mjs verify`.
- Absolute paths: `C:\Program Files\nodejs\node.exe` and the repo path.
- `python -m backend.manage validate` reported "Validated 5 automation definitions" (Relay's 3 built-ins + these 2); `reload` was run; `manage status` shows `weather.build` (enabled, next_due `2026-11-01T13:35:00+00:00`) and `weather.rebuild` (disabled).

### The running deployment right now
Started with `node scripts/serve.mjs` as a background task in the previous session, so **it may stop when that session ends**.
- Web: `http://127.0.0.1:4280/?view=map` (vite preview of `frontend/dist`, proxies `/api` to the backend)
- API: `127.0.0.1:8012` (uvicorn, no `--reload`)
- Restart it with `node scripts/serve.mjs` from the repo root. Override ports with `WEATHER_WEB_PORT` / `WEATHER_API_PORT`.

## 3. Verified vs not verified

**Verified (run for real this session):**
- `node --test scripts/deploy-lib.test.mjs`: 32 pass. Mutation check: breaking the dirty-tree rule, the failed-commit suppression, or the backend-restart rule makes tests fail.
- `run` end to end on the real checkout: test gate, build, swap, health check, success, exit code 0. Second `run` correctly `skipped`. `run --force` rebuilds.
- **Rollback end to end:** pointed the health check at a stub server answering 500: exit 1, `health_failed`, old build restored (a marker file inside the old `dist` survived), no `dist-next`/`dist-prev` left behind, next plain run suppressed.
- First run (previous commit unknown) restarted the backend through `serve.mjs`: pid changed, site kept answering.
- `relay-build.mjs check` / `verify` / `plan` run read-only and return sensible output.

**NOT verified:**
- **Whether Relay has actually executed `weather.build` yet.** The first slot was due at 13:35 UTC. Check the result before anything else (see step 1 below). The main unknown is Relay's *minimal inherited environment* (only system paths, temp/home, PATH, locale): `git fetch` over HTTPS and `node`/`npm` should work, but Git credentials / `APPDATA` were not tested under Relay. If the repo is public, fetch needs no credentials.
- A failing type check or failing test (the `stop()` path before the swap). Code is simple, but not exercised end to end. Rollback and failure-suppression were exercised through the health check path.
- A real "new commit arrives on origin" run (fast-forward, then build). The fast-forward logic is tested against real temporary git repos, but not live.
- The recovery guard / "recovery_required" flow in Relay's UI.

## 4. Next steps, in order

1. **Check Relay's first run of `weather.build`.** Open `http://127.0.0.1:8765` (Automations → India Weather) or run, from the Relay repo, `.\.venv\Scripts\python.exe -m backend.manage status`. Expected outcome: `skipped`, because the deployed commit is current. If it failed, read `.deploy/last-failure.log` in the weather repo and Relay's `.local\logs\runner.jsonl`.
   - **Important:** while `.gitignore` is a modified tracked file (it is, right now), the job will report `skipped` / `ownership_conflict` by design. That is expected until step 2.
2. **Ask the user whether to commit** the scripts and the `.gitignore` change (suggest a branch and a PR, matching their workflow, with `Co-Authored-By` per the repo's convention). Until committed, the automation cannot update anything. Do not commit without their go-ahead. If you need to test the job before committing, temporarily `git stash push .gitignore` and remember to `git stash pop` afterwards (the previous session did this and restored it).
3. After the first real new commit lands on main, watch one full automatic cycle succeed and confirm `.deploy/deployed.json` changes and the site updates.
4. Add a short "Deployment automation" section to `README.md` (how `serve.mjs`, `relay-build.mjs`, the Relay manifest, `.deploy/`, `--force` and the tests fit together). Not yet written.
5. Offer (do not just do) persistence: `serve.mjs` does not survive a reboot or session end. Relay itself uses a hidden Windows scheduled task (`automation-service/scripts/windows-service.ps1`) as a model. The user has not asked for this.

## 5. Gotchas learned the hard way

- **Never call `process.exit()` after network activity in `relay-build.mjs`.** Node on Windows aborted with a libuv assertion (`!(handle->flags & UV_HANDLE_CLOSING)`, exit code 127) after a successful run, which Relay would record as a failed run. The job now ends via a `Finished` exception and `process.exitCode`. Keep it that way.
- **Use `npm install`, not `npm ci`,** in the job: `npm ci` deletes `node_modules`, which Windows refuses while the preview server has files open.
- **No `uvicorn --reload`** on Windows: it hangs. Hence the sentinel-file restart in `serve.mjs`.
- **Stopping a background task does not kill its child processes on Windows.** Use `taskkill /PID <pid> /T /F`, and check ownership first (`Get-CimInstance Win32_Process`) so you never kill the user's servers.
- **Backend port is 8012, not 8001** (the repo default in `vite.config.ts` / `dev-backend.mjs`), because 8001/8011 had leftover dead sockets. `serve.mjs` passes `BACKEND_PORT` to the preview server.
- `node --test scripts/` (directory form) does not work on this Node (v24); pass the file: `node --test scripts/deploy-lib.test.mjs`.
- Shell quoting in Git Bash mangled inline `node -e` scripts and heredocs repeatedly. Use file-write tools and small script files instead. Files in this repo may be CRLF.
- Relay manifests: write to a non-`.json` temp name, then rename into place; `validate` before relying on it. An invalid manifest rejects only the custom registry (built-in election automations stay registered), but still fix it quickly. Argv is never shell-interpolated and `.bat`/`.cmd` entrypoints are rejected, so the job calls `node.exe` directly.
- One frontend test file (`tests/components.test.tsx`) can time out when the machine is busy (browsers, servers running); it passed on rerun. That is why the job retries the test run once.

## 6. Useful commands

```powershell
# Weather repo (C:\Users\prash\Documents\LLM Projects\lovely-weather-app)
node --test scripts/deploy-lib.test.mjs          # job logic tests (32)
node scripts/relay-build.mjs plan                # what would run do right now (read-only)
node scripts/relay-build.mjs run                 # what Relay runs
node scripts/relay-build.mjs run --force         # rebuild current commit
npx --prefix frontend vitest run                 # or: cd frontend; npx vitest run   (195 tests)
node scripts/serve.mjs                           # the one local deployment

# Relay repo (C:\Users\prash\Documents\LLM Projects\automation-service)
.\.venv\Scripts\python.exe -m backend.manage validate
.\.venv\Scripts\python.exe -m backend.manage reload
.\.venv\Scripts\python.exe -m backend.manage status
.\.venv\Scripts\python.exe -m backend.manage pause  --automation weather.build   # stop scheduled builds
.\.venv\Scripts\python.exe -m backend.manage resume --automation weather.build
```

Docs worth reading first: Relay's `docs/AUTOMATIONS.md` (manifest contract) and this repo's `README.md` / `DESIGN.md`.

## 7. Files and ports at a glance

| Thing | Where |
| --- | --- |
| Job program | `scripts/relay-build.mjs`, logic in `scripts/deploy-lib.mjs` |
| Deployment supervisor | `scripts/serve.mjs` |
| Automation state (git-ignored) | `.deploy/` (`deployed.json`, `failed.json`, `restart-backend.json`, `last-failure.log`) |
| Served build | `frontend/dist` (staging `dist-next`, rollback copy `dist-prev`) |
| Relay manifest | `automation-service\.local\applications\weather.json` |
| Ports | web 4280, API 8012 (ours); Relay 8765; **not ours:** 5173, 8000 |
