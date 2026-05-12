import type { GitChangedFile } from "../interfaces.ts";

export type GitHubRepository = {
  owner: string;
  name: string;
  defaultBranch: string;
};

export type GitHubBranch = {
  name: string;
  sha: string;
};

export type GitHubPullRequest = {
  number: number;
  id: number;
  htmlUrl: string;
  title: string;
  head: string;
  base: string;
  state: "open" | "closed" | "merged";
};

export type GitHubClient = {
  validateConnection(): Promise<{ ok: boolean; message: string }>;
  getRepository(owner: string, repo: string): Promise<GitHubRepository>;
  getBranch(owner: string, repo: string, branch: string): Promise<GitHubBranch>;
  createBranch(owner: string, repo: string, baseBranch: string, newBranch: string): Promise<GitHubBranch>;
  createPullRequest(owner: string, repo: string, title: string, head: string, base: string, body?: string): Promise<GitHubPullRequest>;
  listPullRequests(owner: string, repo: string): Promise<GitHubPullRequest[]>;
  getPullRequest(owner: string, repo: string, number: number): Promise<GitHubPullRequest>;
  getPullRequestChangedFiles(owner: string, repo: string, number: number): Promise<GitChangedFile[]>;
};

export class NoopGitHubClient implements GitHubClient {
  async validateConnection(): Promise<{ ok: boolean; message: string }> {
    throw new Error("github_client_not_enabled");
  }

  async getRepository(): Promise<GitHubRepository> {
    throw new Error("github_client_not_enabled");
  }

  async getBranch(): Promise<GitHubBranch> {
    throw new Error("github_client_not_enabled");
  }

  async createBranch(): Promise<GitHubBranch> {
    throw new Error("github_client_not_enabled");
  }

  async createPullRequest(): Promise<GitHubPullRequest> {
    throw new Error("github_client_not_enabled");
  }

  async listPullRequests(): Promise<GitHubPullRequest[]> {
    throw new Error("github_client_not_enabled");
  }

  async getPullRequest(): Promise<GitHubPullRequest> {
    throw new Error("github_client_not_enabled");
  }

  async getPullRequestChangedFiles(): Promise<GitChangedFile[]> {
    throw new Error("github_client_not_enabled");
  }
}

export type FetchGitHubClientOptions = {
  token: string;
  apiBaseUrl?: string;
};

export class FetchGitHubClient implements GitHubClient {
  private readonly token: string;
  private readonly apiBaseUrl: string;

  constructor(options: FetchGitHubClientOptions) {
    this.token = options.token;
    this.apiBaseUrl = options.apiBaseUrl ?? "https://api.github.com";
  }

  async validateConnection(): Promise<{ ok: boolean; message: string }> {
    await this.request("GET", "/rate_limit");
    return { ok: true, message: "GitHub API connection validated." };
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    const response = await this.request("GET", `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    const record = asRecord(response);
    return {
      owner,
      name: String(record.name ?? repo),
      defaultBranch: String(record.default_branch ?? "main")
    };
  }

  async getBranch(owner: string, repo: string, branch: string): Promise<GitHubBranch> {
    const response = await this.request("GET", `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches/${encodeURIComponent(branch)}`);
    const record = asRecord(response);
    const commit = asRecord(record.commit);
    const sha = typeof commit.sha === "string" ? commit.sha : undefined;
    if (!sha) throw new Error("github_branch_sha_missing");
    return { name: branch, sha };
  }

  async createBranch(owner: string, repo: string, baseBranch: string, newBranch: string): Promise<GitHubBranch> {
    const base = await this.getBranch(owner, repo, baseBranch);
    await this.request("POST", `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`, {
      ref: `refs/heads/${newBranch}`,
      sha: base.sha
    });
    return { name: newBranch, sha: base.sha };
  }

  async createPullRequest(owner: string, repo: string, title: string, head: string, base: string, body?: string): Promise<GitHubPullRequest> {
    const response = await this.request("POST", `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`, {
      title,
      head,
      base,
      body
    });
    return pullRequestFromResponse(response);
  }

  async listPullRequests(owner: string, repo: string): Promise<GitHubPullRequest[]> {
    const response = await this.request("GET", `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=open`);
    return Array.isArray(response) ? response.map(pullRequestFromResponse) : [];
  }

  async getPullRequest(owner: string, repo: string, number: number): Promise<GitHubPullRequest> {
    const response = await this.request("GET", `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}`);
    return pullRequestFromResponse(response);
  }

  async getPullRequestChangedFiles(owner: string, repo: string, number: number): Promise<GitChangedFile[]> {
    const response = await this.request("GET", `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}/files`);
    if (!Array.isArray(response)) return [];
    return response.map((file) => {
      const record = asRecord(file);
      return sanitizeChangedFile({
        path: String(record.filename ?? ""),
        previousPath: typeof record.previous_filename === "string" ? record.previous_filename : undefined,
        status: statusFromGitHub(record.status)
      });
    }).filter((file) => file.path.length > 0);
  }

  private async request(method: string, path: string, body?: Record<string, unknown>): Promise<unknown> {
    const url = new URL(path, this.apiBaseUrl);
    const response = await fetch(url, {
      method,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "aichestra-real-git-adapter-v1"
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) {
      throw new Error(`github_http_${response.status}`);
    }
    if (response.status === 204) return {};
    return response.json() as Promise<unknown>;
  }
}

export function sanitizeChangedFile(file: GitChangedFile): GitChangedFile {
  return {
    path: sanitizePath(file.path),
    previousPath: file.previousPath ? sanitizePath(file.previousPath) : undefined,
    status: file.status
  };
}

function sanitizePath(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/^\/+/, "").slice(0, 500);
}

function statusFromGitHub(value: unknown): GitChangedFile["status"] {
  if (value === "added" || value === "modified" || value === "removed" || value === "deleted" || value === "renamed" || value === "copied") {
    return value === "removed" ? "deleted" : value;
  }
  return "unknown";
}

function pullRequestFromResponse(response: unknown): GitHubPullRequest {
  const record = asRecord(response);
  const head = asRecord(record.head);
  const base = asRecord(record.base);
  const merged = record.merged === true;
  return {
    number: Number(record.number ?? 0),
    id: Number(record.id ?? 0),
    htmlUrl: String(record.html_url ?? ""),
    title: String(record.title ?? ""),
    head: String(head.ref ?? ""),
    base: String(base.ref ?? ""),
    state: merged ? "merged" : record.state === "closed" ? "closed" : "open"
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
