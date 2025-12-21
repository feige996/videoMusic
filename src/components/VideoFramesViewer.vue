<script lang="ts" setup>
import { ref, toRef, nextTick, watch } from 'vue'
import type { FrameItem } from '@/components/types'
import type { VideoMetadata } from '@/components/types'
import { useVideoFrames } from '@/composables/useVideoFrames'

const props = defineProps<{
  videoUrl: string
  preloadedMetadata?: VideoMetadata | null
}>()

const emit = defineEmits<{
  'update:isLoading': [boolean]
}>()

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
// 响应式引用
const preloadedMetadataRef = toRef(props, 'preloadedMetadata')
const videoUrlRef = toRef(props, 'videoUrl')
const isLoading = ref(false)
const useConcurrent = ref(false)

// 移除显示模式切换，现在同时显示两种模式

const { initializeVideoFrames, cleanupResources, originalFrames } = useVideoFrames({
  videoUrl: videoUrlRef,
  frameContainer,
  frameData,
  spriteData,
  isLoading,
  log: true,
  preloadedMetadata: preloadedMetadataRef,
  useConcurrent,
})

const handleFrameImgError = (index: number) => {
  console.error(`视频帧${index}加载失败`)
}

// 当初始化或元信息更新时，重新初始化视频帧
const initializeWithMetadata = async () => {
  // 等待nextTick确保DOM更新
  await nextTick()
  // 只有在有视频URL时才初始化
  if (videoUrlRef.value) {
    await initializeVideoFrames()
  }
}

// 监听isLoading变化并通知父组件
watch(isLoading, (newValue) => {
  emit('update:isLoading', newValue)
})

watch(useConcurrent, async () => {
  cleanupResources()
  if (videoUrlRef.value) {
    isLoading.value = true
    await initializeWithMetadata()
  }
})

watch(
  videoUrlRef,
  async (newUrl, oldUrl) => {
    if (newUrl !== oldUrl) {
      // 设置isLoading为true，确保用户看到加载效果
      isLoading.value = true
      cleanupResources()
      // 重置预加载元信息引用
      preloadedMetadataRef.value = props.preloadedMetadata
      if (newUrl) {
        await initializeWithMetadata()
      }
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="timeline-wrapper">
    <!-- 控制栏 -->
    <div class="mb-2 px-1 flex flex-wrap items-center gap-4">
      <!-- 性能对比控制 -->
      <div>
        <label class="inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            v-model="useConcurrent"
            class="form-checkbox rounded text-blue-600 focus:ring-blue-500 h-4 w-4 transition duration-150 ease-in-out"
          />
          <span class="ml-2 text-sm text-gray-700 font-medium">
            启用并发提取优化 (Check Console for Timing)
          </span>
        </label>
      </div>

      <!-- 模式标题 -->
      <div class="text-sm text-gray-500">测试模式：同时显示两种渲染方式</div>
    </div>

    <!-- 雪碧图模式容器 -->
    <div class="mb-6">
      <h3 class="text-sm font-semibold text-gray-700 mb-2">1. 雪碧图模式</h3>
      <div
        class="w-full overflow-hidden flex transition-opacity duration-200"
        :class="{ 'opacity-50 cursor-wait': isLoading }"
      >
        <div
          v-for="frame in frameData"
          :key="`sprite-${frame.index}`"
          class="relative shrink-0 overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity duration-200"
          :style="{
            width: `${frame.displayWidth}px`,
            height: `${frame.displayHeight}px`,
          }"
        >
          <img
            v-if="spriteData"
            :src="spriteData?.url"
            alt="视频帧"
            class="absolute pointer-events-none object-cover"
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

    <!-- 原始帧模式容器 -->
    <div>
      <h3 class="text-sm font-semibold text-gray-700 mb-2">2. 原始帧模式</h3>
      <div
        ref="frameContainer"
        class="w-full overflow-hidden flex transition-opacity duration-200"
        :class="{ 'opacity-50 cursor-wait': isLoading }"
      >
        原始帧数量：{{ originalFrames.length }}
        <div
          v-for="(frame, index) in originalFrames"
          :key="`original-${index}`"
          class="relative shrink-0 overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity duration-200"
          :style="{
            width: `${(spriteData?.frameWidth || 80) * (spriteData?.scale || 1)}px`,
            height: `${(spriteData?.frameHeight || 45) * (spriteData?.scale || 1)}px`,
          }"
        >
          <canvas
            v-if="frame"
            :ref="
              (el: Element | null) => {
                if (el instanceof HTMLCanvasElement && frame) {
                  const ctx = el.getContext('2d')
                  if (ctx) ctx.drawImage(frame, 0, 0)
                }
              }
            "
            class="w-full h-full object-cover"
          ></canvas>
          <!-- 原始帧信息 -->
          <div
            class="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center"
          >
            {{ index + 1 }}
          </div>
          <!-- 兜底提示 -->
          <div
            v-if="!frame"
            class="absolute inset-0 flex items-center justify-center text-gray-400 text-xs"
          >
            帧{{ index }}加载失败
          </div>
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
  pointer-events: none;
  /* 禁用点击，避免干扰容器交互 */
}
</style>
