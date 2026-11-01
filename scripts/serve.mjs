// The one local deployment: the FastAPI backend plus the built frontend (vite preview), kept running together.
//
//   node scripts/serve.mjs
//
// Web: WEATHER_WEB_PORT (default 4280). API: WEATHER_API_PORT (default 8012); the preview server proxies /api to it.
// The backend runs without auto-reload (reload hangs on Windows). Instead, when the build automation records
// .deploy/restart-backend.json, this process restarts the backend. A process that exits is restarted after a pause.
import { spawn, spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { join } from "node:path";
import { root, stateDir } from "./deploy-lib.mjs";
import { backendDir, venvPython } from "./venv-python.mjs";

const api = process.env.WEATHER_API_PORT || "8012";
const web = process.env.WEATHER_WEB_PORT || "4280";
const frontend = join(root, "frontend");
const sentinel = join(stateDir(), "restart-backend.json");
const posix = process.platform !== "win32";

const log = (msg) => console.log(`[serve] ${new Date().toISOString()} ${msg}`);

function killTree(child) {
  if (!child?.pid) return;
  if (posix) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  } else {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  }
}

/** Keep one child running: restart it when it exits, unless we are stopping or it was stopped on purpose. */
function supervise(name, file, args, options) {
  const state = { child: null, expected: false, stopping: false };
  const start = () => {
    state.child = spawn(file, args, { ...options, stdio: "inherit", windowsHide: true, detached: posix });
    log(`${name} started (pid ${state.child.pid})`);
    state.child.on("exit", (code) => {
      if (state.stopping) return;
      if (state.expected) {
        state.expected = false;
        return start();
      }
      log(`${name} exited with code ${code}; restarting in 3s`);
      setTimeout(start, 3000);
    });
  };
  start();
  return {
    restart() {
      log(`${name} restarting`);
      state.expected = true;
      killTree(state.child);
    },
    stop() {
      state.stopping = true;
      killTree(state.child);
    },
  };
}

const backend = supervise("backend", venvPython(), ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", api], { cwd: backendDir });
const frontendServer = supervise(
  "web",
  process.execPath,
  [join(frontend, "node_modules", "vite", "bin", "vite.js"), "preview", "--port", web, "--host", "127.0.0.1", "--strictPort"],
  { cwd: frontend, env: { ...process.env, BACKEND_PORT: api } },
);

let seen = mtime();
function mtime() {
  try {
    return statSync(sentinel).mtimeMs;
  } catch {
    return 0;
  }
}
setInterval(() => {
  const now = mtime();
  if (now !== seen) {
    seen = now;
    backend.restart();
  }
}, 2000);

let stopped = false;
function shutdown() {
  if (stopped) return;
  stopped = true;
  backend.stop();
  frontendServer.stop();
  process.exit(0);
}
for (const sig of ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"]) process.on(sig, shutdown);
process.on("exit", () => {
  backend.stop();
  frontendServer.stop();
});
log(`serving http://127.0.0.1:${web} (api on ${api})`);
