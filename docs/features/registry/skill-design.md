# Skill Registry

Skills are reusable task workflows or procedures. Registry v1 seed data includes `jest-test-fixer@1.0.0`, `auth-debugging@1.0.0`, and `conflict-risk-reviewer@1.0.0`.

Tracked metadata:

- name
- version
- description
- status
- approvalStatus
- evalStatus
- owner
- compatibleAgents
- compatibleModels
- requiredTools
- requiredHarnesses
- invocationRules
- instructionRef or instructionBody
- evalRefs
- tags

Skill packages are domain records first. Registry v1 uses exact version refs, repository boundaries, local file-backed storage, DTOs, audit logs, and approval/eval resolver gates. Signed skill bundles can be introduced later.
