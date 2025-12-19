<script lang="ts" setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { frameHeight } from '@/data/config' // 容器高度配置
// import longVideo from '@/assets/long.mp4' // 本地视频资源
import { throttle } from 'lodash-es'
import localforage from 'localforage' // 引入localforage
import type {
  SpriteInfo,
  CachedFullFrameData,
  CachedFullSpriteData,
  FrameItem,
} from '@/components/types'

import { getVideoFrames, createSpriteImage, calculateFramePosition } from '@/utils/videoFrame'

// ===================== 常量配置 =====================
// 帧数余量（应对浮点精度/微小超界）
const FRAME_SURPLUS = 5

// 初始化localforage（配置IndexedDB存储）
const videoFrameStore = localforage.createInstance({
  name: 'VideoFrameStore', // 数据库名称
  storeName: 'videoFrames', // 存储表名
  driver: localforage.INDEXEDDB, // 强制使用IndexedDB
  version: 1.0,
})

// ===================== 响应式数据 =====================
// const videoUrl = longVideo // 视频地址（可替换为远程URL）
const videoUrl = 'https://oss.laf.run/ukw0y1-site/beautiful-girl-with-audio.mp4' // 视频地址（可替换为远程URL）
const frameContainer = ref<HTMLElement | null>(null)
const frameData = ref<FrameItem[]>([])
const spriteData = ref<{
  url: string
  frameWidth: number
  frameHeight: number
  cols: number
  rows: number
  scale: number
} | null>(null)
const isLoading = ref(false)
const fullFrameMeta = ref<CachedFullFrameData | null>(null)

// ===================== 核心方法 =====================
/**
 * 根据frameHeight和容器宽度，计算所需的全量帧数
 * @param videoAspectRatio 视频宽高比
 * @param containerWidth 容器宽度
 * @returns 精准的全量帧数
 */
function calculateTotalFrames(videoAspectRatio: number, containerWidth: number): number {
  const singleFrameWidth = frameHeight * videoAspectRatio
  const baseFrames = Math.ceil((containerWidth * 1.2) / singleFrameWidth)
  const totalFrames = baseFrames + FRAME_SURPLUS
  return Math.max(totalFrames, 10) // 兜底：至少10帧
}

/**
 * 预生成精准的全量帧池（替换为localforage存储）
 */
