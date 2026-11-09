<script setup lang="ts">
import { PARTS } from '@/content/book'
import { mode, t, type Bi } from '@/lib/i18n'

const MOTIF: Record<string, Bi> = {
  virtualization: { en: 'illusion · time slices · address spaces', zh: '假象 · 时间片 · 地址空间' },
  concurrency: { en: 'interleavings · locks · condition variables', zh: '交错执行 · 锁 · 条件变量' },
  persistence: { en: 'blocks · journals · crash consistency', zh: '块 · 日志 · 崩溃一致性' },
}
</script>

<template>
  <div class="home">
    <section class="cover">
      <div class="eyebrow mono">Remzi H. Arpaci-Dusseau · Andrea C. Arpaci-Dusseau</div>
      <h1>
        <span v-if="mode !== 'zh'" lang="en">Operating Systems: <em>Three Easy Pieces</em></span>
        <span v-if="mode !== 'en'" lang="zh" class="zh">操作系统导论</span>
      </h1>
      <p class="lede">
        {{
          t({
            en: 'A living, bilingual web edition: the original English text and the official Chinese translation side by side, with interactive labs that let you run the ideas — and notes that connect them to the systems you use today.',
            zh: '一个活的、双语的网页版：英文原文与官方中文译本并排对照，配上可以亲手运行的交互实验，以及把书中思想与当今真实系统连接起来的笔记。',
          })
        }}
      </p>
    </section>

    <section class="parts">
      <RouterLink v-for="p in PARTS" :key="p.id" :to="`/${p.id}`" class="part-card" :class="{ soon: !p.ready }" :data-part="p.id">
        <div class="motif" aria-hidden="true">
          <svg v-if="p.id === 'virtualization'" viewBox="0 0 120 40"><rect v-for="i in 12" :key="i" :x="(i - 1) * 10" y="8" width="9" height="24" :fill="`var(--p${(i - 1) % 3})`" :opacity="0.85" /></svg>
          <svg v-else-if="p.id === 'concurrency'" viewBox="0 0 120 40"><path v-for="i in 3" :key="i" :d="`M0 ${6 + i * 8} ${[...Array(12)].map((_, k) => `L${k * 10 + 10} ${6 + i * 8 + ((k + i) % 2 ? 3 : -3)}`).join(' ')}`" fill="none" stroke="var(--accent)" stroke-width="1.6" :opacity="0.4 + i * 0.2" /></svg>
          <svg v-else viewBox="0 0 120 40"><rect v-for="i in 24" :key="i" :x="((i - 1) % 12) * 10" :y="((i - 1) >= 12 ? 21 : 6)" width="9" height="13" :fill="(i * 7) % 5 < 2 ? 'var(--accent)' : 'var(--rule-strong)'" /></svg>
        </div>
        <div class="num mono">PART {{ p.numeral }}</div>
        <h2>
          <span v-if="mode !== 'zh'" lang="en">{{ p.title.en }}</span>
          <span v-if="mode !== 'en'" lang="zh" class="zh">{{ p.title.zh }}</span>
        </h2>
        <p>{{ t(p.tagline) }}</p>
        <div class="foot mono">{{ p.ready ? t(MOTIF[p.id]) : t({ en: 'in preparation', zh: '筹备中' }) }}</div>
      </RouterLink>
    </section>

    <section class="how">
      <h3 class="mono">{{ t({ en: 'how to read this edition', zh: '如何阅读这个版本' }) }}</h3>
      <div class="how-grid">
        <div>
          <b class="mono">EN · 中</b>
          <p>{{ t({ en: 'Switch between English, Chinese, or both side by side (top right). Paragraphs are aligned automatically.', zh: '在英文、中文或双语对照之间切换（右上角）。段落会自动对齐。' }) }}</p>
        </div>
        <div>
          <b class="mono">译 / EN</b>
          <p>{{ t({ en: 'Reading one language? Hover a paragraph and click the small tag in the margin to peek at its counterpart.', zh: '只读一种语言？把鼠标移到段落上，点击页边的小标签即可查看对应的原文或译文。' }) }}</p>
        </div>
        <div>
          <b class="mono">lab://</b>
          <p>{{ t({ en: 'Interactive labs re-run the book’s examples. Every simulator is tested against the numbers in the text.', zh: '交互实验重现书中的例子。每个模拟器都用书中给出的数字做过测试。' }) }}</p>
        </div>
        <div>
          <b class="mono">◎ / ⋔</b>
          <p>{{ t({ en: 'Field notes link a chapter to real systems (Linux, Kubernetes, LLM serving…); threads link ideas across chapters.', zh: '“现实连线”把章节与真实系统（Linux、Kubernetes、大模型推理……）联系起来；“知识串联”把不同章节的思想连在一起。' }) }}</p>
        </div>
      </div>
      <p class="credits">
        {{ t({ en: 'Book text © Remzi and Andrea Arpaci-Dusseau, freely available at ', zh: '书籍内容 © Remzi 与 Andrea Arpaci-Dusseau，可在 ' }) }}<a href="https://pages.cs.wisc.edu/~remzi/OSTEP/" target="_blank" rel="noopener">ostep.org</a>{{ t({ en: '. Chinese translation: the official edition (人民邮电出版社), as linked from ', zh: ' 免费阅读。中文译文：官方中文版（人民邮电出版社），出自 ' }) }}<a href="https://github.com/iTanken/ostep-chinese" target="_blank" rel="noopener">iTanken/ostep-chinese</a>.
        <RouterLink to="/about">{{ t({ en: 'About this edition →', zh: '关于本版本 →' }) }}</RouterLink>
      </p>
    </section>
  </div>
