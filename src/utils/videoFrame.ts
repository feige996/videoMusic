/**
 * 视频帧提取结果类型
 */
export interface VideoFramesResult {
  frames: HTMLCanvasElement[]
  videoAspectRatio: number
  frameWidth: number
  frameHeight: number
  duration: number
}

/**
 * 从视频中提取指定数量的帧（串行版本 - 旧版）
 * @param videoUrl 视频URL
 * @param frameCount 需要提取的帧数
 * @returns 视频帧信息+帧Canvas数组
 */
export async function getVideoFramesSerial(
  videoUrl: string,
  frameCount: number,
): Promise<VideoFramesResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    // 解决跨域问题（根据实际场景调整）
    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'
    video.muted = true // 静音，避免自动播放限制
    video.playsInline = true // 内联播放（移动端）

    // 视频元信息加载完成
    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration
        const videoWidth = video.videoWidth
        const videoHeight = video.videoHeight
        const videoAspectRatio = videoWidth / videoHeight

        const frames: HTMLCanvasElement[] = []
        // 均匀提取帧（基于视频时长）
        for (let i = 0; i < frameCount; i++) {
          // 计算当前帧的时间点
          const time = (i / frameCount) * duration
          video.currentTime = time

          // 等待视频帧加载完成
          await new Promise((resolveSeek) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked)
              resolveSeek(null)
            }
            video.addEventListener('seeked', onSeeked)
          })

          // 创建Canvas并绘制帧
          const canvas = document.createElement('canvas')
          canvas.width = videoWidth
          canvas.height = videoHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) continue

          ctx.drawImage(video, 0, 0, videoWidth, videoHeight)
          frames.push(canvas)
        }

        resolve({
          frames,
          videoAspectRatio,
          frameWidth: videoWidth,
          frameHeight: videoHeight,
          duration,
        })
      } catch (e) {
        reject(new Error(`提取视频帧失败：${(e as Error).message}`))
      }
    }

    // 视频加载错误
    video.onerror = () => {
      reject(new Error('视频加载失败，请检查URL或跨域配置'))
    }

    // 设置视频源
    video.src = videoUrl
  })
}

/**
 * 从视频中提取指定数量的帧（并发版本 - 优化版）
 * @param videoUrl 视频URL
 * @param frameCount 需要提取的帧数
 * @param concurrency 并发数，默认为6
 * @returns 视频帧信息+帧Canvas数组
 */