async function initPreciseFramePool() {
  if (fullFrameMeta.value) return fullFrameMeta.value

  const videoMetaCacheKey = `video_meta_${videoUrl}_${frameHeight}`
  const spriteCacheKey = `video_sprite_${videoUrl}_${frameHeight}`

  // 1. 从IndexedDB读取缓存的视频元信息
  let cachedMeta: CachedFullFrameData | null = null
  try {
    const storedMeta = await videoFrameStore.getItem<CachedFullFrameData>(videoMetaCacheKey)
    if (storedMeta && Date.now() - storedMeta.timestamp < 7200 * 1000) {
      // 2小时过期
      cachedMeta = storedMeta
    } else if (storedMeta) {
      await videoFrameStore.removeItem(videoMetaCacheKey) // 清理过期缓存
    }
  } catch (e) {
    console.warn('读取视频元信息缓存失败：', e)
  }

  // 2. 从IndexedDB读取缓存的全量精灵图
  let cachedSprite: CachedFullSpriteData | null = null
  try {
    const storedSprite = await videoFrameStore.getItem<CachedFullSpriteData>(spriteCacheKey)
    if (storedSprite && Date.now() - storedSprite.timestamp < 3600 * 1000) {
      // 1小时过期
      cachedSprite = storedSprite
    } else if (storedSprite) {
      await videoFrameStore.removeItem(spriteCacheKey) // 清理过期缓存
    }
  } catch (e) {
    console.warn('读取精灵图缓存失败：', e)
  }

  // 3. 缓存命中：直接返回
  if (cachedMeta && cachedSprite) {
    fullFrameMeta.value = cachedMeta
    return {
      meta: cachedMeta,
      sprite: cachedSprite.spriteInfo,
    }
  }

  // 4. 缓存未命中：提取视频帧并生成精灵图
  isLoading.value = true
  try {
    const basicVideoInfoGenerateStartTime = performance.now()
    const basicVideoInfo = await getVideoFrames(videoUrl, 1)
    const basicVideoInfoGenerateEndTime = performance.now()
    const basicVideoInfoGenerateDuration =
      basicVideoInfoGenerateEndTime - basicVideoInfoGenerateStartTime
    console.log(`视频元信息提取耗时: ${basicVideoInfoGenerateDuration.toFixed(2)}ms`)

    const { videoAspectRatio, duration } = basicVideoInfo
    // 使用容器宽度或窗口宽度作为回退
    const containerWidth = frameContainer.value?.clientWidth || window.innerWidth
    const totalFrames = calculateTotalFrames(videoAspectRatio, containerWidth)
    const fullVideoInfoGenerateStartTime = performance.now()
    const fullVideoInfo = await getVideoFrames(videoUrl, totalFrames)
    const fullVideoInfoGenerateEndTime = performance.now()
    const fullVideoInfoGenerateDuration =
      fullVideoInfoGenerateEndTime - fullVideoInfoGenerateStartTime
    console.log(
      `视频全量帧提取耗时: ${fullVideoInfoGenerateDuration.toFixed(2)}ms, 帧数量: ${totalFrames}`,
    )

    // 生成全量精灵图
    const spriteCols = Math.min(totalFrames, 10)
    const spriteGenerateStartTime = performance.now()
    const fullSpriteInfo = await createSpriteImage(
      fullVideoInfo.frames,
      fullVideoInfo.frameWidth,
      fullVideoInfo.frameHeight,
      spriteCols,
    )
    const spriteGenerateEndTime = performance.now()
    const spriteGenerateDuration = spriteGenerateEndTime - spriteGenerateStartTime
    console.log(`精灵图生成耗时: ${spriteGenerateDuration.toFixed(2)}ms, 帧数量: ${totalFrames}`)

    // 5. 存入IndexedDB缓存（视频元信息）
    const metaData: CachedFullFrameData = {
      videoAspectRatio: fullVideoInfo.videoAspectRatio,
      frameWidth: fullVideoInfo.frameWidth,
      frameHeight: fullVideoInfo.frameHeight,
      totalFrames,
      duration,
      timestamp: Date.now(),
    }
    await videoFrameStore.setItem(videoMetaCacheKey, metaData)
    fullFrameMeta.value = metaData

    // 6. 存入IndexedDB缓存（全量精灵图）
    const spriteData: CachedFullSpriteData = {
      spriteInfo: fullSpriteInfo,
      videoAspectRatio: fullVideoInfo.videoAspectRatio,
      frameWidth: fullVideoInfo.frameWidth,
      frameHeight: fullVideoInfo.frameHeight,
      totalFrames,
      timestamp: Date.now(),
    }
    await videoFrameStore.setItem(spriteCacheKey, spriteData)

    // 清理临时Canvas
    fullVideoInfo.frames.forEach((frame) => {
      frame.width = 0
      frame.height = 0
    })

    return {
      meta: metaData,
      sprite: fullSpriteInfo,
    }
  } catch (e) {
    console.error('初始化精准帧池失败：', e)
    throw e
  } finally {
    isLoading.value = false
  }
}

/**
 * 从全量帧池中采样当前屏幕所需的帧数（完整修复版）
 */
async function sampleFramesFromPool() {
  // 1. 基础校验
  const container = frameContainer.value
  if (!container || !fullFrameMeta.value) {
    console.warn('容器或全量帧元信息为空，跳过采样')
    return
  }

  // 2. 解构基础参数
  const {
    videoAspectRatio,
    totalFrames,
    frameWidth: originalFrameWidth,
    frameHeight: originalFrameHeight,
  } = fullFrameMeta.value
  const containerWidth = container.clientWidth
  const containerHeight = frameHeight

  // 3. 计算核心尺寸
  const displayFrameWidth = containerHeight * videoAspectRatio
  const displayFrameHeight = containerHeight
  const scale = displayFrameHeight / originalFrameHeight

  // 4. 计算当前屏幕需要的帧数
  const needFrameCount = Math.max(1, Math.ceil(containerWidth / displayFrameWidth))
  const actualNeed = Math.min(needFrameCount, totalFrames)

  // 5. 均匀采样索引
  const selectedIndexes: number[] = []
  for (let i = 0; i < actualNeed; i++) {
    const ratio = i / Math.max(1, actualNeed - 1)
    const index = Math.floor(ratio * (totalFrames - 1))
    selectedIndexes.push(index)
  }

  // 6. 从IndexedDB读取精灵图缓存
  const spriteCacheKey = `video_sprite_${videoUrl}_${frameHeight}`
  let spriteInfo: SpriteInfo | null = null
  try {
    const storedSprite = await videoFrameStore.getItem<CachedFullSpriteData>(spriteCacheKey)
    if (!storedSprite) {
      console.warn('精灵图缓存不存在，跳过采样')
      return
    }
    spriteInfo = storedSprite.spriteInfo
  } catch (e) {
    console.error('解析精灵图缓存失败：', e)
    return
  }

  if (!spriteInfo) return

  // 7. 生成帧数据
  const framesData: FrameItem[] = []
  selectedIndexes.forEach((fullIndex, displayIndex) => {
    const position = calculateFramePosition(
      fullIndex,
      spriteInfo.cols,
      originalFrameWidth,
      originalFrameHeight,
      totalFrames,
    )

    framesData.push({
      index: displayIndex,
      row: position.row,
      col: position.col,
      dataThumb: position.dataThumb || '',
      displayWidth: displayFrameWidth,
      displayHeight: displayFrameHeight,
      scale: scale,
    })
  })

  // 8. 更新响应式数据
  frameData.value = framesData
  spriteData.value = {
    url: spriteInfo.spriteUrl || '',
    frameWidth: originalFrameWidth,
    frameHeight: originalFrameHeight,
    cols: spriteInfo.cols,
    rows: spriteInfo.rows,
    scale: scale,
  }

  // 9. 容器样式重置
  Object.assign(container.style, {
    width: '100%',
    height: `${containerHeight}px`,
    display: 'flex',
    overflowX: 'auto',
    gap: '0',
    scrollbarWidth: 'thin',
  })

  console.log(`采样完成：共${actualNeed}帧，缩放比例${scale.toFixed(3)}`)
}

