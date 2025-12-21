<script lang="ts" setup>
import VideoContainer from './components/VideoContainer.vue'

import longVideo from '@/assets/long.mp4' // 本地视频资源，3min52s，横图
import shortVideo from '@/assets/short.mp4' // 本地视频资源,10S, 竖图
import hengtu1 from '@/assets/hengtu1.mp4' // 本地视频资源，5S, 横图
import hengtu2 from '@/assets/hengtu2.mp4' // 本地视频资源，5S, 横图
import shutu1 from '@/assets/shutu1.mp4' // 本地视频资源，5S, 竖图
import shutu2 from '@/assets/shutu2.mp4' // 本地视频资源，5S, 竖图

const localVideo = shutu2
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
