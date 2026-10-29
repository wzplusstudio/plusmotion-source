/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The Node side, in one call: `startAgentHost(config)` hydrates the
// environment, opens the store, wires the harnesses and listens. Electron
// runs this in a utility process, a sandbox runs it under plain `node`;
// neither is imported here.

import { hydrateEnv } from "./env";
import { AgentHost } from "./host";
import { ClaudeHarness } from "./claude";
import { CodexHarness } from "./codex";
import { ANTHROPIC, ApiHarness, OPENAI, QWEN } from "./api";
import { createPlusMotionBridge } from "./plusmotion-bridge";
import { DEFAULT_ORIGINS, startServer } from "./server";
import { ChatStore } from "./store";

import type { ApiProviderId } from "./api";
import type { Harness, McpConfig } from "./harness";
import type { PlusMotionConfig } from "./plusmotion-bridge";

export type AgentHostConfig = {
  /** default "127.0.0.1" */
  host?: string;
  /** default 0 (random) */
  port?: number;
  /** required; 32 random bytes, base64url */
  token: string;
  /** chat storage root */
  dataDir: string;
  /** default: file://, null, http://localhost:5173 */
  allowedOrigins?: string[];
  /** injected into every session */
  mcp: McpConfig | null;
  /** appended to each harness's system/developer prompt */
  instructions?: string;
  version: string;
  /** Where uploaded attachments are written; default a folder in the system temp dir. */
  uploadDir?: string;
  /** PlusMotion's library and data folders; with them chats can use the agent team and project tools. */
  plusmotion?: PlusMotionConfig;
  /** Where the optional Claude Code plugin (the Agent SDK) is installed, if it is. */
  pluginDir?: string;
  /** API keys for the OpenAI, Qwen and Claude connections. Sent by the app over its private channel, never argv. */
  credentials?: Partial<Record<ApiProviderId, string>>;
  /** For tests: replaces the real harnesses. */
  harnesses?: Harness[];
  log?: (message: string) => void;
};

export type RunningAgentHost = {
  url: string;
  port: number;
  deleteChats(projectId: string): Promise<void>;
  /** Replaces the API keys and re-probes, so a key added in Connections shows up without a restart. */
  setCredentials(keys: Partial<Record<ApiProviderId, string>>): void;
  stop(): Promise<void>;
};

export async function createAgentHost(config: AgentHostConfig): Promise<RunningAgentHost> {
  if (!config.token) throw new Error("agent host: a token is required");
  const log = config.log ?? ((message: string) => console.error(`[agent-chat] ${message}`));
  const env = hydrateEnv();
  const store = new ChatStore(config.dataDir);
  let keys = { ...config.credentials };
  const bridge = config.plusmotion ? createPlusMotionBridge(config.plusmotion) : null;
  const api = { keys: (id: ApiProviderId) => keys[id] ?? null, toolbox: bridge ? bridge.toolbox : undefined };
  const agentHost = new AgentHost({
    store,
    agents: bridge?.agents,
    harnesses: config.harnesses ?? [new ClaudeHarness(config.version, config.pluginDir), new CodexHarness(), new ApiHarness(OPENAI, api), new ApiHarness(QWEN, api), new ApiHarness(ANTHROPIC, api)],
    env,
    mcp: config.mcp,
    instructions: config.instructions,
    version: config.version,
    uploadDir: config.uploadDir,
    log,
  });
  await agentHost.start();
  const server = await startServer({
    host: config.host ?? "127.0.0.1",
    port: config.port ?? 0,
    token: config.token,
    allowedOrigins: config.allowedOrigins ?? DEFAULT_ORIGINS,
    agentHost,
    log,
  });
  return {
    url: server.url,
    port: server.port,
    deleteChats(projectId) {
      return agentHost.deleteChats(projectId);
    },
    setCredentials(next) {
      keys = { ...next };
      agentHost.refreshHarnesses();
    },
    async stop() {
      await agentHost.stop();
      await server.close();
    },
  };
}

export { AgentHost, HostError } from "./host";
export { ChatStore } from "./store";
export { FakeHarness } from "./fake";
export { ClaudeHarness } from "./claude";
export { CodexHarness } from "./codex";
export { ApiHarness, OPENAI, QWEN, ANTHROPIC } from "./api";
export { hydrateEnv, inheritedEnv, which, resolveBinary, killTree } from "./env";
export type { Harness, HarnessSession, McpConfig, ResumeCursor, OpenOptions } from "./harness";
export type { HostEnv } from "./env";
