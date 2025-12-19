import { ref } from 'vue'
import localforage from 'localforage'
import { VIDEO_FRAME_CACHE_EXPIRE } from '@/data/config'
import type { VideoMetadata } from '@/components/types'

/**
 * 检测视频是否包含音频轨道
 * @param {HTMLVideoElement} videoEl 视频元素
 * @returns {Promise<boolean>} 是否有音频
 */
function checkVideoHasAudio(videoEl: HTMLVideoElement): Promise<boolean> {
  return new Promise((resolve) => {
    // 确保视频元数据加载完成
    const check = () => {
      try {
        // 类型转换为增强接口
        const enhancedVideo = videoEl as HTMLVideoElement

        // 标准 API：audioTracks（优先）
        if (enhancedVideo.audioTracks && enhancedVideo.audioTracks.length > 0) {
          // 过滤掉禁用的轨道（部分浏览器会默认禁用空轨道）
          const activeAudioTracks = Array.from(enhancedVideo.audioTracks).filter(
            (track) => track.enabled,
          )
          resolve(activeAudioTracks.length > 0)
          return
        }

        // 兼容：非标准属性（兜底）
        const hasAudio = Boolean(
          videoEl.mozHasAudio ||
            (videoEl.webkitAudioDecodedByteCount && videoEl.webkitAudioDecodedByteCount > 0),
        )
        resolve(hasAudio)
      } catch {
        // 异常降级（如跨域视频可能限制属性访问）
        resolve(false)
      }
    }

    // 如果元数据已加载，直接检测；否则监听加载完成
    if (videoEl.readyState >= 1) {
      // HAVE_METADATA
      check()
    } else {
      videoEl.addEventListener('loadedmetadata', check, { once: true })
      // 超时兜底（防止加载失败）
      setTimeout(() => resolve(false), 5000)
    }
  })
}

/**
 * 视频元信息存储实例
 */
const videoMetadataStore = localforage.createInstance({
  name: 'VideoMetadataStore',
  storeName: 'videoMetadata',
  driver: localforage.INDEXEDDB,
  version: 1.0,
})

/**
 * 获取视频元信息，包括是否有音频
 * @param videoUrl 视频URL
 * @returns 视频元信息对象
 */
export async function getVideoMetadata(videoUrl: string): Promise<VideoMetadata> {
  return new Promise(async (resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'

    video.onloadedmetadata = async () => {
      try {
        // 使用新的音频检测函数
        const hasAudio = await checkVideoHasAudio(video)

        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          aspectRatio: video.videoWidth / video.videoHeight,
          hasAudio,
          frameRate: 30, // 默认为30fps，可以根据需要调整或通过其他方式检测
        })
      } catch (error) {
        console.error('获取音频信息失败:', error)
        // 即使音频检测失败，仍然返回其他元信息
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          aspectRatio: video.videoWidth / video.videoHeight,
          hasAudio: false,
          frameRate: 30,
        })
      }
    }

    video.onerror = () => reject(new Error('视频元信息加载失败'))
    video.src = videoUrl
  })
}

/**
 * 视频元信息管理Hook
 */
export function useVideoMetadata() {
  const isLoading = ref(false)
  const videoMetadata = ref<VideoMetadata | null>(null)

  /**
   * 加载视频元信息，带缓存机制
   * @param videoUrl 视频URL
   * @returns 视频元信息对象或null（加载失败）
   */
  async function loadMetadata(videoUrl: string): Promise<VideoMetadata | null> {
    if (!videoUrl) return null

    // 生成缓存键
    const cacheKey = `video_metadata_${videoUrl}`

    // 尝试从缓存获取
    try {
      const cached = await videoMetadataStore.getItem<{
        data: VideoMetadata
        timestamp: number
      }>(cacheKey)

      if (cached && Date.now() - cached.timestamp < VIDEO_FRAME_CACHE_EXPIRE) {
        videoMetadata.value = cached.data
        return cached.data
      }
    } catch (error) {
      console.warn('读取元信息缓存失败:', error)
    }

    // 缓存未命中，重新加载
    isLoading.value = true
    try {
      const metadata = await getVideoMetadata(videoUrl)
      videoMetadata.value = metadata

      // 存入缓存
      try {
        await videoMetadataStore.setItem(cacheKey, {
          data: metadata,
          timestamp: Date.now(),
        })
      } catch (error) {
        console.warn('保存元信息缓存失败:', error)
      }

      return metadata
    } catch (error) {
      console.error('加载视频元信息失败:', error)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 清理资源
   */
  function cleanupResources() {
    videoMetadata.value = null
    isLoading.value = false
  }

  return {
    videoMetadata,
    isLoading,
    loadMetadata,
    cleanupResources,
  }
}
