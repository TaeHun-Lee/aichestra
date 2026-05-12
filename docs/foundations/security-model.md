# Security Model

The MVP follows a mock-first security model:

1. Do not store real secrets.
2. Provide `.env.example` only.
3. Disable real providers by default.
4. Keep external integrations behind adapter interfaces.
5. Audit Git writes, MCP calls, LLM calls, and task state changes.
6. Treat instructions as behavioral guidance, not enforcement.
7. Block policy-denied work before workflow execution.
8. Route dangerous path changes to human review.

Dangerous path examples:

```text
.github/workflows/**
infra/**
terraform/**
schema/**
migrations/**
auth/**
payments/**
```

Real integrations must add policy checks, secret retrieval controls, and audit coverage before provider calls are enabled.
