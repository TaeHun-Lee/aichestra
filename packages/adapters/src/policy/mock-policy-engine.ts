import type { PolicyDecision, PolicyEngine } from "../interfaces.ts";

const blockedBudgetLimitUsd = 1000;
const humanReviewPaths = ["infra/", "terraform/", "security/", ".github/workflows/", "schema/", "migrations/", "auth/", "payments/"];

export class MockPolicyEngine implements PolicyEngine {
  evaluateTask(input: { taskId: string; files: string[]; budgetLimitUsd?: number }): PolicyDecision {
    if ((input.budgetLimitUsd ?? 0) > blockedBudgetLimitUsd) {
      return {
        allowed: false,
        reason: "Budget limit exceeds MVP mock policy"
      };
    }

    const reviewRequired = input.files.some((file) => humanReviewPaths.some((prefix) => file.startsWith(prefix)));
    return {
      allowed: true,
      reviewRequired,
      reason: reviewRequired ? "Dangerous path requires human review" : undefined
    };
  }
}
