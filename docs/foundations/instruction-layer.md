# Instruction Layer

Instruction files such as AGENTS.md, CLAUDE.md, AGENT.md, `.cursorrules`, organization prompts, team prompts, repo rules, directory rules, user preferences, and task prompts are Instruction Artifacts.

They are separate from Harnesses. A Harness defines how instructions are loaded, the runtime, permissions, tools, secret scopes, network mode, and test commands.

Registry-backed instruction selection:

1. Filters to active artifacts.
2. Filters to artifacts with `approvalStatus = not_required | approved`.
3. Filters to artifacts with `evalStatus = not_required | passed`.
4. Excludes artifacts with `checksumStatus = mismatch`.
5. Filters to artifacts applicable to the selected agent.
6. Sorts by numeric precedence and scope order.
7. Creates an assembled hash.
8. Stores an immutable InstructionSet for the TaskRun.

Authority order:

```text
Platform policy
Organization instruction
Team instruction
Harness instruction-loading rule
Repository instruction
Directory instruction
User preference
Skill instruction
Task prompt
```
