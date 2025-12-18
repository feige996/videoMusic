<script lang="ts" setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { frameHeight } from '@/data/config'
import longVideo from '@/assets/long.mp4'
import { debounce } from 'lodash-es'
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

  // 定义视频原始帧数据的缓存键，用于存储视频本身的帧数据
  const videoFramesCacheKey = `video_frames_${videoUrl}`
  // 定义精灵图缓存键，包含视频URL和容器宽度
  const spriteCacheKey = `video_sprite_${videoUrl}_${containerWidth}`

  let cachedSpriteData = sessionStorage.getItem(spriteCacheKey)
  let cachedVideoFramesData = sessionStorage.getItem(videoFramesCacheKey)

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

  // 优先使用精灵图缓存
  if (cachedSpriteData) {
    try {
      const parsed = JSON.parse(cachedSpriteData)
      spriteInfo = parsed.spriteInfo
      videoInfo = {
        frames: [], // 精灵图缓存中不需要保存帧数据
        videoAspectRatio: parsed.videoAspectRatio,
        frameWidth: parsed.frameWidth,
        frameHeight: parsed.frameHeight,
      }
    } catch {
      // 缓存格式错误，重新生成
      cachedSpriteData = null
    }
  }

  // 如果没有精灵图缓存或需要重新生成
  if (!cachedSpriteData) {
    // 检查是否有视频帧缓存
    if (cachedVideoFramesData) {
      try {
        const parsed = JSON.parse(cachedVideoFramesData)
        // 恢复视频信息，但frames数组需要重新创建canvas元素
        // 这里简化处理，实际项目中可能需要更复杂的canvas重建逻辑
        videoInfo = {
          frames: [], // 从缓存中恢复frames比较复杂，这里仍从视频重新获取
          videoAspectRatio: parsed.videoAspectRatio,
          frameWidth: parsed.frameWidth,
          frameHeight: parsed.frameHeight,
        }
      } catch {
        cachedVideoFramesData = null
      }
    }

    // 如果没有视频帧缓存或解析失败，从视频重新获取
    if (!cachedVideoFramesData) {
      // 获取视频帧和视频信息
      // 先获取50个原始帧，作为均匀分布的视频帧源
      videoInfo = await getVideoFrames(videoUrl, 50)

      // 缓存视频帧相关信息（不包括实际frame对象，因为canvas无法直接序列化）
      const videoFramesCacheData = JSON.stringify({
        videoAspectRatio: videoInfo.videoAspectRatio,
        frameWidth: videoInfo.frameWidth,
        frameHeight: videoInfo.frameHeight,
      })
      sessionStorage.setItem(videoFramesCacheKey, videoFramesCacheData)
    } else {
      // 如果有视频帧缓存但需要重新获取帧，直接从视频获取
      videoInfo = await getVideoFrames(videoUrl, 50)
    }

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

    // 缓存精灵图数据
    const spriteCacheData = JSON.stringify({
      spriteInfo,
      videoAspectRatio: videoInfo.videoAspectRatio,
      frameWidth: videoInfo.frameWidth,
      frameHeight: videoInfo.frameHeight,
    })
    sessionStorage.setItem(spriteCacheKey, spriteCacheData)

    // 设置缓存过期时间（1小时）
    setTimeout(() => sessionStorage.removeItem(spriteCacheKey), 3600 * 1000)
    // 视频帧信息缓存可以保存更长时间，单独设置过期
    setTimeout(() => sessionStorage.removeItem(videoFramesCacheKey), 7200 * 1000)
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

// 创建防抖版本的初始化函数
const debouncedInitFrameContainer = debounce(async (url: string) => {
  await initFrameContainer(url)
}, 300)

// 窗口大小变化处理
function handleResize() {
  debouncedInitFrameContainer(videoUrl)
}

onMounted(async () => {
  await nextTick()
  await initFrameContainer(videoUrl)
  // 添加窗口大小变化监听
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  // 移除窗口大小变化监听
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4">
    {{ frameData.length }}
    <!-- 视频帧容器 -->
    <div ref="frameContainer" class="w-full overflow-x-auto flex">
      <div
        v-for="frame in frameData"
        :key="frame.index"
        :data-key="frame.index"
        :data-thumb="frame.dataThumb"
        class="relative flex-1 bg-no-repeat"
        :style="{
          'background-image': `url(${spriteData?.url})`,
          'background-position': `calc(-1 * ${frame.col} * ${spriteData?.frameWidth || 0}px) calc(-1 * ${frame.row} * ${spriteData?.frameHeight || 0}px)`,
          'background-size': `auto calc(${spriteData?.rows || 1} * 100%)`,
          width: `${spriteData?.frameWidth}px`,
          height: `${spriteData?.frameHeight}px`,
        }"
      ></div>
    </div>
  </div>
</template>
