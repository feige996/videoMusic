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

/**
 * 生成精灵图（将多个Canvas帧合并为一张图片）
 * @param frames 帧Canvas数组
 * @param frameWidth 单帧宽度
 * @param frameHeight 单帧高度
 * @param cols 精灵图列数
 * @returns 精灵图URL+行列数
 */
export async function createSpriteImage(
  frames: HTMLCanvasElement[],
  frameWidth: number,
  frameHeight: number,
  cols: number,
): Promise<{
  spriteUrl: string
  rows: number
  cols: number
}> {
  return new Promise((resolve) => {
    // 计算精灵图行列数
    const rows = Math.ceil(frames.length / cols)
    const spriteWidth = cols * frameWidth
    const spriteHeight = rows * frameHeight

    // 创建精灵图Canvas
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

    // 将Canvas转为Base64 URL（支持webp格式，压缩体积）
    spriteCanvas.toBlob(
      (blob) => {
        if (!blob) {
          // 降级为png格式
          const spriteUrl = spriteCanvas.toDataURL('image/png')
          resolve({ spriteUrl, rows, cols })
          return
        }
        const spriteUrl = URL.createObjectURL(blob)
        resolve({ spriteUrl, rows, cols })
      },
      'image/webp',
      0.8, // 压缩质量（0-1）
    )
  })
}

/**
 * 计算指定索引的帧在精灵图中的位置
 * @param index 帧索引
 * @param cols 精灵图列数
 * @param frameWidth 单帧宽度
 * @param frameHeight 单帧高度
 * @returns 帧的行列位置+标识
 */
export function calculateFramePosition(
  index: number,
  cols: number,
  frameWidth: number,
  frameHeight: number,
): {
  row: number
  col: number
  dataThumb: string
} {
  const row = Math.floor(index / cols)
  const col = index % cols
  return {
    row,
    col,
    dataThumb: `frame_${index}_${row}_${col}`,
  }
}
