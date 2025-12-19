/**
 * 从视频中提取指定数量的帧
 * @param videoUrl 视频URL
 * @param frameCount 需要提取的帧数
 * @returns 视频帧信息+帧Canvas数组
 */
export async function getVideoFrames(
  videoUrl: string,
  frameCount: number,
): Promise<{
  frames: HTMLCanvasElement[]
  videoAspectRatio: number
  frameWidth: number
  frameHeight: number
  duration: number
}> {
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
// src/utils/videoFrame.ts
export async function createSpriteImage(
  frames: HTMLCanvasElement[],
  frameWidth: number,
  frameHeight: number,
  cols: number,
): Promise<{
  spriteUrl: string // 改为Base64字符串
  rows: number
  cols: number
}> {
  return new Promise((resolve) => {
    const rows = Math.ceil(frames.length / cols)
    const spriteWidth = cols * frameWidth
    const spriteHeight = rows * frameHeight

    const spriteCanvas = document.createElement('canvas')
    spriteCanvas.width = spriteWidth
    spriteCanvas.height = spriteHeight
    const ctx = spriteCanvas.getContext('2d')
    if (!ctx) {
      resolve({ spriteUrl: '', rows: 0, cols: 0 })
      return
    }

    // 绘制所有帧到精灵图
    frames.forEach((frame, index) => {
      const row = Math.floor(index / cols)
      const col = index % cols
      ctx.drawImage(frame, col * frameWidth, row * frameHeight)
    })

    // 关键：生成Base64字符串（替代Blob URL）
    // 用webp格式压缩体积，质量0.8（可调整）
    const spriteUrl = spriteCanvas.toDataURL('image/webp', 0.8)
    resolve({ spriteUrl, rows, cols })
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
