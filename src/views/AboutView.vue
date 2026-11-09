<script setup lang="ts">
import { t } from '@/lib/i18n'

const base = import.meta.env.BASE_URL
</script>

<template>
  <div class="about">
    <h1>{{ t({ en: 'About this edition', zh: '关于本版本' }) }}</h1>
    <section>
      <h2>{{ t({ en: 'Sources', zh: '来源' }) }}</h2>
      <p>
        {{ t({ en: 'English text: Operating Systems: Three Easy Pieces, version 1.10, by Remzi H. Arpaci-Dusseau and Andrea C. Arpaci-Dusseau, from', zh: '英文原文：《Operating Systems: Three Easy Pieces》1.10 版，作者 Remzi H. Arpaci-Dusseau 与 Andrea C. Arpaci-Dusseau，来自' }) }}
        <a href="https://pages.cs.wisc.edu/~remzi/OSTEP/" target="_blank" rel="noopener">pages.cs.wisc.edu/~remzi/OSTEP</a>.
      </p>
      <p>
        {{ t({ en: 'Chinese text: the official translation 《操作系统导论》 (translated by 王海鹏, published by 人民邮电出版社), as linked from', zh: '中文译文：官方译本《操作系统导论》（王海鹏 译，人民邮电出版社），由以下仓库索引：' }) }}
        <a href="https://github.com/iTanken/ostep-chinese" target="_blank" rel="noopener">github.com/iTanken/ostep-chinese</a>.
        {{ t({ en: 'It translates an earlier edition, so some English paragraphs have no Chinese counterpart (and vice versa); they are marked “—” in parallel view.', zh: '它翻译的是较早的版本，所以有些英文段落没有对应的中文（反之亦然）；在对照模式中以“—”标出。' }) }}
      </p>
      <p>
        {{ t({ en: 'Text was extracted from the PDFs automatically (layout analysis of fonts, positions and the grey aside boxes). Some figures are images cropped from the PDFs. If you find an extraction error, the original PDF is linked at the top of each chapter.', zh: '文本由程序自动从 PDF 中提取（基于字体、位置以及灰色旁注框的版面分析）。部分插图是从 PDF 中裁剪出的图片。如果发现提取错误，每章顶部都有原始 PDF 的链接。' }) }}
      </p>
    </section>
    <section>
      <h2>{{ t({ en: 'What is ours', zh: '哪些是我们添加的' }) }}</h2>
      <p>
        {{ t({ en: 'The book text is never edited. Everything we added is visually marked: interactive labs (lab://), field notes connecting chapters to present-day systems, and threads connecting ideas across chapters. All of our writing is provided in both English and Chinese.', zh: '书籍正文从不改动。我们添加的所有内容都有明显标记：交互实验（lab://）、把章节与当今系统联系起来的“现实连线”，以及在章节之间建立联系的“知识串联”。我们写的内容都同时提供中英文。' }) }}
      </p>
    </section>
    <section>
      <h2>{{ t({ en: 'Typefaces', zh: '字体' }) }}</h2>
      <p>
        {{ t({ en: 'Chinese text is set in', zh: '中文使用' }) }}
        <a href="https://github.com/lxgw/975Hei" target="_blank" rel="noopener">{{ t({ en: '975 Hei (LXGW 975 黑体)', zh: '975 黑体' }) }}</a>{{ t({ en: '; English in IBM Plex Sans, IBM Plex Mono and Source Serif 4. All are served from this site under the SIL Open Font License 1.1 (', zh: '；英文使用 IBM Plex Sans、IBM Plex Mono 和 Source Serif 4。这些字体都由本站自行托管，遵循 SIL Open Font License 1.1（' }) }}<a :href="`${base}fonts/licenses/975Hei-OFL.txt`" target="_blank" rel="noopener">975 Hei</a>,
        <a :href="`${base}fonts/licenses/IBM-Plex-OFL.txt`" target="_blank" rel="noopener">Plex</a>,
        <a :href="`${base}fonts/licenses/Source-Serif-OFL.md`" target="_blank" rel="noopener">Source Serif</a>{{ t({ en: ').', zh: '）。' }) }}
      </p>
    </section>
    <section>
      <h2>{{ t({ en: 'Rights', zh: '版权' }) }}</h2>
      <p>
        {{ t({ en: 'The book is © the authors and free to read online; the Chinese translation is © its publisher. This site is a study companion; please respect the authors’ terms before redistributing it, and consider buying the printed book.', zh: '本书版权归作者所有，可免费在线阅读；中文译本版权归出版社所有。本站是学习辅助工具；再次分发前请尊重作者的条款，也欢迎购买纸质书支持作者。' }) }}
      </p>
    </section>
  </div>
</template>

<style scoped>
.about {
  max-width: 44rem;
  margin: 0 auto;
  padding: 56px 24px 96px;
}
h1 {
  font-family: var(--font-serif);
  font-size: 2.4rem;
  margin: 0 0 24px;
}
h2 {
  font-size: 1.05rem;
  margin: 28px 0 8px;
}
p {
  color: var(--ink-2);
  line-height: 1.7;
}
</style>
