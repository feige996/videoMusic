<script lang="ts" setup>
import VideoTimeline from '@/components/VideoTimeline.vue'

import longVideo from '@/assets/long.mp4' // 本地视频资源
</script>

<template>
  <div>
    <VideoTimeline :videoUrl="longVideo" />
  </div>
</template>
