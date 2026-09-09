import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { readLastEndpoint } from "../config/endpoint.js";
import { getStateDir, readJsonIfExists, writeSecureJson } from "../config/paths.js";
import { readSession } from "../session/state.js";
import { readRuntimeState } from "../bridge/runtime.js";
import { readTunnelState } from "../tunnel/state.js";

export interface WorkspaceContext {
  connectionRoot: string;
  scopeRoot: string;
  connectionWorkspaceId: string;
  scopeId: string;
  persisted: boolean;
}

export interface WorkspaceScopeState {
  scopeRoot: string;
  connectionRoot: string;
  connectionWorkspaceId: string;
  updatedAt: string;
}

function normalizeCase(value: string): string {
  return process.platform === "win32" || process.platform === "darwin" ? value.toLowerCase() : value;
}

function canonicalDirectory(input: string): string {
  const resolved = path.resolve(input);
  const real = fs.realpathSync.native(resolved);
  if (!fs.statSync(real).isDirectory()) throw new Error(`Workspace root is not a directory: ${input}`);
  return real;
}

function contains(parent: string, child: string): boolean {
  const p = normalizeCase(parent);
  const c = normalizeCase(child);
  return c === p || c.startsWith(p + path.sep);
}

export function workspaceIdForRoot(root: string): string {
  return createHash("sha256").update(normalizeCase(canonicalDirectory(root))).digest("hex").slice(0, 12);
}

export function workspaceScopeFile(scopeRoot: string): string {
  return path.join(getStateDir(), "scopes", `${workspaceIdForRoot(scopeRoot)}.json`);
}

export function readWorkspaceScope(scopeRoot: string): WorkspaceScopeState | null {
  const requestedScope = canonicalDirectory(scopeRoot);
  const raw = readJsonIfExists<WorkspaceScopeState>(workspaceScopeFile(requestedScope));
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.scopeRoot !== "string" || typeof raw.connectionRoot !== "string") return null;
  try {
    const savedScope = canonicalDirectory(raw.scopeRoot);
    const connectionRoot = canonicalDirectory(raw.connectionRoot);
    const connectionWorkspaceId = workspaceIdForRoot(connectionRoot);
    if (normalizeCase(savedScope) !== normalizeCase(requestedScope)) return null;
    if (!contains(connectionRoot, savedScope)) return null;
    if (raw.connectionWorkspaceId !== connectionWorkspaceId) return null;
    return {
      scopeRoot: savedScope,
      connectionRoot,
      connectionWorkspaceId,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeWorkspaceScope(scopeRoot: string, connectionRoot: string): WorkspaceScopeState {
  const savedScope = canonicalDirectory(scopeRoot);
  const savedConnectionRoot = canonicalDirectory(connectionRoot);
  if (!contains(savedConnectionRoot, savedScope)) {
    throw new Error("Scoped workspace must be inside the connection workspace");
  }
  const state: WorkspaceScopeState = {
    scopeRoot: savedScope,
    connectionRoot: savedConnectionRoot,
    connectionWorkspaceId: workspaceIdForRoot(savedConnectionRoot),
    updatedAt: new Date().toISOString(),
  };
  writeSecureJson(workspaceScopeFile(savedScope), state);
  return state;
}

function hasConnectionState(root: string): boolean {
  const workspaceId = workspaceIdForRoot(root);
  const tunnel = readTunnelState(workspaceId);
  return Boolean(
    readLastEndpoint(workspaceId) ||
      readSession(workspaceId) ||
      readRuntimeState(workspaceId) ||
      tunnel.preference !== "unset" ||
      tunnel.askedAt
  );
}

function ancestors(start: string): string[] {
  const found: string[] = [];
  let current = start;
  for (;;) {
    found.push(current);
    const parent = path.dirname(current);
    if (parent === current) return found;
    current = parent;
  }
}

export function resolveWorkspaceContext(rootInput: string): WorkspaceContext {
  const scopeRoot = canonicalDirectory(rootInput);
  const saved = readWorkspaceScope(scopeRoot);
  if (saved) {
    return { ...saved, scopeId: workspaceIdForRoot(scopeRoot), persisted: true };
  }

  const configuredAncestor = ancestors(scopeRoot).find((candidate) => candidate !== scopeRoot && hasConnectionState(candidate));
  const connectionRoot = configuredAncestor ?? scopeRoot;
  const connectionWorkspaceId = workspaceIdForRoot(connectionRoot);
  const persisted = connectionRoot !== scopeRoot;
  if (persisted) writeWorkspaceScope(scopeRoot, connectionRoot);
  return {
    connectionRoot,
    scopeRoot,
    connectionWorkspaceId,
    scopeId: workspaceIdForRoot(scopeRoot),
    persisted,
  };
}
