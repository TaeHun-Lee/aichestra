import test from "node:test";
import assert from "node:assert/strict";
import { createSeededStore } from "@aichestra/db";
import { LLMGatewayService } from "@aichestra/llm-gateway";

// The seeded default system virtual key (vmk_system_mock) carries
// monthlyBudgetUsd: 100. These tests prove the gateway now enforces that
// cumulative cap from the usage repository, rather than only the per-request
// estimate. Because the aggregation reads the usage repository, the counter is
// durable whenever the store is Postgres-backed and therefore survives restarts.

function recordSpend(store: ReturnType<typeof createSeededStore>, virtualKeyId: string, costUsd: number) {
  return store.recordUsage({
    userId: "system",
    provider: "mock",
    eventType: "llm_call",
    costUsd,
    metadata: { source: "llm_gateway", virtual_key_id: virtualKeyId }
  });
}

test("cumulative monthly spend blocks the default system key once prior spend exceeds monthlyBudgetUsd", () => {
  const store = createSeededStore();
  const service = new LLMGatewayService({ usageRepository: store });

  const before = service.routeRequest({ taskId: "t1", taskRunId: "r1", prompt: "Fix code bug", budgetLimitUsd: 1 });
  assert.equal(before.ok, true, "a fresh request is allowed before any spend");

  // Prior spend this month already at the monthly cap for the default key.
  recordSpend(store, "vmk_system_mock", 100);

  const after = service.routeRequest({ taskId: "t2", taskRunId: "r2", prompt: "Fix code bug", budgetLimitUsd: 1 });
  assert.equal(after.ok, false, "further requests are blocked once the monthly cap is reached");
  assert.equal(after.routingDecision?.decision, "budget_blocked");
  assert.match(after.routingDecision?.reason ?? "", /monthly_budget_exceeded/);
  assert.equal(after.budgetDecision?.allowed, false);
  assert.equal(after.budgetDecision?.reason, "monthly_budget_exceeded");
});

test("cumulative monthly enforcement ignores spend attributed to other virtual keys", () => {
  const store = createSeededStore();
  const service = new LLMGatewayService({ usageRepository: store });

  // Spend belongs to a different key; it must not consume the default key budget.
  recordSpend(store, "vmk_some_other_key", 100);

  const result = service.routeRequest({ taskId: "t3", taskRunId: "r3", prompt: "Fix code bug", budgetLimitUsd: 1 });
  assert.equal(result.ok, true, "another key's spend does not block the default key");
});

test("monthly budget remaining is reported on an allowed decision", () => {
  const store = createSeededStore();
  const service = new LLMGatewayService({ usageRepository: store });

  recordSpend(store, "vmk_system_mock", 40);

  const result = service.routeRequest({ taskId: "t4", taskRunId: "r4", prompt: "Fix code bug" });
  assert.equal(result.ok, true);
  assert.equal(result.budgetDecision?.allowed, true);
  // Remaining must reflect the monthly cap minus prior spend minus this call,
  // and stay at or below the 100 - 40 = 60 headroom.
  assert.ok((result.budgetDecision?.budgetRemainingUsd ?? Infinity) <= 60);
});
