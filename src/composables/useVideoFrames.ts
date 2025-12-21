import { ref, type Ref, onUnmounted } from 'vue'
import { frameHeight, VIDEO_FRAME_CACHE_EXPIRE, SPRITE_CACHE_EXPIRE } from '@/data/config'
import { throttle } from 'lodash-es'
import localforage from 'localforage'
import type {
  SpriteInfo,
  CachedFullFrameData,
  CachedFullSpriteData,
  FrameItem,
} from '@/components/types'
import type { VideoMetadata } from '@/components/types'
import {
  getVideoFrames,
  getVideoFramesSerial,
  getVideoFramesConcurrent,
  createSpriteImage,
  calculateFramePosition,
} from '@/utils/videoFrame'
import { setItemWithQuotaHandling } from '@/utils/storageHelper'

type SpriteRender = {
  url: string
  frameWidth: number
  frameHeight: number
  cols: number
  rows: number
  scale: number
}

export function useVideoFrames(params: {
  videoUrl: Ref<string>
  frameContainer: Ref<HTMLElement | null>
  frameData: Ref<FrameItem[]>
  spriteData: Ref<SpriteRender | null>
  isLoading: Ref<boolean>
  log?: boolean
  preloadedMetadata?: Ref<VideoMetadata | null | undefined>
  useConcurrent?: Ref<boolean>
}) {
  const {
    videoUrl: videoUrlRef,
    frameContainer,
    frameData,
    spriteData,
    isLoading,
    preloadedMetadata,
    useConcurrent,
  } = params
  const logEnabled = params.log === true
  const print = (message: string) => {
    if (logEnabled) console.log(message)
  }
  const MAX_SCREEN_WIDTH = window.screen.width * 1.2
  const FRAME_SURPLUS = 5

  const videoFrameStore = localforage.createInstance({
    name: 'VideoFrameStore',
    storeName: 'videoFrames',
    driver: localforage.INDEXEDDB,
    version: 1.0,
  })

  const fullFrameMeta = ref<CachedFullFrameData | null>(null)
  // 保存原始帧数据，用于直接显示模式
  const originalFrames = ref<HTMLCanvasElement[]>([])

  /**
   * 计算需要提取的视频帧数
   * 优化点：添加安全宽高比检查，避免无效计算
   * @param videoAspectRatio 视频宽高比
   * @returns 需要提取的总帧数
   */
  function calculateTotalFrames(videoAspectRatio: number): number {
    // 防止无效的宽高比导致计算错误
    const safeAspectRatio = Math.max(0.1, Math.min(videoAspectRatio, 10))
    const singleFrameWidth = frameHeight * safeAspectRatio

    // 基础帧数计算
    const baseFrames = Math.ceil(MAX_SCREEN_WIDTH / singleFrameWidth)
    const totalFrames = baseFrames + FRAME_SURPLUS

    // 确保至少有10帧且不超过合理上限
    return Math.max(Math.min(totalFrames, 50), 10)
  }

  async function initPreciseFramePool() {
    if (fullFrameMeta.value) return fullFrameMeta.value

    const isConcurrent = useConcurrent?.value ?? true
    const modeSuffix = isConcurrent ? 'concurrent' : 'serial'
    // 添加版本标识，确保使用新的帧提取逻辑而不使用旧缓存
    const version = 'v2' // 版本升级以避免使用旧缓存
    const videoMetaCacheKey = `video_meta_${version}_${videoUrlRef.value}_${frameHeight}_${modeSuffix}`
    const spriteCacheKey = `video_sprite_${version}_${videoUrlRef.value}_${frameHeight}_${modeSuffix}`
    const originalFramesCacheKey = `video_original_frames_${version}_${videoUrlRef.value}_${frameHeight}_${modeSuffix}`

    let cachedMeta: CachedFullFrameData | null = null
    try {
      const storedMeta = await videoFrameStore.getItem<CachedFullFrameData>(videoMetaCacheKey)
      if (storedMeta && Date.now() - storedMeta.timestamp < VIDEO_FRAME_CACHE_EXPIRE) {
        cachedMeta = storedMeta
      } else if (storedMeta) {
        await videoFrameStore.removeItem(videoMetaCacheKey)
      }
    } catch {}

    let cachedSprite: CachedFullSpriteData | null = null
    try {
      const storedSprite = await videoFrameStore.getItem<CachedFullSpriteData>(spriteCacheKey)
      if (storedSprite && Date.now() - storedSprite.timestamp < SPRITE_CACHE_EXPIRE) {
        cachedSprite = storedSprite
      } else if (storedSprite) {
        await videoFrameStore.removeItem(spriteCacheKey)
      }
    } catch {}

    // 尝试从缓存加载原始帧数据
    let cachedOriginalFrames: HTMLCanvasElement[] | null = null
    try {
      print('尝试加载原始帧缓存: ' + originalFramesCacheKey)
      const storedFrames = await videoFrameStore.getItem<Blob[]>(originalFramesCacheKey)

      if (storedFrames && storedFrames.length > 0) {
        const cacheAge = Date.now() - (storedFrames[0] as any)?.timestamp || 0
        print(`找到原始帧缓存，数量: ${storedFrames.length}, 缓存年龄: ${cacheAge}ms`)

        if (cacheAge < VIDEO_FRAME_CACHE_EXPIRE) {
          print('缓存未过期，恢复原始帧数据')
          // 恢复原始帧数据
          cachedOriginalFrames = await Promise.all(
            storedFrames.map(async (frameBlob, index) => {
              const canvas = document.createElement('canvas')
              const img = new Image()
              img.src = URL.createObjectURL(frameBlob as unknown as Blob)
              await new Promise<void>((resolve) => {
                img.onload = () => {
                  canvas.width = img.width
                  canvas.height = img.height
                  const ctx = canvas.getContext('2d')
                  if (ctx) ctx.drawImage(img, 0, 0)
                  URL.revokeObjectURL(img.src)
                  resolve()
                }
              })
              return canvas
            }),
          )
          print(`成功恢复 ${cachedOriginalFrames.length} 个原始帧数据`)
        } else {
          print('缓存已过期，移除旧缓存')
          await videoFrameStore.removeItem(originalFramesCacheKey)
        }
      } else {
        print('未找到原始帧缓存')
      }
    } catch (error) {
      print('加载原始帧缓存失败: ' + error)
    }

    if (cachedMeta && cachedSprite) {
      print('缓存命中')
      fullFrameMeta.value = cachedMeta
      // 如果有缓存的原始帧数据，直接使用
      if (cachedOriginalFrames) {
        originalFrames.value = cachedOriginalFrames
      }
      // 确保缓存命中时isLoading为false
      isLoading.value = false
      return { meta: cachedMeta, sprite: cachedSprite.spriteInfo }
    }

    isLoading.value = true
    try {
      const t0 = performance.now()
      const getVideoFramesFn = isConcurrent ? getVideoFramesConcurrent : getVideoFramesSerial
      const modeName = isConcurrent ? '并发模式' : '串行模式'

      // 检查是否有预加载的元信息
      let videoAspectRatio: number
      let duration: number
      let frameWidth: number
      let frameHeight: number

      if (preloadedMetadata?.value) {
        // 使用预加载的元信息
        const {
          aspectRatio,
          duration: videoDuration,
          width: vWidth,
          height: vHeight,
        } = preloadedMetadata.value
        videoAspectRatio = aspectRatio
        duration = videoDuration
        frameWidth = vWidth
        frameHeight = vHeight
        print('使用预加载元信息')
      } else {
        print('自己获取元信息')
        // 没有预加载元信息时，获取基本视频信息
        const basicVideoInfo = await getVideoFramesFn(videoUrlRef.value, 1)
        videoAspectRatio = basicVideoInfo.videoAspectRatio
        duration = basicVideoInfo.duration
        frameWidth = basicVideoInfo.frameWidth
        frameHeight = basicVideoInfo.frameHeight
      }

      const t1 = performance.now()
      print(`元信息耗时: ${(t1 - t0).toFixed(2)}ms`)
      const totalFrames = calculateTotalFrames(videoAspectRatio)
      const t2 = performance.now()
      print(`开始提取帧 [${modeName}]...`)
      const fullVideoInfo = await getVideoFramesFn(videoUrlRef.value, totalFrames)
      const t3 = performance.now()
      print(`抽取帧耗时: ${(t3 - t2).toFixed(2)}ms, 帧数: ${totalFrames}`)

      const spriteCols = Math.min(totalFrames, 10)
      const t4 = performance.now()
      const fullSpriteInfo = await createSpriteImage(
        fullVideoInfo.frames,
        fullVideoInfo.frameWidth,
        fullVideoInfo.frameHeight,
        spriteCols,
      )
      const t5 = performance.now()
      print(`合成雪碧图耗时: ${(t5 - t4).toFixed(2)}ms`)

      const metaData: CachedFullFrameData = {
        videoAspectRatio: fullVideoInfo.videoAspectRatio,
        frameWidth: fullVideoInfo.frameWidth,
        frameHeight: fullVideoInfo.frameHeight,
        totalFrames,
        duration,
        timestamp: Date.now(),
        hasAudio: preloadedMetadata?.value?.hasAudio || false,
      }
      // 使用带存储容量处理的工具函数保存数据
      await setItemWithQuotaHandling(videoFrameStore, videoMetaCacheKey, metaData)
      fullFrameMeta.value = metaData

      const spriteDataCache: CachedFullSpriteData = {
        spriteInfo: fullSpriteInfo,
        videoAspectRatio: fullVideoInfo.videoAspectRatio,
        frameWidth: fullVideoInfo.frameWidth,
        frameHeight: fullVideoInfo.frameHeight,
        totalFrames,
        timestamp: Date.now(),
      }
      await setItemWithQuotaHandling(videoFrameStore, spriteCacheKey, spriteDataCache)

      // 保存原始帧数据供直接显示模式使用
      originalFrames.value = [...fullVideoInfo.frames]

      // 缓存原始帧数据，使用带版本标识的键名
      const originalFramesCacheKey = `video_original_frames_${version}_${videoUrlRef.value}_${frameHeight}_${modeSuffix}`
      try {
        print(`开始缓存 ${fullVideoInfo.frames.length} 个原始帧数据`)
        // 将canvas转换为可缓存的数据格式
        const frameBlobs = await Promise.all(
          fullVideoInfo.frames.map(async (frame) => {
            return new Promise<Blob>((resolve) => {
              frame.toBlob((blob) => {
                if (blob) {
                  // 添加时间戳用于缓存过期检查
                  const blobWithTimestamp = new Blob([blob], { type: blob.type })
                  ;(blobWithTimestamp as any).timestamp = Date.now()
                  resolve(blobWithTimestamp)
                } else {
                  resolve(new Blob())
                }
              })
            })
          }),
        )
        print(`转换完成，准备缓存 ${frameBlobs.length} 个帧数据块`)
        // 尝试缓存原始帧数据
        await setItemWithQuotaHandling(videoFrameStore, originalFramesCacheKey, frameBlobs)
        print('原始帧数据缓存成功')
      } catch (error) {
        print('缓存原始帧数据失败: ' + error)
      }

      // 延迟清理不再需要的帧数据引用，但保留originalFrames中的原始数据
      setTimeout(() => {
        // 清理fullVideoInfo中的帧数据，避免内存泄漏
        fullVideoInfo.frames.forEach((frame, index) => {
          // 只清理不在originalFrames中的帧，或者如果是同一个引用则保留
          if (frame && frame !== originalFrames.value[index]) {
            frame.width = 0
            frame.height = 0
          }
        })
      }, 1000) // 稍微延迟一点，确保所有渲染都完成

      return { meta: metaData, sprite: fullSpriteInfo }
    } finally {
      isLoading.value = false
    }
  }

  async function sampleFramesFromPool() {
    const container = frameContainer.value
    if (!container || !fullFrameMeta.value) return

    const {
      videoAspectRatio,
      totalFrames,
      frameWidth: originalFrameWidth,
      frameHeight: originalFrameHeight,
    } = fullFrameMeta.value
    const containerWidth = container.clientWidth
    const containerHeight = frameHeight

    const displayFrameWidth = containerHeight * videoAspectRatio
    const displayFrameHeight = containerHeight
    const scale = displayFrameHeight / originalFrameHeight

    const needFrameCount = Math.max(1, Math.ceil(containerWidth / displayFrameWidth))
    const actualNeed = Math.min(needFrameCount, totalFrames)

    // 计算等距采样的帧索引
    const selectedIndexes: number[] = []

    // 确保分母不为0（当只需要1帧时）
    const denominator = Math.max(1, actualNeed - 1)

    for (let i = 0; i < actualNeed; i++) {
      // 计算当前帧在采样序列中的相对位置 (0 到 1 之间)
      const normalizedPosition = i / denominator

      // 将相对位置映射到总帧数范围内，计算出实际的帧索引
      // 减1是因为索引从0开始，Math.floor确保得到整数索引
      const frameIndex = Math.floor(normalizedPosition * (totalFrames - 1))

      selectedIndexes.push(frameIndex)
    }
    console.log('needFrameCount', needFrameCount, totalFrames)
    console.log('actualNeed', actualNeed)
    console.log('selectedIndexes', selectedIndexes)

    const isConcurrent = useConcurrent?.value ?? true
    const modeSuffix = isConcurrent ? 'concurrent' : 'serial'
    // 添加版本标识，确保与initPreciseFramePool中使用的键名一致
    const version = 'v2'
    const spriteCacheKey = `video_sprite_${version}_${videoUrlRef.value}_${frameHeight}_${modeSuffix}`
    let spriteInfo: SpriteInfo | null = null
    try {
      const storedSprite = await videoFrameStore.getItem<CachedFullSpriteData>(spriteCacheKey)
      if (!storedSprite) return
      spriteInfo = storedSprite.spriteInfo
    } catch {
      return
    }
    if (!spriteInfo) return

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
        scale,
      })
    })

    frameData.value = framesData
    spriteData.value = {
      url: spriteInfo.spriteUrl || '',
      frameWidth: originalFrameWidth,
      frameHeight: originalFrameHeight,
      cols: spriteInfo.cols,
      rows: spriteInfo.rows,
      scale,
    }

    // Object.assign(container.style, {
    //   width: '100%',
    //   height: `${containerHeight}px`,
    //   display: 'flex',
    //   overflowX: 'auto',
    //   gap: '0',
    //   scrollbarWidth: 'thin',
    // })
    print(`采样完成: 帧数 ${actualNeed}, 比例 ${scale.toFixed(3)}`)
  }

  const throttledSample = throttle(async () => {
    if (isLoading.value) return
    await sampleFramesFromPool()
  }, 16)

  function handleResize() {
    if (frameContainer.value) {
      throttledSample()
    }
  }

  async function initializeVideoFrames() {
    if (!videoUrlRef.value) return
    try {
      await initPreciseFramePool()
      await sampleFramesFromPool()
    } catch {
      cleanupResources()
    }
  }

  function cleanupResources() {
    print('执行资源清理，保留原始帧数据')
    if (frameData.value && frameData.value.length > 0) {
      frameData.value = []
    }
    fullFrameMeta.value = null
    spriteData.value = null
    // 不再清空originalFrames，而是在重新初始化时自动更新
    // 这样可以避免刷新页面后数据丢失
    print(`清理后原始帧数量: ${originalFrames.value.length}`)
    // originalFrames.value = [] // 注释掉这行，保留原始帧数据
    type HasCancel = { cancel: () => void }
    if (throttledSample && typeof (throttledSample as HasCancel).cancel === 'function') {
      ;(throttledSample as HasCancel).cancel()
    }
  }

  /**
   * 初始化钩子
   * 在hook创建时自动添加窗口resize事件监听
   * 在组件卸载时自动清理资源
   */
  function init() {
    // 添加窗口resize事件监听
    window.addEventListener('resize', handleResize)

    // 使用onUnmounted钩子自动处理清理逻辑
    onUnmounted(() => {
      window.removeEventListener('resize', handleResize)
      cleanupResources()
    })
  }

  // 自动调用init函数设置事件监听和清理逻辑
  init()

  return {
    initializeVideoFrames,
    cleanupResources,
    handleResize,
    originalFrames, // 暴露原始帧数据供组件使用
    fullFrameMeta, // 暴露帧元数据
  }
}
