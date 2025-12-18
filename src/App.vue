<script lang="ts" setup>
import { ref, onMounted, nextTick } from 'vue'
import { frameHeight } from '@/data/config'
import longVideo from '@/assets/long.mp4'
import { getVideoFrames, createSpriteImage, calculateFramePosition } from '@/utils/index'

// const videoUrl = 'https://oss.laf.run/ukw0y1-site/beautiful-girl-with-audio.mp4'
const videoUrl = longVideo
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

  // 优先从本地缓存取精灵图（避免重复取帧）
  const cacheKey = `video_sprite_${videoUrl}_${containerWidth}`
  let cachedData = sessionStorage.getItem(cacheKey)

  // 初始化videoInfo变量，提供默认值以避免在赋值前使用的错误
  let videoInfo: {
    frames: HTMLCanvasElement[]
    videoAspectRatio: number
    frameWidth: number
    frameHeight: number
  } = {
    frames: [],
    videoAspectRatio: 16 / 9, // 默认16:9宽高比
    frameWidth: 0,
    frameHeight: 0,
  }
  // 初始化spriteInfo变量，提供默认值以避免在赋值前使用的错误
  let spriteInfo: { spriteUrl: string; rows: number; cols: number } = {
    spriteUrl: '',
    rows: 0,
    cols: 0,
  }

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
    // 先获取50个原始帧，作为均匀分布的视频帧源
    videoInfo = await getVideoFrames(videoUrl, 50)

    // 根据容器高度和视频宽高比计算帧宽度
    const containerHeight = frameHeight
    const calculatedFrameWidth = containerHeight * videoInfo.videoAspectRatio

    // 计算实际需要显示的帧数，基于容器宽度和计算出的帧宽度
    const frameCount = Math.ceil(containerWidth / calculatedFrameWidth)

    // 从原始50帧中均匀采样实际需要显示的帧数
    // 目的是确保在时间轴上均匀分布帧，而非仅显示视频开头部分
    const selectedFrames: HTMLCanvasElement[] = []
    for (let i = 0; i < frameCount; i++) {
      // 计算采样索引，确保在整个50帧范围内均匀分布
      const index = Math.floor(i * (50 / frameCount))
      const frame = videoInfo.frames[index] || videoInfo.frames[0]!
      selectedFrames.push(frame)
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
  // 根据容器高度和视频宽高比计算帧宽度
  const containerHeight = frameHeight
  const calculatedFrameWidth = containerHeight * videoInfo.videoAspectRatio

  // 计算实际需要的帧数，基于容器宽度和计算出的帧宽度
  const frameCount = Math.floor(containerWidth / calculatedFrameWidth)

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
  container.style.height = `${containerHeight}px` // 使用固定高度
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
