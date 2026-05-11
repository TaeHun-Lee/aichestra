import type { UsageEvent } from "@aichestra/core";
import type { InMemoryAichestraStore } from "./repository.ts";

export type UsageLedger = {
  record(entry: Omit<UsageEvent, "id" | "createdAt">): Promise<UsageEvent>;
  listByTask(taskId: string): Promise<UsageEvent[]>;
};

export class MockUsageLedger implements UsageLedger {
  private store: InMemoryAichestraStore;

  constructor(store: InMemoryAichestraStore) {
    this.store = store;
  }

  async record(entry: Omit<UsageEvent, "id" | "createdAt">): Promise<UsageEvent> {
    return this.store.recordUsage(entry);
  }

  async listByTask(taskId: string): Promise<UsageEvent[]> {
    return this.store.listUsageEvents().filter((event) => event.taskId === taskId);
  }
}
