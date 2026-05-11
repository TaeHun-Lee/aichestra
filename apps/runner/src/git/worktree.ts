export type WorktreeSpec = {
  repoId: string;
  branchName: string;
  baseBranch: string;
};

export function describeMockWorktree(spec: WorktreeSpec): string {
  return `mock-worktree:${spec.repoId}:${spec.baseBranch}->${spec.branchName}`;
}
