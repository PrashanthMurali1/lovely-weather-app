// Runs backend pytest with the backend virtualenv.
import { spawnSync } from "node:child_process";
import { backendDir, venvPython } from "./venv-python.mjs";

const r = spawnSync(venvPython(), ["-m", "pytest"], { cwd: backendDir, stdio: "inherit" });
process.exit(r.status ?? 1);
