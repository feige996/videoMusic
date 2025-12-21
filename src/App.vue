<script lang="ts" setup>
import VideoContainer from './components/VideoContainer.vue'

import longVideo from '@/assets/long.mp4' // 本地视频资源
import shortVideo from '@/assets/10s.mp4' // 本地视频资源
import hengtu1 from '@/assets/hengtu1.mp4' // 本地视频资源

const localVideo = hengtu1
const remoteVideo = 'https://oss.laf.run/ukw0y1-site/beautiful-girl-with-audio.mp4' // 远程资源

const videoUrl = ref(localVideo)
const toggleVideo = () => {
  videoUrl.value = videoUrl.value === localVideo ? remoteVideo : localVideo
}
</script>

<template>
  <div>
    <button @click="toggleVideo">切换视频</button>
    <span>{{ videoUrl }}</span>
    <VideoContainer :videoUrl="videoUrl" />
  </div>
</template>
