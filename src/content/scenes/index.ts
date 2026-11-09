import { defineAsyncComponent, type Component } from 'vue'
import type { Bi } from '@/lib/i18n'

/**
 * Scenes: an article's running figure (see src/lib/scene.ts and docs/scenes.md). The drawing is a
 * component that takes the current `state` and the parts to `lit` up; the text around it lives here.
 *
 * One file per article, named after it (`chrome-processes.ts`), default-exporting a SceneDef; its
 * drawing is `src/components/scenes/<id>/Scene.vue`, loaded when the article is opened.
 */
export interface SceneState {
  title: Bi
  caption: Bi
  /** a mechanism the reader can watch step by step; the drawing takes `demo` and `step` */
  demo?: { label: Bi; steps: Bi[] }
}

export interface SceneSpec {
  /**
   * The drawing takes `state`, `lit` (parts to light up), `lang`, `demo` and `step`, and `band`
   * ([top, bottom] in its own units) to show only those rows, as the inline shape does.
   */
  drawing: Component
  /** height of the drawing in its own units (it is 360 wide) */
  height: number
  /** the rows each state is about, for the inline shape */
  bands: Record<string, [number, number]>
  /** the rows each part of the drawing occupies, to cut the drawing to a term's parts */
  parts: Record<string, [number, number]>
  /** in the order the article reaches them */
  states: Record<string, SceneState>
  /** the parts of the drawing a term lights up; a term not listed is explained under the drawing only */
  terms: Record<string, string[]>
}

/** A scene file's export: everything but the drawing, which is found by the article's id. */
export type SceneDef = Omit<SceneSpec, 'drawing'>

const defs = import.meta.glob<{ default: SceneDef }>(['./*.ts', '!./index.ts'], { eager: true })
const drawings = import.meta.glob<{ default: Component }>('@/components/scenes/*/Scene.vue')
const idOf = (path: string) => path.match(/([\w-]+)(?:\/Scene\.vue|\.ts)$/)![1]
const drawingOf = Object.fromEntries(Object.entries(drawings).map(([path, load]) => [idOf(path), load]))

const SCENES: Record<string, SceneSpec> = Object.fromEntries(
  Object.entries(defs)
    .filter(([path]) => drawingOf[idOf(path)])
    .map(([path, m]) => [idOf(path), { ...m.default, drawing: defineAsyncComponent(drawingOf[idOf(path)]) }]),
)

export const findScene = (articleId: string): SceneSpec | null => SCENES[articleId] ?? null
export const sceneIds = () => Object.keys(SCENES)
