import type { AgentKind, Repo, Task } from "../domain/models.ts";
import { createId } from "../domain/ids.ts";
import { isTaskStatus } from "../domain/status.ts";
import { asObject, numberField, schema, stringArrayField, stringField } from "./schema.ts";
import type { Schema } from "./schema.ts";

export type CreateTaskInput = {
  title: string;
  description?: string;
  repoId: string;
  baseBranch: string;
  requesterUserId?: string;
  selectedAgent?: AgentKind;
  selectedModel?: string;
  selectedSkillIds?: string[];
  selectedHarnessId?: string;
  budgetLimitUsd?: number;
};

export type CreateRepoInput = {
  provider?: Repo["provider"];
  owner: string;
  name: string;
  defaultBranch?: string;
  remoteUrl?: string;
};

export const createTaskSchema: Schema<CreateTaskInput> = schema((input) => {
  const object = asObject(input, "CreateTaskInput");
  const preferredAgent = stringField(object, "preferredAgent", { optional: true });
  const selectedAgent = stringField(object, "selectedAgent", { optional: true }) ?? preferredAgent;
  const targetBranch = stringField(object, "targetBranch", { optional: true });
  const baseBranch = stringField(object, "baseBranch", { optional: true }) ?? targetBranch ?? "main";
  const requesterUserId = stringField(object, "requesterUserId", { optional: true }) ?? stringField(object, "requestedBy", { optional: true });

  return {
    title: stringField(object, "title") ?? "",
    description: stringField(object, "description", { optional: true }),
    repoId: stringField(object, "repoId") ?? "",
    baseBranch,
    requesterUserId,
    selectedAgent: selectedAgent === "mock-codex" ? "codex" : (selectedAgent as AgentKind | undefined),
    selectedModel: stringField(object, "selectedModel", { optional: true }),
    selectedSkillIds: stringArrayField(object, "selectedSkillIds", { optional: true }),
    selectedHarnessId: stringField(object, "selectedHarnessId", { optional: true }),
    budgetLimitUsd: numberField(object, "budgetLimitUsd", { optional: true, min: 0 })
  };
});

export const createRepoSchema: Schema<CreateRepoInput> = schema((input) => {
  const object = asObject(input, "CreateRepoInput");

  return {
    provider: (stringField(object, "provider", { optional: true }) as Repo["provider"] | undefined) ?? "local",
    owner: stringField(object, "owner") ?? "",
    name: stringField(object, "name") ?? "",
    defaultBranch: stringField(object, "defaultBranch", { optional: true }) ?? "main",
    remoteUrl: stringField(object, "remoteUrl", { optional: true })
  };
});

export function taskFromInput(input: CreateTaskInput): Task {
  const now = new Date();

  return {
    id: createId("task"),
    title: input.title,
    description: input.description,
    status: "draft",
    requesterUserId: input.requesterUserId ?? "user_demo_admin",
    repoId: input.repoId,
    baseBranch: input.baseBranch,
    selectedAgent: input.selectedAgent,
    selectedModel: input.selectedModel,
    selectedSkillIds: input.selectedSkillIds ?? [],
    selectedHarnessId: input.selectedHarnessId,
    budgetLimitUsd: input.budgetLimitUsd,
    createdAt: now,
    updatedAt: now
  };
}

export function repoFromInput(input: CreateRepoInput): Repo {
  const now = new Date();

  return {
    id: createId("repo"),
    provider: input.provider ?? "local",
    owner: input.owner,
    name: input.name,
    defaultBranch: input.defaultBranch ?? "main",
    remoteUrl: input.remoteUrl,
    status: "active",
    createdAt: now,
    updatedAt: now
  };
}

export const taskStatusSchema: Schema<string> = schema((input) => {
  if (typeof input !== "string" || !isTaskStatus(input)) {
    throw new Error("Invalid task status");
  }

  return input;
});
