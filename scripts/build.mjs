import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const requiredPaths = [
  "AICHESTRA_BOOTSTRAP.md",
  "AGENTS.md",
  "README.md",
  "docs/conflict-manager-v0.md",
  "docs/conflict-manager-v1.md",
  "docs/phase-2-completion-gap.md",
  "docs/phase-3-completion-gap.md",
  "docs/phase-3-hardening-plan.md",
  "docs/phase-3-registry-hardening-v1.md",
  "docs/phase-3-registry-v0.md",
  "docs/vertical-slice-review.md",
  "apps/api/src/main.ts",
  "apps/worker/src/main.ts",
  "apps/web/src/main.ts",
  "packages/core/src/index.ts",
  "packages/db/prisma/schema.prisma",
  "packages/git-adapter/src/index.ts",
  "packages/llm-gateway/src/index.ts",
  "packages/policy/src/index.ts",
  "packages/registry/src/index.ts"
];

async function assertExists(relativePath) {
  await access(path.join(root, relativePath));
}

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

for (const relativePath of requiredPaths) {
  await assertExists(relativePath);
}

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
for (const scriptName of ["lint", "typecheck", "test", "build"]) {
  if (!packageJson.scripts?.[scriptName]) {
    throw new Error(`Missing root script: ${scriptName}`);
  }
}

await run("node", ["--check", "apps/api/src/main.ts"]);
await run("node", ["--check", "apps/worker/src/main.ts"]);
await run("node", ["--check", "apps/web/src/main.ts"]);

console.log("build passed");
