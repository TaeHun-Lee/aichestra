# MVP

See `docs/foundations/mvp-scope.md` for the detailed MVP scope.

The first working vertical slice is:

```text
User creates a task
-> API triggers worker run
-> system selects mock model, mock harness, mock skill, and instruction set
-> worker creates mock branch
-> mock agent run produces changed files and a diff summary
-> mock tests pass
-> mock PR is created
-> usage ledger records cost
-> task reaches completed
-> web dashboard shows task status, mock PR, diff summary, and mock cost
```