</template>

<style scoped>
.home {
  max-width: 1080px;
  margin: 0 auto;
  padding: 72px 24px 96px;
}
.eyebrow {
  font-size: 12px;
  color: var(--muted);
  letter-spacing: 0.04em;
}
h1 {
  margin: 14px 0 0;
  display: grid;
  gap: 6px;
  font-family: var(--font-serif);
  font-weight: 600;
  font-size: clamp(2.3rem, 5.4vw, 3.8rem);
  line-height: 1.08;
  letter-spacing: -0.025em;
}
h1 em {
  font-style: italic;
  font-weight: 400;
}
h1 .zh {
  font-family: var(--font-zh);
  font-size: 0.72em;
  color: var(--ink-2);
  letter-spacing: 0.04em;
}
.lede {
  max-width: 42rem;
  font-size: 1.15rem;
  line-height: 1.65;
  color: var(--ink-2);
  margin: 20px 0 0;
}
.parts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 18px;
  margin-top: 56px;
}
.part-card {
  display: grid;
  gap: 8px;
  align-content: start;
  padding: 20px;
  border: 1px solid var(--rule-strong);
  border-radius: 10px;
  background: var(--bg-elev);
  text-decoration: none;
  color: var(--ink);
  transition: transform 0.2s var(--ease), border-color 0.2s;
}
.part-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
}
.part-card.soon {
  background: transparent;
  border-style: dashed;
}
.part-card.soon .motif {
  opacity: 0.45;
}
.motif svg {
  width: 120px;
  height: 40px;
}
.num {
  font-size: 11px;
  letter-spacing: 0.14em;
  color: var(--accent-ink);
}
h2 {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  align-items: baseline;
  font-family: var(--font-serif);
  font-size: 1.6rem;
  font-weight: 600;
}
h2 .zh {
  font-family: var(--font-zh);
  font-size: 0.75em;
  color: var(--ink-2);
}
.part-card p {
  margin: 0;
  color: var(--ink-2);
  font-size: 0.98rem;
}
.foot {
  margin-top: 6px;
  font-size: 11px;
  color: var(--muted);
}
.how {
  margin-top: 64px;
  padding-top: 28px;
  border-top: 1px solid var(--rule);
}
h3 {
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 0 16px;
}
.how-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 22px;
}
.how-grid b {
  font-size: 13px;
  color: var(--accent-ink);
  font-weight: 500;
}
.how-grid p {
  margin: 6px 0 0;
  font-size: 14px;
  color: var(--ink-2);
}
.credits {
  margin-top: 36px;
  font-size: 13px;
  color: var(--muted);
}
</style>