export async function getVideoFramesConcurrent(
  videoUrl: string,
  frameCount: number,
  concurrency: number = 6,
): Promise<VideoFramesResult> {
  // 1. 获取视频元信息（复用一个video实例）
  const metaVideo = document.createElement('video')
  metaVideo.crossOrigin = 'anonymous'
  metaVideo.preload = 'metadata'
  metaVideo.muted = true
  metaVideo.playsInline = true

  await new Promise((resolve, reject) => {
    metaVideo.onloadedmetadata = resolve
    metaVideo.onerror = () => reject(new Error('视频元信息加载失败'))
    metaVideo.src = videoUrl
  })

  const duration = metaVideo.duration
  const videoWidth = metaVideo.videoWidth
  const videoHeight = metaVideo.videoHeight
  const videoAspectRatio = videoWidth / videoHeight

  // 释放元信息video
  metaVideo.removeAttribute('src')
  metaVideo.load()

  // 2. 创建并发池
  const poolInitStart = performance.now()
  const poolSize = Math.min(concurrency, frameCount)
  const videoPool: HTMLVideoElement[] = []

  for (let i = 0; i < poolSize; i++) {
    const v = document.createElement('video')
    v.crossOrigin = 'anonymous'
    v.muted = true
    v.playsInline = true
    v.preload = 'auto' // 显式设置 preload
    v.src = videoUrl
    // 显式加载并等待就绪
    // v.load() // src赋值会自动load，但我们可以监听事件确保
    videoPool.push(v)
  }

  // 等待所有video准备就绪，避免并发seek时卡住
  await Promise.all(
    videoPool.map(
      (v) =>
        new Promise((resolve) => {
          // 如果已经是 readyState >= 1 (HAVE_METADATA)，直接 resolve
          if (v.readyState >= 1) {
            resolve(null)
            return
          }
          v.onloadedmetadata = () => resolve(null)
          // 增加超时防止永久挂起
          setTimeout(() => resolve(null), 2000)
        }),
    ),
  )
  console.log(`并发池初始化耗时: ${(performance.now() - poolInitStart).toFixed(2)}ms`)

  // 3. 准备任务列表
  const tasks = Array.from({ length: frameCount }, (_, i) => ({
    index: i,
    time: (i / frameCount) * duration,
  }))

  const frames = new Array<HTMLCanvasElement>(frameCount)
  let taskIndex = 0

  // 4. 定义Worker函数
  const worker = async (video: HTMLVideoElement) => {
    while (taskIndex < tasks.length) {
      // 领取任务（原子操作模拟）
      const currentTaskIndex = taskIndex++
      if (currentTaskIndex >= tasks.length) break
      const task = tasks[currentTaskIndex]
      if (!task) break

      try {
        video.currentTime = task.time
        await new Promise((resolve, reject) => {
          let resolved = false
          const onSeeked = () => {
            if (resolved) return
            resolved = true
            video.removeEventListener('seeked', onSeeked)
            video.removeEventListener('error', onError)
            resolve(null)
          }
          const onError = () => {
            if (resolved) return
            resolved = true
            video.removeEventListener('seeked', onSeeked)
            video.removeEventListener('error', onError)
            reject(new Error(`Seek failed at ${task.time}`))
          }
          video.addEventListener('seeked', onSeeked)
          video.addEventListener('error', onError)

          // 增加seek超时保护
          setTimeout(() => {
            if (!resolved) {
              resolved = true
              video.removeEventListener('seeked', onSeeked)
              video.removeEventListener('error', onError)
              // 超时视为失败，或者 resolve null 跳过
              console.warn(`Seek timeout at ${task.time}`)
              resolve(null) // 这里选择 resolve 以继续执行下一个任务，避免死锁
            }
          }, 3000)
        })

        const canvas = document.createElement('canvas')
        canvas.width = videoWidth
        canvas.height = videoHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, videoWidth, videoHeight)
          frames[task.index] = canvas
        }
      } catch (e) {
        console.warn(`Frame ${task.index} extraction failed:`, e)
        // 失败补空帧或重试逻辑可在此添加
      }
    }
  }

  // 5. 启动并发
  await Promise.all(videoPool.map((v) => worker(v)))

  // 6. 清理资源
  videoPool.forEach((v) => {
    v.removeAttribute('src')
    v.load()
  })

  return {
    frames,
    videoAspectRatio,
    frameWidth: videoWidth,
    frameHeight: videoHeight,
    duration,
  }
}

// 默认导出优化后的并发版本
export const getVideoFrames = getVideoFramesConcurrent

// src/utils/videoFrame.ts
/**
 * 创建视频帧精灵图
 * @param frames 视频帧Canvas数组
 * @param frameWidth 单帧宽度
 * @param frameHeight 单帧高度
 * @param cols 精灵图列数
 * @returns 精灵图信息（包含Base64 URL和行列信息）
 */
