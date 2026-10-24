---
trigger: always_on
description: Enforce domain boundaries across parallel worker subagents
---

# Domain Isolation & Code Quality Rules

- **Zero Overwriting Across Domains:** Subagents must only modify files inside their assigned directories.
- **IPC Contract First:** Any new feature must declare its request/response format in `src-tauri/src/models/ipc.rs` and `src/types/ipc.ts` before writing business logic.
- **Idempotent Builds:** Every subagent must ensure its generated code does not break existing unit tests.
- **Non-Destructive Operations:** Do not delete existing modules or configuration files; extend with modular traits and helper files.