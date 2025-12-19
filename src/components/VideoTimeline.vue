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
        class="frame-item relative shrink-0"
        :style="{
          width: `${frame.displayWidth}px`,
          height: `${frame.displayHeight}px`,
        }"
      >
        <img
          :src="spriteData?.url"
          alt="视频帧"
          class="frame-img absolute inset-0 w-auto h-full transform"
          :style="{
            transform: `translateX(-${frame.col * spriteData?.frameWidth || 0}px) translateY(-${frame.row * spriteData?.frameHeight || 0}px)`,
            clipPath: `rect(0 ${spriteData?.frameWidth}px ${spriteData?.frameHeight}px 0)`,
          }"
          loading="lazy"
          @error="handleFrameImgError(frame.index)"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { frameHeight } from '@/data/config' // 容器高度配置
import longVideo from '@/assets/long.mp4' // 本地视频资源
import { debounce } from 'lodash-es'
import { getVideoFrames, createSpriteImage, calculateFramePosition } from '@/utils/videoFrame' // 抽离的视频帧工具函数

// ===================== 常量配置 =====================
// 最大支持的屏幕宽度（可根据业务调整）
const MAX_SCREEN_WIDTH = window.screen.width * 1.2
// 帧数余量（应对浮点精度/微小超界）
const FRAME_SURPLUS = 5

// ===================== 类型定义 =====================
interface VideoFramesInfo {
  frames: HTMLCanvasElement[]
  videoAspectRatio: number
  frameWidth: number
  frameHeight: number
  duration: number // 视频时长
}

interface SpriteInfo {
  spriteUrl: string
  rows: number
  cols: number
}

interface CachedFullFrameData {
  videoAspectRatio: number
  frameWidth: number
  frameHeight: number
  totalFrames: number // 精准计算的全量帧数
  duration: number
  timestamp: number
}

interface CachedFullSpriteData {
  spriteInfo: SpriteInfo
  videoAspectRatio: number
  frameWidth: number
  frameHeight: number
  totalFrames: number
  timestamp: number
}

interface FrameItem {
  index: number
  row: number
  col: number
  dataThumb: string
  displayWidth: number
  displayHeight: number
}

// ===================== 响应式数据 =====================
const videoUrl = longVideo // 视频地址（可替换为远程URL）
const frameContainer = ref<HTMLElement | null>(null)
const frameData = ref<FrameItem[]>([])
const spriteData = ref<{
  url: string
  frameWidth: number
  frameHeight: number
  cols: number
  rows: number
} | null>(null)
const isLoading = ref(false)
// 内存缓存全量帧元信息（避免重复计算）
const fullFrameMeta = ref<CachedFullFrameData | null>(null)

// ===================== 核心方法 =====================
/**
 * 根据frameHeight和最大屏幕宽度，计算所需的全量帧数
 * @param videoAspectRatio 视频宽高比
 * @returns 精准的全量帧数
 */
function calculateTotalFrames(videoAspectRatio: number): number {
  const singleFrameWidth = frameHeight * videoAspectRatio
  const baseFrames = Math.ceil(MAX_SCREEN_WIDTH / singleFrameWidth)
  const totalFrames = baseFrames + FRAME_SURPLUS
  return Math.max(totalFrames, 10) // 兜底：至少10帧
}

/**
 * 预生成精准的全量帧池（仅执行一次，依赖frameHeight）
 */
