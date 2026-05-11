import { createId } from "@aichestra/core";
import type { LLMProviderKind, VirtualModelKey, VirtualModelKeyStatus } from "./types.ts";

export type VirtualModelKeyRepository = {
  listVirtualKeys(): VirtualModelKey[];
  getVirtualKey(id: string): VirtualModelKey | undefined;
  createVirtualKey(input: Omit<VirtualModelKey, "id" | "createdAt" | "updatedAt"> & { id?: string }): VirtualModelKey;
  updateVirtualKeyStatus(id: string, status: VirtualModelKeyStatus): VirtualModelKey;
};

export class InMemoryVirtualModelKeyRepository implements VirtualModelKeyRepository {
  private readonly keys = new Map<string, VirtualModelKey>();

  constructor(seed: VirtualModelKey[] = [createDefaultVirtualModelKey()]) {
    for (const key of seed) {
      this.keys.set(key.id, structuredClone(key));
    }
  }

  listVirtualKeys(): VirtualModelKey[] {
    return [...this.keys.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  getVirtualKey(id: string): VirtualModelKey | undefined {
    return this.keys.get(id);
  }

  createVirtualKey(input: Omit<VirtualModelKey, "id" | "createdAt" | "updatedAt"> & { id?: string }): VirtualModelKey {
    validateVirtualKey(input);
    const now = new Date();
    const key: VirtualModelKey = {
      ...input,
      id: input.id ?? createId("vmk"),
      createdAt: now,
      updatedAt: now
    };
    this.keys.set(key.id, key);
    return key;
  }

  updateVirtualKeyStatus(id: string, status: VirtualModelKeyStatus): VirtualModelKey {
    if (!isVirtualModelKeyStatus(status)) {
      throw new Error(`Invalid virtual model key status: ${status}`);
    }
    const key = this.getVirtualKey(id);
    if (!key) {
      throw new Error(`Virtual model key not found: ${id}`);
    }
    const updated = {
      ...key,
      status,
      updatedAt: new Date()
    };
    this.keys.set(id, updated);
    return updated;
  }
}

export class VirtualModelKeyService {
  private readonly repository: VirtualModelKeyRepository;

  constructor(repository: VirtualModelKeyRepository = new InMemoryVirtualModelKeyRepository()) {
    this.repository = repository;
  }

  listVirtualKeys(): VirtualModelKey[] {
    return this.repository.listVirtualKeys();
  }

  getVirtualKey(id: string): VirtualModelKey | undefined {
    return this.repository.getVirtualKey(id);
  }

  createVirtualKey(input: Omit<VirtualModelKey, "id" | "createdAt" | "updatedAt"> & { id?: string }): VirtualModelKey {
    return this.repository.createVirtualKey(input);
  }

  updateVirtualKeyStatus(id: string, status: VirtualModelKeyStatus): VirtualModelKey {
    return this.repository.updateVirtualKeyStatus(id, status);
  }
}

export function createDefaultVirtualModelKey(): VirtualModelKey {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "vmk_system_mock",
    ownerKind: "system",
    ownerId: "system",
    displayName: "System Mock Virtual Model Key",
    allowedProviderKinds: ["mock"],
    allowedModelIds: ["mock-model", "mock-small@1.0", "mock-coder@1.0", "mock-conflict-resolver@1.0", "mock-registry-reviewer@1.0"],
    monthlyBudgetUsd: 100,
    perTaskBudgetUsd: 5,
    rpmLimit: 120,
    tpmLimit: 120000,
    status: "active",
    createdAt: now,
    updatedAt: now
  };
}

export function isVirtualModelKeyStatus(value: unknown): value is VirtualModelKeyStatus {
  return value === "active" || value === "disabled";
}

function validateVirtualKey(input: Omit<VirtualModelKey, "id" | "createdAt" | "updatedAt">): void {
  if (!input.ownerKind || !input.ownerId || !input.displayName || !isVirtualModelKeyStatus(input.status)) {
    throw new Error("Virtual model key requires ownerKind, ownerId, displayName, and status.");
  }
  if (!Array.isArray(input.allowedProviderKinds) || input.allowedProviderKinds.length === 0) {
    throw new Error("Virtual model key requires at least one allowed provider kind.");
  }
  if (!Array.isArray(input.allowedModelIds) || input.allowedModelIds.length === 0) {
    throw new Error("Virtual model key requires at least one allowed model id.");
  }
}

export function allowsProvider(key: VirtualModelKey, providerKind: LLMProviderKind): boolean {
  return key.allowedProviderKinds.includes(providerKind);
}
