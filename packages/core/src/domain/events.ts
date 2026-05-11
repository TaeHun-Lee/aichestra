import type { TaskStatus } from "./status.ts";

export type DomainEvent =
  | {
      type: "task.created";
      taskId: string;
      createdAt: Date;
    }
  | {
      type: "task.status_changed";
      taskId: string;
      from: TaskStatus;
      to: TaskStatus;
      createdAt: Date;
    }
  | {
      type: "usage.recorded";
      usageEventId: string;
      taskId?: string;
      createdAt: Date;
    }
  | {
      type: "audit.recorded";
      auditLogId: string;
      taskId?: string;
      createdAt: Date;
    };
