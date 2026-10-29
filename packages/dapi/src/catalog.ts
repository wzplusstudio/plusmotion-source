/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import type { z } from "zod";
import type { GenericTool } from "./tool";

import { open } from "./tools/open";
import { context } from "./tools/context";
import { capture } from "./tools/capture";
import { check } from "./tools/check";
import { exportScene } from "./tools/export";
import { logs } from "./tools/logs";
import { screenshot } from "./tools/screenshot";
import { probe } from "./tools/probe";
import { grab } from "./tools/grab";
import { transcribe } from "./tools/transcribe";
import { filmstrip } from "./tools/filmstrip";
import { waveform } from "./tools/waveform";
import { listen } from "./tools/listen";
import { generate, job } from "./tools/generate";
import { fonts } from "./tools/fonts";
import { report } from "./tools/report";
import { appWindow } from "./tools/window";

/**
 * Every tool, in the order a listing shows them: the project loop first
 * (open, look, capture, check, export), then media inspection, then
 * generation, then the app and machine utilities.
 */
export const catalog = [
  open,
  context,
  capture,
  check,
  exportScene,
  probe,
  grab,
  transcribe,
  filmstrip,
  waveform,
  listen,
  generate,
  job,
  logs,
  screenshot,
  appWindow,
  fonts,
  report,
] as const;

export type AnyTool = (typeof catalog)[number];
export type ToolName = AnyTool["name"];
export type ToolByName<N extends ToolName> = Extract<AnyTool, { name: N }>;

/** What a caller sends: times as strings or numbers, defaults omitted. */
export type ToolInput<N extends ToolName> = z.input<ToolByName<N>["input"]>;
/** What a handler receives: parsed, defaults applied. */
export type ToolArgs<N extends ToolName> = z.output<ToolByName<N>["input"]>;
/** What a caller receives: the tool's structured content. */
export type ToolOutput<N extends ToolName> = z.output<ToolByName<N>["output"]>;
/** What a handler returns; the output, unless the tool declares a `result`. */
export type ToolResult<N extends ToolName> = ToolByName<N> extends { result?: infer R }
  ? R extends z.ZodType
    ? z.output<R>
    : ToolOutput<N>
  : ToolOutput<N>;

const byName = new Map<string, AnyTool>(catalog.map((tool) => [tool.name, tool]));

export function toolByName<N extends ToolName>(name: N): ToolByName<N> {
  return byName.get(name) as ToolByName<N>;
}

export function isToolName(name: string): name is ToolName {
  return byName.has(name);
}

/**
 * PlusMotion does not offer these to agents or the CLI: `report` files a public issue on upstream's repository, and
 * the others call Diffusion Studio's hosted API, which does not exist for PlusMotion. The tools stay defined so the
 * upstream code that names them keeps compiling; they are just not served.
 */
const NOT_SERVED: ReadonlySet<string> = new Set(["report", "generate", "job", "listen", "transcribe"]);

/** The tools served to agents and the CLI: the catalog with each tool's specifics erased, minus `NOT_SERVED`. */
export const tools: readonly GenericTool[] = catalog.filter((tool) => !NOT_SERVED.has(tool.name));
