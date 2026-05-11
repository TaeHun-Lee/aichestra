# ADR 0002: Mock-First Adapters

## Status

Accepted

## Context

The MVP must not call real LLM, Git, MCP, secret, Kubernetes, or Temporal systems.

## Decision

Define adapter interfaces in `packages/adapters` and provide local mock implementations.

## Consequences

- Tests are deterministic.
- No provider credentials are required.
- Real integrations can be added without changing domain models.
- Provider enablement must be explicit and audited.
