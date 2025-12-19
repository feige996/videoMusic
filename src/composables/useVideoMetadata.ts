import { ref } from 'vue'
import localforage from 'localforage'
import { VIDEO_FRAME_CACHE_EXPIRE } from '@/data/config'
import type { VideoMetadata } from '@/components/types'

/**
 * 检测视频是否有原声
 * 使用AudioContext尝试加载视频URL作为音频源
 * @param videoUrl 视频URL
 * @returns {Promise<boolean>} 是否有音频
 */
async function detectVideoAudio(videoUrl: string): Promise<boolean> {
  console.log('开始检测视频原声:', videoUrl)

  // 创建临时AudioContext用于检测
  let audioContext: AudioContext | null = null

  try {
    // 创建AudioContext实例
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass || typeof AudioContextClass !== 'function') {
      console.warn('浏览器不支持Web Audio API')
      return false
    }

    audioContext = new AudioContextClass()

    // 尝试获取音频数据，成功则表示有原声
    const response = await fetch(videoUrl)
    if (!response || !response.ok) {
      throw new Error(`HTTP错误! 状态码: ${response?.status || 'unknown'}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    if (!arrayBuffer) {
      throw new Error('无法获取音频数据')
    }

    // 尝试解码音频数据
    await audioContext.decodeAudioData(arrayBuffer)
    console.log('视频原声检测结果: 有原声')
    // 解码成功，说明视频包含可解码的音频数据
    return true
  } catch (error) {
    // 解码失败或其他错误，说明视频没有原声或原声无法解码
    console.log('视频原声检测结果: 无原声或无法解码', error)
    return false
  } finally {
    // 清理AudioContext资源
    if (audioContext) {
      try {
        audioContext.close()
      } catch (e) {
        console.error('关闭AudioContext失败:', e)
      }
    }
  }
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
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'

    video.onloadedmetadata = async () => {
      try {
        // 使用新的音频检测函数
        const hasAudio = await detectVideoAudio(videoUrl)

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
        console.log('读取元信息缓存成功:', cached.data)
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
        console.log('保存元信息缓存成功:', metadata)
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
