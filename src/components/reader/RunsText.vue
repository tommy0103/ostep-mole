<script lang="ts">
import { defineComponent, h, inject, type PropType, type VNodeChild } from 'vue'
import { RouterLink } from 'vue-router'
import type { Run } from '@/lib/types'
import { TERM_SCOPE, type TermScope } from '@/lib/terms'

const TAG: Partial<Record<Run['s'], string>> = { b: 'strong', i: 'em', c: 'code', sup: 'sup', sub: 'sub' }

/**
 * A styled run; a run with `href` is the same thing wrapped in a link (internal links use the
 * router), and a glossary term is wrapped in a button that unfolds its card (where a scope exists).
 */
function run(r: Run, scope: TermScope | null): VNodeChild {
  const tag = TAG[r.s]
  const inner = tag ? h(tag, r.s === 'c' ? { class: 'inline' } : null, r.t) : r.t
  if (r.term && scope) {
    const id = r.term
    return h('button', { type: 'button', class: ['term', { on: scope.isOpen(id) }], 'aria-expanded': scope.isOpen(id), onClick: () => scope.open(id) }, [inner])
  }
  if (!r.href) return inner
  if (r.href.startsWith('/')) return h(RouterLink, { to: r.href }, () => inner)
  return h('a', { href: r.href, target: '_blank', rel: 'noopener' }, [inner])
}

export default defineComponent({
  name: 'RunsText',
  props: { runs: { type: Array as PropType<Run[]>, required: true } },
  setup(props) {
    const scope = inject(TERM_SCOPE, null)
    return () => props.runs.map((r) => run(r, scope))
  },
})
</script>
