import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeLastEndpoint } from "../src/config/endpoint.js";
import {
  readWorkspaceScope,
  resolveWorkspaceContext,
  workspaceScopeFile,
} from "../src/workspace/context.js";
import { Workspace } from "../src/workspace/manager.js";
import { cleanup, isolateStateDir, makeTmpDir, write } from "./helpers.js";

describe("nested workspace scope", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) cleanup(dir);
    dirs.length = 0;
    delete process.env.C2C_STATE_DIR;
  });

  it("reuses the nearest configured ancestor and persists the child scope", () => {
    dirs.push(isolateStateDir());
    const parent = makeTmpDir("scope-parent");
    const child = path.join(parent, "codex-with-chatgpt");
    fs.mkdirSync(child, { recursive: true });
    dirs.push(parent);
    const parentWorkspace = new Workspace(parent);
    writeLastEndpoint({
      workspaceId: parentWorkspace.id,
      port: 48765,
      publicUrl: "https://c2c-win.lhbuyertech.us",
      mcpUrl: "https://c2c-win.lhbuyertech.us/mcp",
      connectorName: "Codex with ChatGPT · GitHub",
    });

    const context = resolveWorkspaceContext(child);

    expect(context.connectionRoot).toBe(parent);
    expect(context.scopeRoot).toBe(fs.realpathSync.native(child));
    expect(readWorkspaceScope(child)).toMatchObject({
      scopeRoot: fs.realpathSync.native(child),
      connectionRoot: parent,
      connectionWorkspaceId: parentWorkspace.id,
    });
    expect(fs.existsSync(workspaceScopeFile(child))).toBe(true);
  });

  it("keeps the parent authorization identity while enforcing child containment", () => {
    dirs.push(isolateStateDir());
    const parent = makeTmpDir("scope-parent");
    const child = path.join(parent, "repo");
    const sibling = path.join(parent, "sibling");
    fs.mkdirSync(child, { recursive: true });
    fs.mkdirSync(sibling, { recursive: true });
    dirs.push(parent);
    write(child, "package.json", '{"name":"scoped-repo"}\n');
    const scoped = new Workspace(child, { authorizationRoot: parent });
    const parentWorkspace = new Workspace(parent);

    expect(scoped.id).toBe(parentWorkspace.id);
    expect(scoped.scopeId).not.toBe(scoped.id);
    expect(scoped.scopeName).toBe("repo");
    expect(scoped.resolve("package.json").abs).toBe(path.join(scoped.root, "package.json"));
    expect(() => scoped.resolve("../sibling")).toThrow(/outside the connected workspace/i);
  });
});