/**
 * 帧图片加载失败处理
 */
const handleFrameImgError = (index: number) => {
  console.error(`视频帧${index}加载失败`)
  // 可选：降级处理（如显示占位图）
}

// ===================== 节流与监听 =====================
// 节流采样（resize事件更适合使用节流而非防抖）
// 节流能保证在调整过程中也能平滑更新，避免调整结束后才更新的延迟感
const throttledSample = throttle(async () => {
  if (isLoading.value) return
  await sampleFramesFromPool()
}, 16)

// 窗口resize处理
function handleResize() {
  if (frameContainer.value) {
    throttledSample()
  }
}

// ===================== 生命周期 =====================
onMounted(async () => {
  await nextTick()
  await initPreciseFramePool() // 首次预生成精准帧池
  await sampleFramesFromPool() // 首次采样当前屏幕所需帧数
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  throttledSample.cancel() // 清理节流定时器
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <!-- 加载状态提示 -->
    <div v-if="isLoading" class="mb-2 text-gray-600">加载视频帧中...</div>
    <!-- 加载失败提示 -->
    <div v-else-if="frameData.length === 0" class="mb-2 text-red-500">视频帧加载失败，请重试</div>

    <!-- 视频帧容器 -->
    <div
      ref="frameContainer"
      class="frame-container w-full overflow-x-auto flex"
      :class="{ 'opacity-50 cursor-wait': isLoading }"
    >
      <div
        v-for="frame in frameData"
        :key="frame.index"
        class="frame-item relative shrink-0 overflow-hidden bg-gray-100"
        :style="{
          width: `${frame.displayWidth}px`,
          height: `${frame.displayHeight}px`,
        }"
      >
        <img
          v-if="spriteData"
          :src="spriteData?.url"
          alt="视频帧"
          class="frame-img absolute"
          :style="{
            width: `${spriteData?.cols * spriteData?.frameWidth * spriteData?.scale || 0}px`,
            height: `${spriteData?.rows * spriteData?.frameHeight * spriteData?.scale || 0}px`,
            transform: `translateX(-${frame.col * (spriteData?.frameWidth || 0) * spriteData?.scale || 0}px) translateY(-${frame.row * (spriteData?.frameHeight || 0) * spriteData?.scale || 0}px)`,
            display: spriteData?.url ? 'block' : 'none',
          }"
          loading="lazy"
          @error="handleFrameImgError(frame.index)"
        />
        <!-- 兜底提示 -->
        <div
          v-if="!spriteData?.url"
          class="absolute inset-0 flex items-center justify-center text-gray-400 text-xs"
        >
          帧{{ frame.index }}加载失败
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 滚动条美化 */
.frame-container::-webkit-scrollbar {
  height: 4px;
}
.frame-container::-webkit-scrollbar-thumb {
  background-color: #cccccc;
  border-radius: 2px;
}

/* 帧项样式 */
.frame-item {
  transition: opacity 0.2s ease;
}
.frame-item:hover {
  opacity: 0.9;
}

/* 帧图片样式 */
.frame-img {
  object-fit: cover;
  pointer-events: none; /* 禁用点击，避免干扰容器交互 */
}
</style>
