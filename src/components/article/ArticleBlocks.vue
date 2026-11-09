<script setup lang="ts">
import { computed, inject } from 'vue'
import type { ABlock } from '@/lib/article'
import { mode, uiLang } from '@/lib/i18n'
import ABlockView from './ABlockView.vue'
import FoldBlock from './FoldBlock.vue'
import SceneInline from '../scenes/SceneInline.vue'
import { SCENE_LAYER } from '@/lib/scene'

/**
 * Renders article blocks in the current reading mode. The two languages share a block skeleton,
 * so parallel view pairs them by index; blocks that are the same in both (a lab, a chapter card, a
 * rule, identical code) are drawn once across both columns.
 *
 * A `::scene` marker is not drawn: the block after it carries `data-scene`, which the page watches
 * to know what the reader has reached. Where the scene sits in the text, it is drawn there too.
 */
const props = defineProps<{ en?: ABlock[]; zh?: ABlock[] }>()
const scene = inject(SCENE_LAYER, null)
const inline = computed(() => scene?.shape.value === 'inline')

const SHARED = new Set(['lab', 'chapter', 'hr'])
const shared = (a: ABlock, b: ABlock | undefined) =>
  !!b && a.t === b.t && (SHARED.has(a.t) || (a.t === 'code' && b.t === 'code' && a.text === b.text))

type Row = ({ kind: 'pair'; en: ABlock; zh?: ABlock } | { kind: 'shared'; b: ABlock } | { kind: 'fold'; en: ABlock & { t: 'fold' | 'aside' }; zh?: ABlock & { t: 'fold' | 'aside' } }) & { scene?: string }

/** Drop the scene markers, handing each one's state to the block that follows it. */
function withScenes<T>(items: T[], blockOf: (x: T) => ABlock): (T & { scene?: string })[] {
  const out: (T & { scene?: string })[] = []
  let pending: string | undefined
  for (const x of items) {
    const b = blockOf(x)
    if (b.t === 'scene') pending = b.state
    else {
      out.push(pending ? { ...x, scene: pending } : (x as T & { scene?: string }))
      pending = undefined
    }
  }
  return out
}

const rows = computed<Row[]>(() => {
  const en = props.en ?? []
  const zh = props.zh ?? []
  const all = en.map((b, i): Row => {
    const z = zh[i]
    if (shared(b, z)) return { kind: 'shared', b }
    if ((b.t === 'fold' || b.t === 'aside') && z?.t === b.t) return { kind: 'fold', en: b, zh: z }
    return { kind: 'pair', en: b, zh: z }
  })
  return withScenes(all, (r) => (r.kind === 'shared' ? r.b : r.en))
})
const single = computed(() => withScenes(((mode.value === 'zh' ? props.zh : props.en) ?? props.en ?? props.zh ?? []).map((b) => ({ b })), (x) => x.b))
const singleLang = computed(() => (mode.value === 'zh' && props.zh ? 'zh' : 'en'))
</script>

<template>
  <div class="ablocks" :class="{ both: mode === 'both', 'zh-first': uiLang === 'zh' }">
    <template v-if="mode === 'both'">
      <template v-for="(r, i) in rows" :key="i">
        <SceneInline v-if="inline && r.scene" :state="r.scene" />
        <div v-if="r.kind === 'shared'" class="wide" :data-scene="r.scene"><ABlockView :block="r.b" lang="en" /></div>
        <FoldBlock v-else-if="r.kind === 'fold'" :en="r.en" :zh="r.zh" :data-scene="r.scene" />
        <div v-else class="pair" :class="{ heading: r.en.t === 'h' }" :data-scene="r.scene">
          <div class="cell" lang="en"><ABlockView :block="r.en" lang="en" /></div>
          <div class="cell" lang="zh"><ABlockView v-if="r.zh" :block="r.zh" lang="zh" /></div>
        </div>
      </template>
    </template>
    <template v-else>
      <template v-for="({ b, scene: at }, i) in single" :key="i">
        <SceneInline v-if="inline && at" :state="at" />
        <FoldBlock v-if="b.t === 'fold' || b.t === 'aside'" v-bind="singleLang === 'zh' ? { zh: b } : { en: b }" :data-scene="at" />
        <div v-else class="one" :class="{ heading: b.t === 'h', wide: b.t === 'lab' }" :lang="singleLang" :data-scene="at">
          <ABlockView :block="b" :lang="singleLang" />
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.ablocks {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.05rem;
  min-width: 0;
}
.pair {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 2.4rem;
  min-width: 0;
}
.cell,
.one,
.wide {
  min-width: 0;
}
.heading {
  margin-top: 1.6rem;
}
.wide {
  margin: 0.6rem 0;
}
@media (max-width: 900px) {
  .pair {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.6rem;
  }
  /* one column: the interface language first, the other below it behind a rule */
  .pair .cell[lang='zh'] {
    padding-left: 12px;
    border-left: 2px solid var(--rule);
  }
  .zh-first .pair .cell[lang='zh'] {
    order: -1;
    padding-left: 0;
    border-left: 0;
  }
  .zh-first .pair .cell[lang='en'] {
    padding-left: 12px;
    border-left: 2px solid var(--rule);
  }
}
</style>
