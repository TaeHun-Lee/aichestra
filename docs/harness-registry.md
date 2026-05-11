# Harness Registry

Harnesses define the agent execution environment and permissions. Registry v1 seed data includes `backend-node20@1.0.0`, `frontend-node20@1.0.0`, and `local-git-dry-run@1.0.0`.

Tracked metadata:

- name
- version
- description
- status
- approvalStatus
- evalStatus
- owner
- runtimeType
- runtimeImage
- allowedTools
- allowedMcpServers
- secretScopes
- networkPolicy
- testCommands
- compatibleAgents
- instructionLoadingPolicy

The MVP stores harness metadata as structured records behind registry repository interfaces. YAML parsing, signed harness artifacts, full approval workflow, eval suite execution, and canary rollout are deferred.
