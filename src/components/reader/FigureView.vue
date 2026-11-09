<script setup lang="ts">
import { ref } from 'vue'
import type { FigureBlock, Lang } from '@/lib/types'
import { figUrl } from '@/content/loader'
import RunsText from './RunsText.vue'
import CodeBlock from './CodeBlock.vue'

const props = defineProps<{ fig: FigureBlock; lang: Lang }>()
const zoomed = ref(false)
// the English book numbers tables as figures; the Chinese edition distinguishes 图 and 表
const label = () => (props.lang === 'en' ? 'Figure' : (props.fig.label ?? '图'))
</script>

<template>
  <figure class="fig" :class="{ table: fig.kind === 'table' || fig.table }">
    <div v-if="fig.img" class="img-wrap fig-img" :class="{ zoomed }" @click="zoomed = !zoomed">
      <img :src="figUrl(lang, fig.img)" :alt="fig.caption.map((r) => r.t).join('')" loading="lazy" />
    </div>
    <CodeBlock v-else-if="fig.code" :code="fig.code" />
    <div v-else-if="fig.table" class="tbl-wrap">
      <table>
        <tbody>
          <tr v-for="(row, i) in fig.table" :key="i" :class="{ head: i === 0 }">
            <td v-for="(cell, j) in row" :key="j"><RunsText :runs="cell" /></td>
          </tr>
        </tbody>
      </table>
    </div>
    <figcaption v-if="fig.num || fig.caption.length">
      <span v-if="fig.num" class="num">{{ label() }} {{ fig.num }}<template v-if="fig.cont">{{ lang === 'en' ? ' (cont.)' : '（续）' }}</template></span>
      <RunsText :runs="fig.caption" />
    </figcaption>
  </figure>
</template>

<style scoped>
.fig {
  margin: 0;
}
.img-wrap {
  display: flex;
  justify-content: center;
  padding: 14px;
  background: #fff;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  cursor: zoom-in;
}
.img-wrap img {
  max-height: 420px;
  width: auto;
  object-fit: contain;
}
.img-wrap.zoomed {
  cursor: zoom-out;
}
.img-wrap.zoomed img {
  max-height: none;
}
/* tables kept as pictures (multi-line cells) are read, not glanced at: no height cap */
.fig.table .img-wrap img {
  max-height: none;
}
.tbl-wrap {
  overflow-x: auto;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--bg-elev);
}
table {
  border-collapse: collapse;
  width: 100%;
  font-family: var(--font-mono);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}
td {
  padding: 4px 10px;
  border-bottom: 1px solid var(--rule);
  white-space: nowrap;
}
tr:last-child td {
  border-bottom: 0;
}
tr.head td {
  font-weight: 600;
  color: var(--ink);
  background: var(--bg-sunk);
}
figcaption {
  margin-top: 8px;
  font-family: var(--font-sans);
  font-size: 13.5px;
  color: var(--ink-2);
  text-align: center;
}
figcaption .num {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--accent-ink);
  margin-right: 8px;
  letter-spacing: 0.02em;
}
</style>
