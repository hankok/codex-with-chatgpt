# Scoped Nested Workspace Design

## Goal

Allow a repository nested under an already-configured parent folder to become the
effective C2C content scope while reusing the parent bridge, connector, domain,
and login/session state.

## Root cause

The parent folder is currently used as both the authorization identity and the
file-operation root. A nested repository therefore shares the parent's project
identity, and a command run for the nested repository cannot find the parent's
persisted endpoint, tunnel, or ChatGPT session by exact workspace id.

## Design

Split workspace identity from content scope:

- `connectionRoot` remains the already-configured parent root and continues to
  own the workspace id, OAuth token store, pairing state, endpoint, tunnel, and
  session.
- `scopeRoot` is the nested repository root and becomes the root for file reads,
  directory listing, search, Git inspection, project detection, and MCP path
  containment.
- A `Workspace` created without an explicit parent keeps its existing behavior.
- When a nested path has no local C2C state, resolution walks ancestors and uses
  the nearest ancestor with persisted connection state. The resolved mapping is
  persisted without secrets so later calls are deterministic.

The MCP response keeps the connection workspace name/id for compatibility with
the existing ChatGPT Project, and adds scoped workspace identity so ChatGPT can
see which repository it is reviewing. The scoped root is always inside the
connection root; `..`, absolute paths, and symlinks cannot escape it.

## Non-goals

- Do not create, delete, or reinstall ChatGPT connectors.
- Do not rotate the named Cloudflare hostname.
- Do not store OAuth, pairing, or Cloudflare credentials in project files.
- Do not make a parent-scoped connector access a sibling repository.

## Verification

Tests must cover ancestor resolution, persisted scope mappings, parent-id reuse,
child-root containment, MCP workspace metadata, and unchanged behavior for an
ordinary unscoped workspace.
