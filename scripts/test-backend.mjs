// Runs backend pytest with the backend virtualenv (cross-platform).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const backend = join(dirname(fileURLToPath(import.meta.url)), "..", "backend");
const venvPython =
  process.platform === "win32"
    ? join(backend, ".venv", "Scripts", "python.exe")
    : join(backend, ".venv", "bin", "python");
const python = existsSync(venvPython) ? venvPython : process.platform === "win32" ? "py" : "python3";
const r = spawnSync(python, ["-m", "pytest"], { cwd: backend, stdio: "inherit" });
process.exit(r.status ?? 1);
