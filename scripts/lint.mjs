import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignored = new Set([".git", "node_modules", ".next", "dist", "coverage"]);
const ignoredFiles = new Set([]);
const checkedExtensions = new Set([
  ".css",
  ".json",
  ".md",
  ".mjs",
  ".prisma",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml"
]);

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    if (ignoredFiles.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
      continue;
    }
    if (checkedExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function hasExternalRuntimeCall(text) {
  return [
    /fetch\(\s*["']https?:\/\//,
    /fetch\(\s*`https?:\/\//,
    /fetch\(\s*new\s+URL\(\s*["'`]https?:\/\//,
    /https\.request\(/
  ].some((pattern) => pattern.test(text));
}

const failures = [];
for (const file of await collectFiles(root)) {
  const relative = path.relative(root, file);
  const text = await readFile(file, "utf8");
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (/[ \t]$/.test(line)) {
      failures.push(`${relative}:${index + 1} has trailing whitespace`);
    }
  });

  if ((relative.endsWith(".ts") || relative.endsWith(".tsx") || relative.endsWith(".mjs")) && hasExternalRuntimeCall(text)) {
    failures.push(`${relative} appears to call an external HTTP API directly`);
  }

  if (relative.endsWith(".json")) {
    try {
      JSON.parse(text);
    } catch (error) {
      failures.push(`${relative} is invalid JSON: ${error.message}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("lint passed");
