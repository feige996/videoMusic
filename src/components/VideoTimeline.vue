<script lang="ts" setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import type { FrameItem } from '@/components/types'
import { useVideoFrames } from '@/composables/useVideoFrames'

const props = defineProps<{ videoUrl: string }>()

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

const { initializeVideoFrames, cleanupResources, handleResize } = useVideoFrames({
  videoUrl: props.videoUrl,
  frameContainer,
  frameData,
  spriteData,
  isLoading,
})

const handleFrameImgError = (index: number) => {
  console.error(`视频帧${index}加载失败`)
}

onMounted(async () => {
  await nextTick()
  await initializeVideoFrames()
  window.addEventListener('resize', handleResize)
})

watch(
  () => props.videoUrl,
  async (newUrl, oldUrl) => {
    if (newUrl !== oldUrl) {
      cleanupResources()
      await nextTick()
      await initializeVideoFrames()
    }
  },
  { immediate: false },
)

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  cleanupResources()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <!-- 加载状态提示 -->
    <div v-if="isLoading" class="mb-2 text-gray-600">加载视频帧中...</div>
    <!-- 加载失败提示 -->
    <div v-else-if="frameData.length === 0" class="mb-2 text-red-500">视频帧加载失败，请重试</div>

    <!-- 视频帧容器 -->
    <div ref="frameContainer" class="frame-container w-full overflow-x-auto flex"
      :class="{ 'opacity-50 cursor-wait': isLoading }">
      <div v-for="frame in frameData" :key="frame.index"
        class="frame-item relative shrink-0 overflow-hidden bg-gray-100" :style="{
          width: `${frame.displayWidth}px`,
          height: `${frame.displayHeight}px`,
        }">
        <img v-if="spriteData" :src="spriteData?.url" alt="视频帧" class="frame-img absolute" :style="{
          width: `${spriteData?.cols * spriteData?.frameWidth * spriteData?.scale || 0}px`,
          height: `${spriteData?.rows * spriteData?.frameHeight * spriteData?.scale || 0}px`,
          transform: `translateX(-${frame.col * (spriteData?.frameWidth || 0) * spriteData?.scale || 0}px) translateY(-${frame.row * (spriteData?.frameHeight || 0) * spriteData?.scale || 0}px)`,
          display: spriteData?.url ? 'block' : 'none',
        }" loading="lazy" @error="handleFrameImgError(frame.index)" />
        <!-- 兜底提示 -->
        <div v-if="!spriteData?.url" class="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
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
  pointer-events: none;
  /* 禁用点击，避免干扰容器交互 */
}
</style>
