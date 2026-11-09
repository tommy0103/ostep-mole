<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { loadArticle } from '@/content/articles'
import type { Article } from '@/lib/article'
import { t, UI } from '@/lib/i18n'
import ArticleBlocks from './ArticleBlocks.vue'

/** Both language versions of an article, rendered in the current reading mode. */
const props = defineProps<{ id: string }>()
const en = shallowRef<Article | null>(null)
const zh = shallowRef<Article | null>(null)
const error = shallowRef('')
const emit = defineEmits<{ loaded: [en: Article, zh: Article] }>()

watch(
  () => props.id,
  async (id) => {
    try {
      const [e, z] = await Promise.all([loadArticle(id, 'en'), loadArticle(id, 'zh')])
      en.value = e
      zh.value = z
      emit('loaded', e, z)
    } catch (e) {
      error.value = String(e)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="error" class="muted">{{ error }}</div>
  <div v-else-if="!en || !zh" class="muted mono loading">{{ t(UI.loading) }}</div>
  <ArticleBlocks v-else :en="en.blocks" :zh="zh.blocks" />
</template>

<style scoped>
.loading {
  font-size: 12px;
  padding: 12px 0;
}
</style>
