import { describe, expect, it } from 'vitest'
import { anchorTokens, readingMinutes, smallCapsTitle } from '@/lib/text'
import { inlineRuns } from '@/lib/md'
import { highlight } from '@/lib/highlight'

describe('text helpers', () => {
  it('recovers natural casing for small-caps titles', () => {
    expect(smallCapsTitle('HOW TO PROVIDE THE ILLUSION OF MANY CPUS?')).toBe('How To Provide The Illusion Of Many CPUs?')
    expect(smallCapsTitle('USE TIME SHARING (AND SPACE SHARING)')).toBe('Use Time Sharing (And Space Sharing)')
    expect(smallCapsTitle('Already mixed')).toBe('Already mixed')
  })
  it('extracts anchor tokens that survive translation', () => {
    expect(anchorTokens('进程调用 fork() 返回 29147 [DV66]')).toEqual(['fork()', '29147', '[dv66]'])
  })
  it('estimates reading time in both scripts', () => {
    const p = (t: string) => ({ t: 'p' as const, runs: [{ t, s: '' as const }] })
    expect(readingMinutes([p('word '.repeat(460))])).toBe(2)
    expect(readingMinutes([p('字'.repeat(800))])).toBe(2)
  })
  it('parses our inline markup', () => {
    expect(inlineRuns('call `fork()` **now**')).toEqual([
      { t: 'call ', s: '' },
      { t: 'fork()', s: 'c' },
      { t: ' ', s: '' },
      { t: 'now', s: 'b' },
    ])
  })
  it('highlights C without losing characters', () => {
    const src = 'int rc = fork(); // child\nprintf("hi %d\\n", rc);'
    const toks = highlight(src)
    expect(toks.map((t) => t.t).join('')).toBe(src)
    expect(toks.find((t) => t.t === 'int')?.c).toBe('ty')
    expect(toks.find((t) => t.t.startsWith('//'))?.c).toBe('com')
  })
})
