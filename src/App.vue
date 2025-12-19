<script lang="ts" setup>
import VideoTimeline from '@/components/VideoTimeline.vue'

import localVideo from '@/assets/long.mp4' // 本地视频资源
const remoteVideo = 'https://oss.laf.run/ukw0y1-site/beautiful-girl-with-audio.mp4' // 远程资源

const longVideo = ref(localVideo)
const toggleVideo = () => {
  longVideo.value = longVideo.value === localVideo ? remoteVideo : localVideo
}
</script>

<template>
  <div>
    <button @click="toggleVideo">切换视频</button>
    <span>{{ longVideo }}</span>
    <VideoTimeline :videoUrl="longVideo" />
  </div>
</template>
