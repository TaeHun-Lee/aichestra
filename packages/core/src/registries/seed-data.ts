import type { HarnessPackage, InstructionArtifact, Repo, SkillPackage, User } from "../domain/models.ts";

const now = new Date("2026-01-01T00:00:00.000Z");

export const seedUsers: User[] = [
  {
    id: "user_demo_admin",
    email: "admin@example.com",
    name: "Demo Admin",
    createdAt: now,
    updatedAt: now
  }
];

export const seedRepos: Repo[] = [
  {
    id: "repo_demo_backend",
    provider: "local",
    owner: "demo",
    name: "backend",
    defaultBranch: "main",
    status: "active",
    createdAt: now,
    updatedAt: now
  }
];

export const seedSkills: SkillPackage[] = [
  {
    id: "skill_jest_test_fixer",
    name: "jest-test-fixer",
    version: "1.0.0",
    description: "Repair deterministic Jest test failures with focused source and test edits.",
    status: "active",
    approvalStatus: "approved",
    evalStatus: "passed",
    owner: "platform",
    compatibleAgents: ["codex", "claude-code", "aider"],
    compatibleModels: ["mock-model"],
    requiredTools: ["git", "node", "pnpm", "ripgrep"],
    requiredHarnesses: ["backend-node20", "frontend-node20"],
    invocationRules: ["Select when a task mentions Jest, tests, specs, or failing assertions."],
    instructionRef: {
      kind: "instruction",
      name: "org-secure-coding-baseline",
      version: "1.0.0",
      id: "instr_org_secure_coding_baseline",
      checksum: "sha256:org-secure-coding-baseline-v1"
    },
    evalRefs: ["eval:jtest-v0"],
    tags: ["tests", "jest", "repair"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "skill_auth_debugging",
    name: "auth-debugging",
    version: "1.0.0",
    description: "Diagnose authentication and session-related bugs with minimal changes.",
    status: "active",
    approvalStatus: "approved",
    evalStatus: "passed",
    owner: "platform",
    compatibleAgents: ["codex", "claude-code", "aider"],
    compatibleModels: ["mock-model"],
    requiredTools: ["git", "ripgrep"],
    requiredHarnesses: ["backend-node20"],
    invocationRules: ["Select when a task mentions auth, login, session, token, or permissions."],
    instructionRef: {
      kind: "instruction",
      name: "org-secure-coding-baseline",
      version: "1.0.0",
      id: "instr_org_secure_coding_baseline",
      checksum: "sha256:org-secure-coding-baseline-v1"
    },
    evalRefs: ["eval:auth-debugging-v0"],
    tags: ["auth", "backend", "debugging"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "skill_conflict_risk_reviewer",
    name: "conflict-risk-reviewer",
    version: "1.0.0",
    description: "Review branch leases, overlap signals, and dry-run merge simulation results.",
    status: "active",
    approvalStatus: "approved",
    evalStatus: "passed",
    owner: "platform",
    compatibleAgents: ["codex", "claude-code", "aider"],
    compatibleModels: ["mock-model"],
    requiredTools: ["git", "ripgrep"],
    requiredHarnesses: ["local-git-dry-run"],
    invocationRules: ["Select when a task mentions conflict, merge, branch lease, dry-run, or queue risk."],
    instructionRef: {
      kind: "instruction",
      name: "conflict-manager-guidance",
      version: "1.0.0",
      id: "instr_conflict_manager_guidance",
      checksum: "sha256:conflict-manager-guidance-v1"
    },
    evalRefs: ["eval:conflict-review-v0"],
    tags: ["conflict", "merge-queue", "phase-2"],
    createdAt: now,
    updatedAt: now
  }
];

export const seedHarnesses: HarnessPackage[] = [
  {
    id: "harness_backend_node20",
    name: "backend-node20",
    version: "1.0.0",
    description: "Node 20 backend task harness with deterministic pnpm validation commands.",
    status: "active",
    approvalStatus: "approved",
    evalStatus: "passed",
    owner: "platform",
    runtimeType: "docker",
    runtimeImage: "node:20",
    allowedTools: ["git", "node", "pnpm", "ripgrep"],
    allowedMcpServers: [],
    secretScopes: [],
    networkPolicy: {
      mode: "allowlist",
      allow: ["npm registry through developer-approved install only"]
    },
    testCommands: ["pnpm lint", "pnpm test"],
    compatibleAgents: ["codex", "claude-code", "aider"],
    instructionLoadingPolicy: {
      enabled: true,
      scopes: ["org", "repo", "directory", "task"],
      maxContextBytes: 65536
    },
    createdAt: now,
    updatedAt: now
  },
  {
    id: "harness_frontend_node20",
    name: "frontend-node20",
    version: "1.0.0",
    description: "Node 20 frontend harness for Vite or dashboard-oriented changes.",
    status: "active",
    approvalStatus: "approved",
    evalStatus: "passed",
    owner: "platform",
    runtimeType: "docker",
    runtimeImage: "node:20",
    allowedTools: ["git", "node", "pnpm", "ripgrep"],
    allowedMcpServers: [],
    secretScopes: [],
    networkPolicy: {
      mode: "allowlist",
      allow: ["npm registry through developer-approved install only"]
    },
    testCommands: ["pnpm lint", "pnpm test", "pnpm build"],
    compatibleAgents: ["codex", "claude-code", "aider"],
    instructionLoadingPolicy: {
      enabled: true,
      scopes: ["org", "repo", "directory", "task"],
      maxContextBytes: 65536
    },
    createdAt: now,
    updatedAt: now
  },
  {
    id: "harness_local_git_dry_run",
    name: "local-git-dry-run",
    version: "1.0.0",
    description: "Local-only harness for dry-run merge simulation without remote git operations.",
    status: "active",
    approvalStatus: "approved",
    evalStatus: "passed",
    owner: "platform",
    runtimeType: "local",
    allowedTools: ["git"],
    allowedMcpServers: [],
    secretScopes: [],
    networkPolicy: {
      mode: "disabled"
    },
    testCommands: ["pnpm test"],
    compatibleAgents: ["codex", "claude-code", "aider"],
    instructionLoadingPolicy: {
      enabled: true,
      scopes: ["org", "repo", "task"],
      maxContextBytes: 32768
    },
    createdAt: now,
    updatedAt: now
  }
];

export const seedInstructions: InstructionArtifact[] = [
  {
    id: "instr_org_secure_coding_baseline",
    name: "org-secure-coding-baseline",
    version: "1.0.0",
    description: "Organization-wide MVP safety baseline for mock-first agent work.",
    status: "active",
    approvalStatus: "approved",
    evalStatus: "passed",
    owner: "platform",
    type: "org_policy",
    scope: "org",
    checksum: "sha256:org-secure-coding-baseline-v1",
    checksumAlgorithm: "sha256",
    checksumStatus: "unverified",
    precedence: 10,
    appliesToAgents: ["codex", "claude-code", "aider"],
    appliesToRepos: [],
    appliesToDirectories: [],
    maxContextBytes: 16384,
    body: "Use mock adapters by default. Do not store secrets. Keep changes typed and tested.",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "instr_repo_agents_md",
    name: "repo-agents-md",
    version: "1.0.0",
    description: "Repository-local AGENTS.md instructions for Aichestra contributors.",
    status: "active",
    approvalStatus: "approved",
    evalStatus: "passed",
    owner: "platform",
    type: "agents_md",
    scope: "repo",
    path: "AGENTS.md",
    checksum: "sha256:repo-agents-md-v1",
    checksumAlgorithm: "sha256",
    checksumStatus: "unverified",
    precedence: 30,
    appliesToAgents: ["codex", "claude-code", "aider"],
    appliesToRepos: ["repo_demo_backend"],
    appliesToDirectories: [],
    maxContextBytes: 32768,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "instr_conflict_manager_guidance",
    name: "conflict-manager-guidance",
    version: "1.0.0",
    description: "Conflict Manager guidance for lease, risk, and merge queue work.",
    status: "active",
    approvalStatus: "approved",
    evalStatus: "passed",
    owner: "platform",
    type: "custom",
    scope: "repo",
    checksum: "sha256:conflict-manager-guidance-v1",
    checksumAlgorithm: "sha256",
    checksumStatus: "unverified",
    precedence: 40,
    appliesToAgents: ["codex", "claude-code", "aider"],
    appliesToRepos: ["repo_demo_backend"],
    appliesToDirectories: [],
    maxContextBytes: 16384,
    body: "Use local-only dry-run merge simulation. Never fetch, push, or perform real PR merges in the MVP.",
    createdAt: now,
    updatedAt: now
  }
];