async function initPreciseFramePool() {
  if (fullFrameMeta.value) return fullFrameMeta.value

  const videoMetaCacheKey = `video_meta_${videoUrl}_${frameHeight}`
  const spriteCacheKey = `video_sprite_${videoUrl}_${frameHeight}`

  // 1. 读取缓存的视频元信息
  let cachedMeta: CachedFullFrameData | null = null
  const storedMeta = sessionStorage.getItem(videoMetaCacheKey)
  if (storedMeta) {
    const parsed = JSON.parse(storedMeta)
    if (Date.now() - parsed.timestamp < 7200 * 1000) {
      // 2小时过期
      cachedMeta = parsed
    } else {
      sessionStorage.removeItem(videoMetaCacheKey)
    }
  }

  // 2. 读取缓存的全量精灵图
  let cachedSprite: CachedFullSpriteData | null = null
  const storedSprite = sessionStorage.getItem(spriteCacheKey)
  if (storedSprite) {
    const parsed = JSON.parse(storedSprite)
    if (Date.now() - parsed.timestamp < 3600 * 1000) {
      // 1小时过期
      cachedSprite = parsed
    } else {
      sessionStorage.removeItem(spriteCacheKey)
    }
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
    // 先获取视频基础信息（仅1帧，拿到宽高比和时长）
    const basicVideoInfo = await getVideoFrames(videoUrl, 1)
    const { videoAspectRatio, duration } = basicVideoInfo

    // 计算精准的全量帧数
    const totalFrames = calculateTotalFrames(videoAspectRatio)

    // 提取全量帧（精准数量，无浪费）
    const fullVideoInfo = await getVideoFrames(videoUrl, totalFrames)

    // 生成全量精灵图（列数最多10列，避免行数过多）
    const spriteCols = Math.min(totalFrames, 10)
    const fullSpriteInfo = await createSpriteImage(
      fullVideoInfo.frames,
      fullVideoInfo.frameWidth,
      fullVideoInfo.frameHeight,
      spriteCols,
    )

    // 5. 缓存视频元信息
    const metaData: CachedFullFrameData = {
      videoAspectRatio: fullVideoInfo.videoAspectRatio,
      frameWidth: fullVideoInfo.frameWidth,
      frameHeight: fullVideoInfo.frameHeight,
      totalFrames,
      duration,
      timestamp: Date.now(),
    }
    sessionStorage.setItem(videoMetaCacheKey, JSON.stringify(metaData))
    fullFrameMeta.value = metaData

    // 6. 缓存全量精灵图
    const spriteData: CachedFullSpriteData = {
      spriteInfo: fullSpriteInfo,
      videoAspectRatio: fullVideoInfo.videoAspectRatio,
      frameWidth: fullVideoInfo.frameWidth,
      frameHeight: fullVideoInfo.frameHeight,
      totalFrames,
      timestamp: Date.now(),
    }
    sessionStorage.setItem(spriteCacheKey, JSON.stringify(spriteData))

    // 清理临时Canvas，释放内存
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
 * 从全量帧池中采样当前屏幕所需的帧数
 */
async function sampleFramesFromPool() {
  const container = frameContainer.value
  if (!container || !fullFrameMeta.value) return

  const { videoAspectRatio, totalFrames } = fullFrameMeta.value
  const containerWidth = container.clientWidth
  const containerHeight = frameHeight

  // 计算当前屏幕需要的帧数
  const singleFrameWidth = containerHeight * videoAspectRatio
  const needFrameCount = Math.max(1, Math.ceil(containerWidth / singleFrameWidth))

  // 从全量帧池中均匀采样（不超过全量帧数）
  const selectedIndexes: number[] = []
  const actualNeed = Math.min(needFrameCount, totalFrames)
  for (let i = 0; i < actualNeed; i++) {
    const ratio = i / Math.max(1, actualNeed - 1)
    const index = Math.min(totalFrames - 1, Math.floor(ratio * totalFrames))
    selectedIndexes.push(index)
  }

  // 读取全量精灵图缓存
  const spriteCacheKey = `video_sprite_${videoUrl}_${frameHeight}`
  const storedSprite = sessionStorage.getItem(spriteCacheKey)
  if (!storedSprite) return

  const { spriteInfo } = JSON.parse(storedSprite) as CachedFullSpriteData

  // 生成当前帧的位置数据
  const framesData: FrameItem[] = []
  selectedIndexes.forEach((fullIndex, displayIndex) => {
    const position = calculateFramePosition(
      fullIndex,
      spriteInfo.cols,
      fullFrameMeta.value!.frameWidth,
      fullFrameMeta.value!.frameHeight,
    )
    framesData.push({
      index: displayIndex,
      row: position.row,
      col: position.col,
      dataThumb: position.dataThumb || '',
      displayWidth: singleFrameWidth,
      displayHeight: containerHeight,
    })
  })

  // 更新响应式数据
  frameData.value = framesData
  spriteData.value = {
    url: spriteInfo.spriteUrl || '',
    frameWidth: fullFrameMeta.value.frameWidth,
    frameHeight: fullFrameMeta.value.frameHeight,
    cols: spriteInfo.cols,
    rows: spriteInfo.rows,
  }

  // 容器样式
  container.style.width = '100%'
  container.style.height = `${containerHeight}px`
  container.style.display = 'flex'
  container.style.overflowX = 'auto'
}

/**
 * 帧图片加载失败处理
 */
const handleFrameImgError = (index: number) => {
  console.error(`视频帧${index}加载失败`)
  // 可选：降级处理（如显示占位图）
}

// ===================== 防抖与监听 =====================
// 防抖采样（仅内存操作，缩短防抖时间）
const debouncedSample = debounce(async () => {
  if (isLoading.value) return
  await sampleFramesFromPool()
}, 200)

// 窗口resize处理
function handleResize() {
  if (frameContainer.value) {
    debouncedSample()
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
  debouncedSample.cancel() // 清理防抖定时器
})
</script>

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
