<script lang="ts" setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { frameHeight } from '@/data/config' // 容器高度配置
// import longVideo from '@/assets/long.mp4' // 本地视频资源
import { debounce } from 'lodash-es'
import type {
  SpriteInfo,
  CachedFullFrameData,
  CachedFullSpriteData,
  FrameItem,
} from '@/components/types' // 新增：引入类型定义

import { getVideoFrames, createSpriteImage, calculateFramePosition } from '@/utils/videoFrame' // 抽离的视频帧工具函数

// ===================== 常量配置 =====================
// 最大支持的屏幕宽度（可根据业务调整）
const MAX_SCREEN_WIDTH = window.screen.width * 1.2
// 帧数余量（应对浮点精度/微小超界）
const FRAME_SURPLUS = 5

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
  scale: number // 新增：传递缩放比例到模板
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
    console.log(fullVideoInfo, totalFrames)

    // 生成全量精灵图（列数最多10列，避免行数过多）
    const spriteCols = Math.min(totalFrames, 10)

    // 开始计时 - 测量精灵图生成时间
    const spriteGenerateStartTime = performance.now()
    const fullSpriteInfo = await createSpriteImage(
      fullVideoInfo.frames,
      fullVideoInfo.frameWidth,
      fullVideoInfo.frameHeight,
      spriteCols,
    )
    // 结束计时并打印
    const spriteGenerateEndTime = performance.now()
    const spriteGenerateDuration = spriteGenerateEndTime - spriteGenerateStartTime
    console.log(`精灵图生成耗时: ${spriteGenerateDuration.toFixed(2)}ms, 帧数量: ${totalFrames}`)

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
    frameWidth: originalFrameWidth, // 视频原始帧宽度（如960px）
    frameHeight: originalFrameHeight, // 视频原始帧高度（如624px）
  } = fullFrameMeta.value
  const containerWidth = container.clientWidth // 当前容器宽度
  const containerHeight = frameHeight // 配置的固定高度（如80px）

  // 3. 计算核心尺寸（关键：统一原始尺寸与显示尺寸的缩放比例）
  // 容器单帧显示宽度（按宽高比计算）
  const displayFrameWidth = containerHeight * videoAspectRatio
  // 容器单帧显示高度（固定为配置值）
  const displayFrameHeight = containerHeight
  // 缩放比例：原始帧 → 容器显示帧（高度优先，保证比例一致）
  const scale = displayFrameHeight / originalFrameHeight

  // 4. 计算当前屏幕需要的帧数（防极端值）
  const needFrameCount = Math.max(1, Math.ceil(containerWidth / displayFrameWidth))
  // 实际采样帧数：不超过全量帧池总数
  const actualNeed = Math.min(needFrameCount, totalFrames)

  // 5. 均匀采样索引（防越界，保证覆盖整个视频时长）
  const selectedIndexes: number[] = []
  for (let i = 0; i < actualNeed; i++) {
    // 计算0~1的均匀比例（避免最后一帧索引越界）
    const ratio = i / Math.max(1, actualNeed - 1)
    // 采样索引：严格小于全量帧数
    const index = Math.floor(ratio * (totalFrames - 1))
    selectedIndexes.push(index)
  }

  // 6. 读取精灵图缓存（带校验）
  const spriteCacheKey = `video_sprite_${videoUrl}_${frameHeight}`
  const storedSprite = sessionStorage.getItem(spriteCacheKey)
  if (!storedSprite) {
    console.warn('精灵图缓存不存在，跳过采样')
    return
  }

  let spriteInfo: SpriteInfo
  try {
    const parsed = JSON.parse(storedSprite) as CachedFullSpriteData
    spriteInfo = parsed.spriteInfo
  } catch (e) {
    console.error('解析精灵图缓存失败：', e)
    return
  }

  // 7. 生成帧数据（包含缩放比例，供模板使用）
  const framesData: FrameItem[] = []
  selectedIndexes.forEach((fullIndex, displayIndex) => {
    // 计算帧在精灵图中的原始位置
    const position = calculateFramePosition(
      fullIndex,
      spriteInfo.cols,
      originalFrameWidth,
      originalFrameHeight,
      totalFrames, // 传入全量帧数，防越界
    )

    framesData.push({
      index: displayIndex,
      row: position.row,
      col: position.col,
      dataThumb: position.dataThumb || '',
      displayWidth: displayFrameWidth,
      displayHeight: displayFrameHeight,
      scale: scale, // 传递缩放比例到模板
    })
  })

  // 8. 更新响应式数据（补充缩放比例）
  frameData.value = framesData
  spriteData.value = {
    url: spriteInfo.spriteUrl || '',
    frameWidth: originalFrameWidth,
    frameHeight: originalFrameHeight,
    cols: spriteInfo.cols,
    rows: spriteInfo.rows,
    scale: scale, // 核心：传递缩放比例到模板
  }

  // 9. 容器样式重置（保证布局稳定）
  Object.assign(container.style, {
    width: '100%',
    height: `${containerHeight}px`,
    display: 'flex',
    overflowX: 'auto',
    gap: '0', // 移除帧间隙，避免布局错位
    scrollbarWidth: 'thin', // 美化滚动条
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
