// Resolves the backend virtualenv's python, or exits with a clear message.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const backendDir = join(dirname(fileURLToPath(import.meta.url)), "..", "backend");

export function venvPython() {
  const py =
    process.platform === "win32"
      ? join(backendDir, ".venv", "Scripts", "python.exe")
      : join(backendDir, ".venv", "bin", "python");
  if (!existsSync(py)) {
    console.error(
      'backend/.venv not found — create it per the README Setup section, then pip install -e "backend[dev]"',
    );
    process.exit(1);
  }
  return py;
}
