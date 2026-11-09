<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { SCENE_LAYER } from '@/lib/scene'
import ScenePanel from './ScenePanel.vue'

/**
 * The scene where there is no room for a column: drawn into the text where `state` begins, cut to
 * the rows that state is about, so it and the paragraphs about it are on screen together. Its demo
 * plays on the whole screen and returns the reader to the same place.
 */
const props = defineProps<{ state: string }>()
const layer = inject(SCENE_LAYER)!
const spec = computed(() => layer.spec.value!)
const s = computed(() => spec.value.states[props.state])
const zh = computed(() => layer.lang.value === 'zh')

const playing = ref(false)
const watchDemo = () => (playing.value = true)
// the page stays put under the demo
watch(playing, (on) => (document.body.style.overflow = on ? 'hidden' : ''))
</script>

<template>
  <figure v-if="s" class="scene-inline" :lang="layer.lang.value">
    <figcaption class="head">
      <span class="kicker mono">{{ zh ? '图景' : 'scene' }}</span>
      <span class="title">{{ s.title[layer.lang.value] }}</span>
    </figcaption>
    <component :is="spec.drawing" :state="state" :lit="[]" :lang="layer.lang.value" :band="spec.bands[state]" class="drawing" />
    <p v-for="l in layer.langs.value" :key="l" class="caption" :lang="l">{{ s.caption[l] }}</p>
    <button v-if="s.demo" type="button" class="watch" @click="watchDemo">
      <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M3 2l7 4-7 4z" fill="currentColor" /></svg>
      {{ zh ? '看它怎么发生' : 'Watch how it works' }}<span class="mono">· {{ s.demo.steps.length }} {{ zh ? '步' : 'steps' }}</span>
    </button>
    <Teleport to="body">
      <ScenePanel v-if="playing" overlay :state="state" @close="playing = false" />
    </Teleport>
  </figure>
</template>

<style scoped>
.scene-inline {
  margin: 0.4rem 0;
  padding: 12px 14px 14px;
  display: grid;
  gap: 8px;
  border: 1px solid var(--rule);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius);
  background: var(--bg-elev);
}
.scene-inline:lang(zh),
.scene-inline [lang='zh'] {
  font-family: var(--font-zh);
}
.head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.kicker {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent-ink);
}
.title {
  font-weight: 600;
}
.drawing {
  justify-self: center;
  width: 100%;
  max-width: 420px;
}
.caption {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.68;
  color: var(--ink-2);
}
.watch {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: 1px solid var(--accent);
  border-radius: 99px;
  background: var(--accent-soft);
  color: var(--accent-ink);
  font-size: 0.85rem;
  cursor: pointer;
}
.watch .mono {
  font-size: 11px;
  opacity: 0.75;
}
</style>
