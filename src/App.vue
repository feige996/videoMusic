<script lang="ts" setup>
import { getVideoFrames, createSpriteImage } from '@/utils/index'
import { frameHeight } from '@/data/config'

const videoUrl = 'https://oss.laf.run/ukw0y1-site/beautiful-girl-with-audio.mp4'
const frameContainer = ref(null)
async function initFrameContainer(videoUrl) {
  const container = frameContainer.value
  const containerWidth = container.clientWidth
  const frameCount = Math.floor(containerWidth / frameHeight) // 动态计算需要的帧数

  // 优先从本地缓存取精灵图（避免重复取帧）
  const cacheKey = `video_sprite_${videoUrl}_${frameCount}`
  const cachedSpriteUrl = sessionStorage.getItem(cacheKey)

  let spriteUrl
  if (cachedSpriteUrl) {
    spriteUrl = cachedSpriteUrl
  } else {
    // 取帧+生成精灵图
    const frames = await getVideoFrames(videoUrl, frameCount)
    spriteUrl = await createSpriteImage(frames, frameHeight, frameHeight)
    // 缓存精灵图（有效期1小时，避免缓存过大）
    sessionStorage.setItem(cacheKey, spriteUrl)
    setTimeout(() => sessionStorage.removeItem(cacheKey), 3600 * 1000)
  }

  // 渲染精灵图容器
  container.style.width = `${frameCount * frameHeight}px`
  container.style.height = `${frameHeight}px`
  container.style.backgroundImage = `url(${spriteUrl})`
  container.style.backgroundRepeat = 'no-repeat'

  // 示例：用户 hover 到某位置时，显示对应帧（也可直接平铺）
  container.addEventListener('mousemove', (e) => {
    const x = e.offsetX
    const frameIndex = Math.floor(x / frameHeight)
    // 计算背景偏移（竖排精灵图，仅偏移y轴）
    container.style.backgroundPosition = `0 ${-frameIndex * frameHeight}px`
  })
}

onMounted(async () => {
  await nextTick()
  await initFrameContainer(videoUrl)
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <!-- 视频帧容器 -->
    <div ref="frameContainer" class="w-full"></div>
  </div>
</template>
