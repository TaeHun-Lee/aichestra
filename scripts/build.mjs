import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const requiredPaths = [
  "docs/briefs/AICHESTRA_BOOTSTRAP.md",
  "AGENTS.md",
  "README.md",
  "docs/features/conflict-manager/v0.md",
  "docs/features/conflict-manager/v1.md",
  "docs/audits/2026-05-11-phase-2-completion-gap.md",
  "docs/audits/2026-05-11-phase-3-completion-gap.md",
  "docs/features/registry/v1-hardening-plan.md",
  "docs/features/registry/v1-hardening.md",
  "docs/features/registry/v0.md",
  "docs/features/auto-improvement/preparation-plan.md",
  "docs/features/auto-improvement/preparation.md",
  "docs/features/auto-improvement/v0-plan.md",
  "docs/features/auto-improvement/v0.md",
  "docs/features/governance/v1-plan.md",
  "docs/features/governance/v1.md",
  "docs/roadmaps/real-integration-foundation-v0-plan.md",
  "docs/foundations/repository-inventory.md",
  "docs/foundations/persistent-storage-schema-v0.md",
  "docs/foundations/auth-rbac-readiness.md",
  "docs/features/real-git-adapter/audits/v0-readiness.md",
  "docs/features/dashboard/read-model-plan.md",
  "docs/roadmaps/real-integration-roadmap.md",
  "infra/migrations/0001_initial_aichestra_schema.sql",
  "docs/audits/2026-05-11-vertical-slice-review.md",
  "apps/api/src/main.ts",
  "apps/worker/src/main.ts",
  "apps/web/src/main.ts",
  "packages/core/src/index.ts",
  "packages/db/prisma/schema.prisma",
  "packages/git-adapter/src/index.ts",
  "packages/improvement/src/index.ts",
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
