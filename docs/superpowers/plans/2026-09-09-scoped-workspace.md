# Scoped Nested Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make a nested repository the effective C2C content workspace while reusing the configured parent connector and connection state.

**Architecture:** Resolve a nested request to a `{ connectionRoot, scopeRoot }` context. Keep the parent workspace id for OAuth, pairing, runtime, tunnel, endpoint, and session state; construct the workspace with the child scope as its path root so all MCP and Git operations remain child-bounded. Persist only non-secret scope metadata.

**Tech Stack:** TypeScript, Node.js filesystem/path APIs, Express bridge, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-09-scoped-workspace-design.md`

## Global Constraints

- Preserve the existing parent connector, named hostname, OAuth tokens, and ChatGPT session.
- Keep the child scope strictly inside the parent connection root.
- Use `apply_patch` for edits and hidden Windows process execution.
- Every production behavior change must have a failing test before implementation.

---

### Task 1: Add persistent nested-scope resolution

**Files:**
- Create: `src/workspace/context.ts`
- Modify: `src/config/paths.ts`
- Test: `tests/workspace-scope.test.ts`

**Interfaces:**
- Produces `WorkspaceContext`, `resolveWorkspaceContext(rootInput)`, and secure scope-state read/write helpers.
- Consumes existing endpoint, tunnel, session, and runtime state readers to identify a configured ancestor.

- [ ] **Step 1: Write failing tests** for nearest configured ancestor selection, persisted scope mapping, exact configured roots, and unrelated roots.
- [ ] **Step 2: Run `pnpm vitest run tests/workspace-scope.test.ts` and verify the new tests fail because the context module does not exist.
- [ ] **Step 3: Implement canonical path hashing, ancestor traversal, state detection, and owner-readable scope JSON under `scopes/`.
- [ ] **Step 4: Run the focused tests and verify they pass.
- [ ] **Step 5: Commit the state/context implementation.

### Task 2: Make Workspace and bridge honor the scoped root

**Files:**
- Modify: `src/workspace/manager.ts`
- Modify: `src/bridge/server.ts`
- Modify: `src/process/daemon.ts`
- Modify: `src/bridge/runtime.ts`
- Test: `tests/workspace-scope.test.ts`
- Test: `tests/runtime.test.ts`

**Interfaces:**
- `Workspace(rootInput, { authorizationRoot })` retains the parent id while using the child root for all path operations.
- `BridgeOptions.authorizationRoot` lets the child-scoped bridge reuse the parent auth/pairing/tunnel state.

- [ ] **Step 1: Add failing tests for parent-id reuse, child project metadata, and rejection of sibling/parent escapes.
- [ ] **Step 2: Run the focused tests and verify the expected failures.
- [ ] **Step 3: Implement the split identity/root model and pass the authorization root through daemon spawning and runtime checks.
- [ ] **Step 4: Run focused bridge/runtime/workspace tests and verify they pass.
- [ ] **Step 5: Commit the bridge scope implementation.

### Task 3: Route CLI and MCP metadata through the context

**Files:**
- Modify: `src/cli/index.ts`
- Modify: `src/mcp/server.ts`
- Modify: `src/process/daemon.ts`
- Test: `tests/cli.test.ts` or the existing CLI-focused test file
- Test: `tests/mcp.test.ts`

**Interfaces:**
- All CLI commands resolve the scoped workspace consistently.
- `workspace_info` exposes connection identity plus `scopeId` and `scopeName`.

- [ ] **Step 1: Add failing CLI/MCP tests proving nested commands reuse the parent endpoint and report the child scope.
- [ ] **Step 2: Run the focused tests and verify the failures.
- [ ] **Step 3: Replace direct `new Workspace(resolveWorkspace(...))` construction with the context-aware factory and preserve parent state lookups.
- [ ] **Step 4: Add scoped metadata to the MCP structured response without exposing absolute paths.
- [ ] **Step 5: Run focused tests and verify they pass.
- [ ] **Step 6: Commit the CLI/MCP integration.

### Task 4: Update workflow documentation and validate the installed bridge

**Files:**
- Modify: `skill/SKILL.md`
- Modify: `README.md`
- Modify: `docs/security.md`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Update the workflow to pass the actual project folder, reuse an ancestor connection, and never recreate the connector for a scope change.
- [ ] **Step 2: Document the stricter child scope and parent connection identity.
- [ ] **Step 3: Run `pnpm test`, `pnpm build`, and `git diff --check`.
- [ ] **Step 4: Record the verification with C2C, inspect the diff through the existing connector, and commit the documentation and final integration.
