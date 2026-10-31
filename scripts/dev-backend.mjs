// Starts the FastAPI dev server from the backend virtualenv.
// Port: BACKEND_PORT (default 8000); vite.config.ts reads the same variable for its /api proxy.
import { spawn, spawnSync } from "node:child_process";
import { backendDir, venvPython } from "./venv-python.mjs";

const port = process.env.BACKEND_PORT || "8000";
const posix = process.platform !== "win32";
const child = spawn(venvPython(), ["-m", "uvicorn", "app.main:app", "--reload", "--port", port], {
  cwd: backendDir,
  stdio: "inherit",
  detached: posix, // own process group so the whole tree can be killed
});

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  if (posix) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {}
  } else {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  }
}

child.on("exit", (code, signal) => {
  stop(); // reap any remaining reload worker
  process.exit(code ?? 1); // null code means killed by signal
});
for (const sig of ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"]) process.on(sig, () => { stop(); process.exit(0); });
process.on("exit", stop);
