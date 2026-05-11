# ADR 0003: Instruction Layer Separation

## Status

Accepted

## Context

Agent instruction files and runtime harnesses are often conflated, which makes behavior difficult to audit.

## Decision

Represent AGENTS.md, CLAUDE.md, repo rules, user preferences, skill instructions, and task prompts as Instruction Artifacts. Keep Harness Packages focused on runtime, permissions, tools, network, secrets, and loading behavior.

## Consequences

- Instruction precedence is auditable.
- Runtime permissions are not hidden in prompt text.
- Policy enforcement remains outside the instruction layer.
