// Starts the FastAPI dev server using the backend virtualenv (cross-platform).
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const backend = join(dirname(fileURLToPath(import.meta.url)), "..", "backend");
const venvPython =
  process.platform === "win32"
    ? join(backend, ".venv", "Scripts", "python.exe")
    : join(backend, ".venv", "bin", "python");

function works(cmd) {
  return spawnSync(cmd, ["--version"], { stdio: "ignore" }).status === 0;
}

let python = existsSync(venvPython) ? venvPython : null;
if (!python) {
  const fallbacks = process.platform === "win32" ? ["py", "python", "python3"] : ["python3", "python"];
  python = fallbacks.find(works);
  console.warn(`backend/.venv not found; falling back to system "${python}". See README setup.`);
}
if (!python) {
  console.error("No Python interpreter found. Create backend/.venv (see README).");
  process.exit(1);
}

const child = spawn(python, ["-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"], {
  cwd: backend,
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill());
