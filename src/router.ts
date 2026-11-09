import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'

export const router = createRouter({
  // Pages cannot rewrite chapter URLs to index.html.
  history: (import.meta.env.MODE === 'pages' ? createWebHashHistory : createWebHistory)(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: () => import('./views/HomeView.vue') },
    { path: '/threads', name: 'threads', component: () => import('./views/ThreadsView.vue') },
    { path: '/about', name: 'about', component: () => import('./views/AboutView.vue') },
    { path: '/notes/:id', name: 'note', component: () => import('./views/NoteView.vue'), props: true },
    { path: '/:part(virtualization|concurrency|persistence)', name: 'part', component: () => import('./views/PartView.vue'), props: true },
    { path: '/:part(virtualization|concurrency|persistence)/:slug', name: 'chapter', component: () => import('./views/ChapterView.vue'), props: true },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior(to, _from, saved) {
    if (saved) return saved
    // section ids contain dots (s-9.3), which are not valid in a raw CSS selector
    // (on first load the chapter is still loading; ChapterView scrolls once its content is there)
    const id = decodeURIComponent(to.hash.slice(1))
    if (to.hash && document.getElementById(id)) return { el: '#' + CSS.escape(id), top: 72 }
    return { top: 0 }
  },
})
