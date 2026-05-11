import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const ignored = new Set([".git", "node_modules", ".next", "dist", "coverage"]);

async function collectTests(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectTests(fullPath));
      continue;
    }
    if (entry.name.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

const tests = await collectTests(root);
if (tests.length === 0) {
  console.error("No tests found");
  process.exit(1);
}

const child = spawn(process.execPath, ["--test", ...tests], {
  cwd: root,
  stdio: "inherit"
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
