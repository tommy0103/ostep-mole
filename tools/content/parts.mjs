// Chapter registry used by the content tools. English slugs follow the official OSTEP file names;
// Chinese PDFs are the official translation hosted at pages.cs.wisc.edu/~remzi/OSTEP/Chinese/NN.pdf
export const PARTS = {
  virtualization: [
    'dialogue-virtualization', 'cpu-intro', 'cpu-api', 'cpu-mechanisms', 'cpu-sched', 'cpu-sched-mlfq',
    'cpu-sched-lottery', 'cpu-sched-multi', 'cpu-dialogue', 'dialogue-vm', 'vm-intro', 'vm-api', 'vm-mechanism',
    'vm-segmentation', 'vm-freespace', 'vm-paging', 'vm-tlbs', 'vm-smalltables', 'vm-beyondphys',
    'vm-beyondphys-policy', 'vm-complete', 'vm-dialogue',
  ].map((slug, i) => ({ num: i + 3, slug })),
};
export const EN_URL = (slug) => `https://pages.cs.wisc.edu/~remzi/OSTEP/${slug}.pdf`;
export const ZH_URL = (num) => `https://pages.cs.wisc.edu/~remzi/OSTEP/Chinese/${String(num).padStart(2, '0')}.pdf`;
export const CACHE = new URL('../../.cache/pdf/', import.meta.url).pathname;
