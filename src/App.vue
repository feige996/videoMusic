<script lang="ts" setup>
import VideoTimeline from '@/components/VideoTimeline.vue'

// import longVideo from '@/assets/long.mp4' // 本地视频资源
const longVideo = 'https://oss.laf.run/ukw0y1-site/beautiful-girl-with-audio.mp4' // 远程资源
</script>

<template>
  <div>
    <VideoTimeline :videoUrl="longVideo" />
  </div>
</template>
