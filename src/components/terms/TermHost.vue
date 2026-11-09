<script setup lang="ts">
import { inject, provide, ref } from 'vue'
import type { Lang } from '@/lib/types'
import { TERM_SCOPE } from '@/lib/terms'
import { SCENE_LAYER } from '@/lib/scene'
import TermCard from './TermCard.vue'

/**
 * Wraps one block of our writing. Where the article's scene has a panel (beside the text or
 * floating over it), a clicked term goes to the scene; otherwise it opens a card right below the block (with its part of the scene,
 * if the article has one), and clicking it again closes the card.
 */
defineProps<{ lang: Lang }>()
const scene = inject(SCENE_LAYER, null)
const trail = ref<string[]>([])
// the scene's panel (beside the text or floating over it) takes the term
const panel = () => scene?.shape.value === 'side' || scene?.shape.value === 'float'
provide(TERM_SCOPE, {
  open: (id) => {
    if (panel()) scene!.open(id)
    else trail.value = trail.value[0] === id ? [] : [id]
  },
  isOpen: (id) => (panel() ? scene!.trail.value[0] === id : trail.value[0] === id),
})
</script>

<template>
  <div class="term-host">
    <slot />
    <TermCard v-if="trail.length" v-model:trail="trail" :lang="lang" />
  </div>
</template>

<style scoped>
.term-host {
  min-width: 0;
}
</style>
