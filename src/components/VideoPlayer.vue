<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import VideoTimeline from './VideoTimeline.vue'
import { useVideoMetadata } from '@/composables/useVideoMetadata'

// Props定义
const props = defineProps<{
  videoUrl: string
}>()

// 视频元信息管理
const {
  videoMetadata,
  isLoading: isLoadingMetadata,
  loadMetadata,
  cleanupResources: cleanupMetadata,
} = useVideoMetadata()

// 时间线组件加载状态
const isLoadingTimeline = ref(false)

// 错误处理
const error = ref<string | null>(null)

/**
 * 加载视频信息和时间线
 */
async function loadVideoInfo() {
  if (!props.videoUrl) return

  error.value = null
  try {
    // 先加载元信息
    const metadata = await loadMetadata(props.videoUrl)

    if (!metadata) {
      throw new Error('无法加载视频元信息')
    }

    // 等待下一个渲染周期，确保元信息已更新
    await nextTick()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载视频失败'
    console.error('视频加载错误:', err)
  }
}

/**
 * 处理视频URL变化
 */
async function handleVideoUrlChange() {
  // 清理资源
  cleanupMetadata()

  // 重新加载
  await loadVideoInfo()
}

// 监听视频URL变化
watch(
  () => props.videoUrl,
  (newUrl, oldUrl) => {
    if (newUrl !== oldUrl) {
      handleVideoUrlChange()
    }
  },
  { immediate: true },
)

/**
 * 清理资源
 */
function cleanupAll() {
  cleanupMetadata()
}

// 暴露方法给父组件使用
defineExpose({
  loadVideoInfo,
  cleanupAll,
  hasAudio: () => videoMetadata.value?.hasAudio || false,
})
</script>

<template>
  <div class="video-player-container">
    <!-- 加载状态 -->
    <div
      v-if="isLoadingMetadata || isLoadingTimeline"
      class="loading-state px-4 py-2 bg-blue-50 text-blue-700 rounded-md"
    >
      <div v-if="isLoadingMetadata">加载视频信息中...</div>
      <div v-else>加载视频时间线中...</div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-state px-4 py-2 bg-red-50 text-red-700 rounded-md mb-4">
      {{ error }}
    </div>

    <!-- 视频信息展示（可选） -->
    <div v-if="videoMetadata" class="video-info mb-4 text-sm text-gray-600">
      <div class="flex flex-wrap gap-2">
        <span>时长: {{ Math.floor(videoMetadata.duration) }}秒</span>
        <span>分辨率: {{ videoMetadata.width }}×{{ videoMetadata.height }}</span>
        <span>音频: {{ videoMetadata.hasAudio ? '有' : '无' }}</span>
      </div>
    </div>

    <!-- 视频时间线 -->
    <VideoTimeline
      :video-url="videoUrl"
      :preloaded-metadata="videoMetadata"
      :is-loading="isLoadingTimeline"
    />

    <!-- 音频波形（如果有音频） -->
    <div v-if="videoMetadata?.hasAudio" class="audio-section mt-4">
      <div class="text-sm font-medium mb-2">音频波形</div>
      <!-- 这里将来可以集成音频波形组件 -->
      <div
        class="audio-placeholder h-20 bg-gray-100 rounded-md flex items-center justify-center text-gray-400"
      >
        音频波形将在这里显示
      </div>
    </div>
  </div>
</template>
