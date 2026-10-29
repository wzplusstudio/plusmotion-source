/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { createContext, useContext, type Accessor, type JSX } from 'solid-js';
import { assert } from '@/utils';
import { createStoredSignal } from '@/lib/store';
import { store } from '@/init';

/** Where the toolbar sits over the canvas: one of six slots it snaps to when dragged, along the top and bottom edges. */
export const TOOLBAR_SLOTS = ['bottom', 'top', 'top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

export type ToolbarSlot = (typeof TOOLBAR_SLOTS)[number];

type LayoutContextValue = {
  uiVisible: Accessor<boolean>;
  timelineMinimized: Accessor<boolean>;
  timelineHeight: Accessor<number>;
  setTimelineHeight(height: number): void;
  toolbarSlot: Accessor<ToolbarSlot>;
  setToolbarSlot(slot: ToolbarSlot): void;
  toggleUI(): void;
  toggleTimeline(): void;
  inspectorWidth: Accessor<number>;
  /** The current arrangement, to save or compare. */
  snapshot(): LayoutSnapshot;
  /** Puts the panels where a snapshot says. Values are clamped, so a stale saved layout can never hide the canvas. */
  applyLayout(layout: LayoutSnapshot): void;
  savedLayouts: Accessor<SavedLayout[]>;
  saveLayout(name: string): void;
  deleteLayout(name: string): void;
};

export type LayoutSnapshot = { timelineHeight: number; timelineMinimized: boolean; uiVisible: boolean; inspectorWidth: number; toolbarSlot: ToolbarSlot };
export type SavedLayout = { name: string; layout: LayoutSnapshot };

export const MIN_INSPECTOR_WIDTH = 220;
export const MAX_INSPECTOR_WIDTH = 420;
export const DEFAULT_INSPECTOR_WIDTH = 264;
const MAX_SAVED_LAYOUTS = 12;

/** Ready-made arrangements. They only move panels the editor already has. */
export const BUILT_IN_LAYOUTS: SavedLayout[] = [
  { name: 'Edit', layout: { timelineHeight: 234, timelineMinimized: false, uiVisible: true, inspectorWidth: 264, toolbarSlot: 'bottom' } },
  { name: 'Timing', layout: { timelineHeight: 400, timelineMinimized: false, uiVisible: true, inspectorWidth: 264, toolbarSlot: 'top' } },
  { name: 'Style', layout: { timelineHeight: 160, timelineMinimized: false, uiVisible: true, inspectorWidth: 340, toolbarSlot: 'bottom' } },
  { name: 'Review', layout: { timelineHeight: 234, timelineMinimized: true, uiVisible: true, inspectorWidth: 264, toolbarSlot: 'bottom' } },
  { name: 'Focus', layout: { timelineHeight: 234, timelineMinimized: true, uiVisible: false, inspectorWidth: 264, toolbarSlot: 'bottom' } },
];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
const validSaved = (v: unknown): SavedLayout[] => Array.isArray(v)
  ? v.flatMap((x) => (x && typeof x.name === 'string' && x.layout && typeof x.layout === 'object' ? [{ name: x.name.slice(0, 40), layout: x.layout as LayoutSnapshot }] : [])).slice(0, MAX_SAVED_LAYOUTS)
  : [];

const LayoutContext = createContext<LayoutContextValue>();

export const MIN_TIMELINE_HEIGHT = 120;
export const DEFAULT_TIMELINE_HEIGHT = 234;

export function LayoutProvider(props: { children: JSX.Element }) {
  const [uiVisible, setUiVisible] = createStoredSignal(
    store.define<boolean>('layout.uiVisible', true),
  );

  const [timelineHeight, setTimelineHeight] = createStoredSignal(
    store.define<number>('layout.timelineHeight', DEFAULT_TIMELINE_HEIGHT),
  );
  const [timelineMinimized, setTimelineMinimized] = createStoredSignal(
    store.define<boolean>('layout.timelineMinimized', false),
  );

  const [toolbarSlot, setToolbarSlot] = createStoredSignal(
    store.define<ToolbarSlot>('layout.toolbarSlot', 'bottom', (value) =>
      TOOLBAR_SLOTS.includes(value) ? value : 'bottom',
    ),
  );

  const [inspectorWidth, setInspectorWidth] = createStoredSignal(
    store.define<number>('layout.inspectorWidth', DEFAULT_INSPECTOR_WIDTH, (v) => clamp(v, MIN_INSPECTOR_WIDTH, MAX_INSPECTOR_WIDTH)),
  );
  const [savedLayouts, setSavedLayouts] = createStoredSignal(store.define<SavedLayout[]>('layout.saved', [], validSaved));
  const snapshot = (): LayoutSnapshot => ({ timelineHeight: timelineHeight(), timelineMinimized: timelineMinimized(), uiVisible: uiVisible(), inspectorWidth: inspectorWidth(), toolbarSlot: toolbarSlot() });
  const applyLayout = (l: LayoutSnapshot) => {
    setTimelineHeight(clamp(l.timelineHeight, MIN_TIMELINE_HEIGHT, 900));
    setTimelineMinimized(!!l.timelineMinimized);
    setUiVisible(l.uiVisible !== false);
    setInspectorWidth(clamp(l.inspectorWidth, MIN_INSPECTOR_WIDTH, MAX_INSPECTOR_WIDTH));
    if (TOOLBAR_SLOTS.includes(l.toolbarSlot)) setToolbarSlot(l.toolbarSlot);
  };
  const saveLayout = (name: string) => {
    const n = name.trim().slice(0, 40); if (!n) return;
    setSavedLayouts([...savedLayouts().filter((s) => s.name !== n), { name: n, layout: snapshot() }].slice(-MAX_SAVED_LAYOUTS));
  };
  const deleteLayout = (name: string) => setSavedLayouts(savedLayouts().filter((s) => s.name !== name));

  const toggleUI = () => setUiVisible(!uiVisible());
  const toggleTimeline = () => setTimelineMinimized(!timelineMinimized());

  return (
    <LayoutContext.Provider
      value={{
        uiVisible,
        timelineMinimized,
        timelineHeight,
        setTimelineHeight,
        toolbarSlot,
        setToolbarSlot,
        toggleUI,
        toggleTimeline,
        inspectorWidth,
        snapshot,
        applyLayout,
        savedLayouts,
        saveLayout,
        deleteLayout,
      }}>
      {props.children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const ctx = useContext(LayoutContext);
  assert(ctx, 'useLayout must be used within LayoutProvider');
  return ctx;
}
