<script setup lang="ts">
import { computed } from 'vue'
import { highlight } from '@/lib/highlight'

const props = defineProps<{ code: string }>()
const toks = computed(() => highlight(props.code.replace(/\s+$/, '')))
</script>

<template>
  <pre class="code"><code><span v-for="(t, i) in toks" :key="i" :class="t.c && 'tk-' + t.c">{{ t.t }}</span></code></pre>
</template>

<style scoped>
.code {
  margin: 0;
  padding: 14px 16px;
  background: var(--code-bg);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  font-size: 13px;
  line-height: 1.55;
  overflow-x: auto;
  tab-size: 4;
  color: var(--ink);
}
.tk-com {
  color: var(--muted);
  font-style: italic;
}
.tk-str {
  color: var(--ok);
}
.tk-kw {
  color: var(--accent-ink);
  font-weight: 500;
}
.tk-ty {
  color: var(--p3);
}
.tk-num {
  color: var(--p1);
}
.tk-pp {
  color: var(--p4);
}
.tk-fn {
  color: var(--ink);
  font-weight: 500;
}
.tk-prompt {
  color: var(--muted);
  user-select: none;
}
</style>
