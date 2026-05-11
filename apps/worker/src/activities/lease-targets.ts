import type { Task } from "@aichestra/core";

export function inferLeaseTargets(task: Task): { files: string[]; symbols: string[]; tests: string[] } {
  const text = `${task.title} ${task.description ?? ""}`.toLowerCase();

  if (text.includes("auth") || text.includes("login") || text.includes("session")) {
    return {
      files: ["src/auth/session.ts", "tests/auth/session.test.ts"],
      symbols: ["SessionStore", "LoginController"],
      tests: ["auth/session.test.ts"]
    };
  }

  if (text.includes("payment")) {
    return {
      files: ["src/payments/service.ts", "tests/payments/service.test.ts"],
      symbols: ["PaymentService"],
      tests: ["payments/service.test.ts"]
    };
  }

  if (text.includes("infra") || text.includes("workflow")) {
    return {
      files: ["infra/app.tf"],
      symbols: [],
      tests: []
    };
  }

  return {
    files: ["src/app.ts"],
    symbols: ["Example"],
    tests: []
  };
}
