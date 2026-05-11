# ADR 0001: TypeScript Monorepo

## Status

Accepted

## Context

Aichestra needs shared domain types across API, worker, runner, adapters, persistence, and web dashboard.

## Decision

Use a pnpm TypeScript monorepo with `apps/*` and `packages/*`.

## Consequences

- Domain boundaries are explicit.
- Workspace package imports make contracts visible.
- The MVP can run without generated client code.
- Future external dependencies can be added per package.
