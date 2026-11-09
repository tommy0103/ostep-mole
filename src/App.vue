<script setup lang="ts">
import TopBar from './components/layout/TopBar.vue'
</script>

<template>
  <TopBar />
  <RouterView v-slot="{ Component, route }">
    <component :is="Component" :key="route.path" />
  </RouterView>
</template>
