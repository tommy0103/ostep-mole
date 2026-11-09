<script setup lang="ts">
import { computed, inject, provide } from 'vue'
import type { Lang } from '@/lib/types'
import { TERM_SCOPE } from '@/lib/terms'
import { findTerm } from '@/content/glossary'
import TermBody from './TermBody.vue'
import { SCENE_LAYER, bandOf } from '@/lib/scene'

/**
 * One glossary card. `trail` is the path of terms followed so far (BPF › system call › trap): a term
 * inside the card opens here, one step deeper, and the trail leads back. However far a reader
 * digs, there is only ever one card on screen.
 */
const props = defineProps<{ lang: Lang }>()
const trail = defineModel<string[]>('trail', { required: true })

const id = computed(() => trail.value[trail.value.length - 1])
const term = computed(() => findTerm(id.value))
// in an article whose scene sits in the text, the card shows the term's part of the drawing
const scene = inject(SCENE_LAYER, null)
const figure = computed(() => {
  const spec = scene?.shape.value === 'inline' ? scene.spec.value : null
  const parts = spec?.terms[id.value]
  return spec && parts ? { spec, parts, band: bandOf(spec, parts) } : null
})
const zh = computed(() => props.lang === 'zh')

provide(TERM_SCOPE, {
  open: (next) => {
    const at = trail.value.indexOf(next)
    trail.value = at >= 0 ? trail.value.slice(0, at + 1) : [...trail.value, next]
  },
  isOpen: (t) => trail.value.includes(t),
})
const back = (i: number) => (trail.value = trail.value.slice(0, i + 1))
const close = () => (trail.value = [])
const label = (t: string) => findTerm(t)?.title[props.lang].replace(/[（(].*$/, '').trim() ?? t
</script>

<template>
  <aside v-if="term" class="term-card" :lang="lang" @keydown.esc="close">
    <div class="top mono">
      <nav v-if="trail.length > 1" class="trail" :aria-label="zh ? '术语路径' : 'term path'">
        <template v-for="(t, i) in trail" :key="t">
          <button v-if="i < trail.length - 1" type="button" class="step" @click="back(i)">{{ label(t) }}</button>
          <span v-else class="step here">{{ label(t) }}</span>
          <span v-if="i < trail.length - 1" class="sep" aria-hidden="true">›</span>
        </template>
      </nav>
      <span v-else class="kicker">{{ zh ? '术语' : 'term' }}</span>
      <button type="button" class="close" :aria-label="zh ? '收起' : 'close'" @click="close">×</button>
    </div>
    <component
      :is="figure.spec.drawing"
      v-if="figure && scene"
      :key="'fig-' + id"
      class="figure"
      :state="scene.state.value"
      :lit="figure.parts"
      :lang="lang"
      :band="figure.band"
    />
    <TermBody :key="id" class="content" :id="id" :lang="lang" />
  </aside>
</template>

<style scoped>
.term-card {
  margin: 12px 0 4px;
  padding: 10px 14px 12px 16px;
  border: 1px solid var(--rule);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius);
  background: var(--bg-elev);
  font-size: 0.92rem;
  line-height: 1.7;
  animation: term-in 0.18s ease-out;
}
.term-card:lang(zh) {
  font-family: var(--font-zh);
}
.top {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 11.5px;
  color: var(--muted);
}
.kicker {
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.trail {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 6px;
  min-width: 0;
}
.step {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
}
button.step {
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}
button.step:hover {
  color: var(--accent-ink);
}
.step.here {
  color: var(--ink);
}
.sep {
  color: var(--faint);
}
.close {
  margin-left: auto;
  padding: 0 2px;
  border: 0;
  background: none;
  color: var(--muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.close:hover {
  color: var(--ink);
}
.figure {
  display: block;
  width: 100%;
  max-width: 420px;
  margin: 6px auto 2px;
}
.content {
  margin-top: 4px;
  animation: term-in 0.18s ease-out;
}
@keyframes term-in {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .term-card,
  .content {
    animation: none;
  }
}
</style>