export async function createSpriteImage(
  frames: HTMLCanvasElement[],
  frameWidth: number,
  frameHeight: number,
  cols: number,
): Promise<{
  spriteUrl: string // Base64字符串
  rows: number
  cols: number
}> {
  return new Promise((resolve) => {
    // 1. 参数验证
    if (!frames || frames.length === 0) {
      console.error('createSpriteImage: 无效的frames数组')
      resolve({ spriteUrl: '', rows: 0, cols: 0 })
      return
    }

    // 防止无效尺寸
    frameWidth = Math.max(1, frameWidth || 1)
    frameHeight = Math.max(1, frameHeight || 1)
    cols = Math.max(1, Math.min(cols || 1, frames.length))

    // 2. 计算精灵图尺寸
    const rows = Math.ceil(frames.length / cols)
    const spriteWidth = cols * frameWidth
    const spriteHeight = rows * frameHeight

    console.log(
      `createSpriteImage: 帧数=${frames.length}, 尺寸=${spriteWidth}x${spriteHeight}, 行列=${rows}x${cols}`,
    )

    // 3. 创建并配置Canvas
    const spriteCanvas = document.createElement('canvas')
    spriteCanvas.width = spriteWidth
    spriteCanvas.height = spriteHeight

    const ctx = spriteCanvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      console.error('createSpriteImage: 无法获取Canvas上下文')
      resolve({ spriteUrl: '', rows: 0, cols: 0 })
      return
    }

    // 4. 预填充画布为透明背景
    ctx.clearRect(0, 0, spriteWidth, spriteHeight)

    // 5. 统计有效帧数
    let validFramesCount = 0

    // 6. 绘制所有有效帧到精灵图
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i]
      if (!frame) {
        console.warn(`createSpriteImage: 跳过空帧索引=${i}`)
        continue
      }

      try {
        const row = Math.floor(i / cols)
        const col = i % cols
        const x = col * frameWidth
        const y = row * frameHeight

        // 检查帧尺寸
        if (frame.width === 0 || frame.height === 0) {
          console.warn(`createSpriteImage: 帧索引=${i} 尺寸无效: ${frame.width}x${frame.height}`)
          continue
        }

        ctx.drawImage(frame, x, y, frameWidth, frameHeight)
        validFramesCount++
      } catch (error) {
        console.error(`createSpriteImage: 绘制帧索引=${i}失败:`, error)
      }
    }

    console.log(`createSpriteImage: 有效帧数=${validFramesCount}/${frames.length}`)

    // 7. 生成Base64 URL
    try {
      // 如果没有绘制任何有效帧，返回空URL
      if (validFramesCount === 0) {
        console.error('createSpriteImage: 没有绘制任何有效帧')
        resolve({ spriteUrl: '', rows: 0, cols: 0 })
        return
      }

      // 生成webp格式的Base64字符串
      const spriteUrl = spriteCanvas.toDataURL('image/webp', 0.1)

      // 验证生成的URL是否有效
      if (!spriteUrl || spriteUrl === 'data:,') {
        console.error('createSpriteImage: 生成的spriteUrl无效')
        resolve({ spriteUrl: '', rows: 0, cols: 0 })
        return
      }

      console.log(`createSpriteImage: 成功生成精灵图，URL长度=${spriteUrl.length}`)
      resolve({ spriteUrl, rows, cols })
    } catch (error) {
      console.error('createSpriteImage: 生成Base64失败:', error)
      resolve({ spriteUrl: '', rows: 0, cols: 0 })
    }
  })
}

/**
 * 计算指定索引的帧在精灵图中的位置（完整修复版）
 * @param index 帧在全量帧池中的索引
 * @param cols 精灵图的列数
 * @param frameWidth 单帧原始宽度
 * @param frameHeight 单帧原始高度
 * @param totalFrames 全量帧池总数（可选，用于防越界）
 * @returns 帧的行列位置+唯一标识
 */
export function calculateFramePosition(
  index: number,
  cols: number,
  frameWidth: number,
  frameHeight: number,
  totalFrames?: number,
): {
  row: number
  col: number
  dataThumb: string
} {
  // 1. 基础参数校验（避免NaN/负数）
  if (isNaN(index) || index < 0) index = 0
  if (isNaN(cols) || cols < 1) cols = 1
  if (isNaN(frameWidth) || frameWidth < 1) frameWidth = 1
  if (isNaN(frameHeight) || frameHeight < 1) frameHeight = 1

  // 2. 索引防越界（关键：避免超过全量帧数）
  if (totalFrames && !isNaN(totalFrames) && totalFrames > 0) {
    index = Math.min(index, totalFrames - 1)
  }

  // 3. 核心计算：行列位置
  const row = Math.floor(index / cols) // 行 = 索引 / 列数（向下取整）
  const col = index % cols // 列 = 索引 % 列数（取余）

  // 4. 生成唯一标识（便于调试/定位问题）
  const dataThumb = `frame_${index}_row${row}_col${col}_${frameWidth}x${frameHeight}`

  return {
    row,
    col,
    dataThumb,
  }
}
