import { defineAsyncComponent, type Component } from 'vue'

/** Labs are loaded on demand so a chapter only pays for its own animations. */
export const LABS: Record<string, Component> = {
  ProcessStates: defineAsyncComponent(() => import('./ProcessStatesLab.vue')),
  Fork: defineAsyncComponent(() => import('./ForkLab.vue')),
  Lde: defineAsyncComponent(() => import('./LdeLab.vue')),
  Scheduler: defineAsyncComponent(() => import('./SchedulerLab.vue')),
  Mlfq: defineAsyncComponent(() => import('./MlfqLab.vue')),
  Lottery: defineAsyncComponent(() => import('./LotteryLab.vue')),
  Multicore: defineAsyncComponent(() => import('./MulticoreLab.vue')),
  AddressSpace: defineAsyncComponent(() => import('./AddressSpaceLab.vue')),
  BaseBounds: defineAsyncComponent(() => import('./BaseBoundsLab.vue')),
  Segmentation: defineAsyncComponent(() => import('./SegmentationLab.vue')),
  FreeList: defineAsyncComponent(() => import('./FreeListLab.vue')),
  Paging: defineAsyncComponent(() => import('./PagingLab.vue')),
  Tlb: defineAsyncComponent(() => import('./TlbLab.vue')),
  MultiLevel: defineAsyncComponent(() => import('./MultiLevelLab.vue')),
  PageFault: defineAsyncComponent(() => import('./PageFaultLab.vue')),
  Replacement: defineAsyncComponent(() => import('./ReplacementLab.vue')),
  Eevdf: defineAsyncComponent(() => import('./EevdfLab.vue')),
}
