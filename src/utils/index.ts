/**
 * 视频取帧核心函数
 * @param {string} videoUrl 视频链接（需跨域允许）
 * @param {number} frameCount 目标帧数量
 * @returns {Promise<{frames: HTMLCanvasElement[], videoAspectRatio: number, frameWidth: number, frameHeight: number}>} 帧画布数组和视频信息
 */
export async function getVideoFrames(videoUrl: string, frameCount: number) {
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous' // 跨域配置（需服务端配合）
  video.preload = 'metadata'
  video.src = videoUrl

  // 1. 先获取视频总时长和实际宽高（等待元数据加载）
  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve
    video.onerror = reject
  })
  const totalDuration = video.duration
  if (totalDuration === Infinity) {
    // 处理HLS/MP4流的时长获取问题
    video.currentTime = 1e6 // 暴力触发时长计算
    await new Promise((resolve) => (video.onseeked = resolve))
  }

  // 获取视频实际宽高比
  const videoAspectRatio = video.videoWidth / video.videoHeight

  // 从配置中导入frameHeight，或使用默认值
  let frameHeight = 20 // 默认高度
  try {
    // 尝试动态导入配置，避免循环依赖
    const configModule = await import('@/data/config')
    if (configModule.frameHeight) {
      frameHeight = configModule.frameHeight
    }
  } catch (e) {
    console.warn('无法导入frameHeight配置，使用默认值:', e)
  }

  // 根据视频实际宽高比计算帧宽度
  const frameWidth = frameHeight * videoAspectRatio

  const frames = []
  const baseStep = totalDuration / frameCount // 基础时间步长

  // 2. 循环取帧（时间均分+失败重试）
  for (let i = 0; i < frameCount; i++) {
    let targetTime = i * baseStep
    let retryCount = 0
    let success = false

    while (retryCount < 3 && !success) {
      // 最多重试3次
      try {
        // 跳转到目标时间点
        video.currentTime = targetTime
        await new Promise((resolve) => {
          // 优先监听seeked（跳转完成），避免取到未渲染的帧
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked)
            resolve(true)
          }
          video.addEventListener('seeked', onSeeked)
        })

        // 绘制帧到canvas
        const canvas = document.createElement('canvas')
        canvas.width = frameWidth
        canvas.height = frameHeight
        const ctx = canvas.getContext('2d')!

        // 计算视频绘制位置以保持居中
        const videoAspectRatio = video.videoWidth / video.videoHeight
        const canvasAspectRatio = frameWidth / frameHeight

        let drawWidth, drawHeight, drawX, drawY

        if (videoAspectRatio > canvasAspectRatio) {
          // 视频更宽，按宽度缩放，上下留白
          drawWidth = frameWidth
          drawHeight = frameWidth / videoAspectRatio
          drawX = 0
          drawY = (frameHeight - drawHeight) / 2
        } else {
          // 视频更高，按高度缩放，左右留白
          drawHeight = frameHeight
          drawWidth = frameHeight * videoAspectRatio
          drawX = (frameWidth - drawWidth) / 2
          drawY = 0
        }

        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, frameWidth, frameHeight) // 绘制黑色背景
        ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight)

        frames.push(canvas)
        success = true
      } catch (e) {
        // 失败则偏移0.01s重试
        targetTime += 0.01
        retryCount++
      }
    }

    // 极端情况：多次重试失败，用前一帧兜底（避免空帧）
    if (!success) {
      frames.push(frames[frames.length - 1] || createEmptyFrame(frameWidth, frameHeight))
    }
  }

  // 返回帧数组和视频信息
  return {
    frames,
    videoAspectRatio,
    frameWidth,
    frameHeight,
  }
}

/**
 * 生成空帧（兜底用）
 * @param width 帧宽度
 * @param height 帧高度
 * @returns 空白帧画布
 */
function createEmptyFrame(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#333'
  ctx.fillRect(0, 0, width, height)

  // 添加占位文本
  ctx.fillStyle = '#666'
  ctx.font = `${Math.min(height / 3, 12)}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('无视频帧', width / 2, height / 2)

  return canvas
}

/**
 * 将帧数组合并为精灵图
 * @param {HTMLCanvasElement[]} frames 取到的帧画布数组
 * @param {number} width 单帧宽度
 * @param {number} height 单帧高度
 * @param {number} cols 精灵图列数，默认为1列
 * @returns {Promise<{spriteUrl: string, rows: number, cols: number}>} 精灵图的base64 URL和行列信息
 */
export async function createSpriteImage(
  frames: HTMLCanvasElement[],
  width: number,
  height: number,
  cols: number = 1,
) {
  // 计算行数和列数
  const totalFrames = frames.length
  const actualCols = Math.min(cols, totalFrames)
  const rows = Math.ceil(totalFrames / actualCols)

  // 创建精灵图画布
  const spriteCanvas = document.createElement('canvas')
  spriteCanvas.width = width * actualCols
  spriteCanvas.height = height * rows
  const ctx = spriteCanvas.getContext('2d')!

  // 逐帧绘制到精灵图（行列排列）
  frames.forEach((frame, index) => {
    // 计算当前帧的行列位置
    const row = Math.floor(index / actualCols)
    const col = index % actualCols

    // 绘制帧到对应位置
    ctx.drawImage(frame, col * width, row * height, width, height)
  })

  // 转换为base64（也可用Blob URL，体积更小）
  const spriteUrl = spriteCanvas.toDataURL('image/webp', 0.8) // webp格式压缩

  return {
    spriteUrl,
    rows,
    cols: actualCols,
  }
}

/**
 * 计算精灵图中每个帧的CSS定位参数
 * @param {number} frameIndex 帧索引
 * @param {number} cols 精灵图列数
 * @param {number} frameWidth 单帧宽度
 * @param {number} frameHeight 单帧高度
 * @returns {Object} 包含定位参数的对象
 */
export function calculateFramePosition(
  frameIndex: number,
  cols: number,
  frameWidth: number,
  frameHeight: number,
) {
  // 计算当前帧在精灵图中的行列位置
  const row = Math.floor(frameIndex / cols)
  const col = frameIndex % cols

  // 返回定位参数，用于CSS变量
  return {
    row,
    col,
    // CSS背景位置的百分比值（相对于精灵图尺寸）
    backgroundPositionX: `-${col * frameWidth}px`,
    backgroundPositionY: `-${row * frameHeight}px`,
    // 提供用于data属性的值，格式如："列,行"
    dataThumb: `${col},${row}`,
  }
}
