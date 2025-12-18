<script lang="ts" setup>
import { ref, onMounted, nextTick } from 'vue'
import { getVideoFrames, createSpriteImage, calculateFramePosition } from '@/utils/index'

const videoUrl = 'https://oss.laf.run/ukw0y1-site/beautiful-girl-with-audio.mp4'
const frameContainer = ref<HTMLElement | null>(null)
const frameData = ref<Array<{ index: number; row: number; col: number; dataThumb: string }>>([])
const spriteData = ref<{
  url: string
  frameWidth: number
  frameHeight: number
  cols: number
  rows: number
} | null>(null)

/**
 * 初始化视频帧容器并渲染视频帧
 * @param videoUrl 视频URL
 */
async function initFrameContainer(videoUrl: string) {
  const container = frameContainer.value
  if (!container) return

  const containerWidth = container.clientWidth
  // 使用帧间距而非直接使用frameHeight计算帧数
  const frameSpacing = 2 // 帧间距像素

  // 优先从本地缓存取精灵图（避免重复取帧）
  const cacheKey = `video_sprite_${videoUrl}_${containerWidth}`
  let cachedData = sessionStorage.getItem(cacheKey)

  let videoInfo: {
    frames: HTMLCanvasElement[]
    videoAspectRatio: number
    frameWidth: number
    frameHeight: number
  }
  let spriteInfo: { spriteUrl: string; rows: number; cols: number }

  if (cachedData) {
    try {
      const parsed = JSON.parse(cachedData)
      spriteInfo = parsed.spriteInfo
      videoInfo = {
        frames: [], // 缓存中不需要保存帧数据
        videoAspectRatio: parsed.videoAspectRatio,
        frameWidth: parsed.frameWidth,
        frameHeight: parsed.frameHeight,
      }
    } catch {
      // 缓存格式错误，重新生成
      cachedData = null
    }
  }

  if (!cachedData) {
    // 获取视频帧和视频信息
    videoInfo = await getVideoFrames(videoUrl, 50) // 获取50帧，足够显示在时间轴上

    // 计算实际需要的帧数，基于容器宽度和帧宽度
    const frameCount = Math.min(
      50,
      Math.floor(containerWidth / (videoInfo.frameWidth + frameSpacing)),
    )

    // 从50帧中均匀采样实际需要的帧数
    const step = 50 / frameCount
    const selectedFrames = []
    for (let i = 0; i < frameCount; i++) {
      selectedFrames.push(videoInfo.frames[Math.floor(i * step)] || videoInfo.frames[0])
    }

    // 设置精灵图列数，根据帧数量调整
    const spriteCols = frameCount > 10 ? 5 : 1

    // 生成精灵图
    spriteInfo = await createSpriteImage(
      selectedFrames,
      videoInfo.frameWidth,
      videoInfo.frameHeight,
      spriteCols,
    )

    // 缓存数据
    const cacheData = JSON.stringify({
      spriteInfo,
      videoAspectRatio: videoInfo.videoAspectRatio,
      frameWidth: videoInfo.frameWidth,
      frameHeight: videoInfo.frameHeight,
    })
    sessionStorage.setItem(cacheKey, cacheData)
    setTimeout(() => sessionStorage.removeItem(cacheKey), 3600 * 1000)
  }

  // 生成每个帧的定位数据
  const framesData = []
  const frameCount = Math.min(
    50,
    Math.floor(containerWidth / (videoInfo.frameWidth + frameSpacing)),
  )

  for (let i = 0; i < frameCount; i++) {
    const position = calculateFramePosition(
      i,
      spriteInfo.cols,
      videoInfo.frameWidth,
      videoInfo.frameHeight,
    )
    framesData.push({
      index: i,
      row: position.row,
      col: position.col,
      dataThumb: position.dataThumb,
    })
  }

  // 更新响应式数据
  frameData.value = framesData
  spriteData.value = {
    url: spriteInfo.spriteUrl,
    frameWidth: videoInfo.frameWidth,
    frameHeight: videoInfo.frameHeight,
    cols: spriteInfo.cols,
    rows: spriteInfo.rows,
  }

  // 设置容器样式
  container.style.width = '100%'
  container.style.height = `${videoInfo.frameHeight}px`
  container.style.cursor = 'pointer'
}

onMounted(async () => {
  await nextTick()
  await initFrameContainer(videoUrl)
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <!-- 视频帧容器 -->
    <div
      ref="frameContainer"
      class="w-full overflow-x-auto flex"
      style="
        --filmstrip-thumb-width: v-bind('spriteData?.frameWidth || 0');
        --filmstrip-thumb-height: v-bind('spriteData?.frameHeight || 0');
        --filmstrip-rows: v-bind('spriteData?.rows || 1');
      "
    >
      <div
        v-for="frame in frameData"
        :key="frame.index"
        :data-key="frame.index"
        :data-thumb="frame.dataThumb"
        class="relative flex-1 bg-no-repeat"
        :style="{
          '--filmstrip-sprite-x': frame.col,
          '--filmstrip-sprite-y': frame.row,
          'background-image': `url(${spriteData?.url})`,
          'background-position': `calc(-1 * var(--filmstrip-sprite-x) * var(--filmstrip-thumb-width)) calc(-1 * var(--filmstrip-sprite-y) * var(--filmstrip-thumb-height))`,
          'background-size': `auto calc(var(--filmstrip-rows) * 100%)`,
          width: `${spriteData?.frameWidth}px`,
          height: `${spriteData?.frameHeight}px`,
        }"
      ></div>
    </div>
  </div>
</template>
