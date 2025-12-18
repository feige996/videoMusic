/**
 * 视频取帧核心函数
 * @param {string} videoUrl 视频链接（需跨域允许）
 * @param {number} frameCount 目标帧数量（比如50）
 * @returns {Promise<HTMLCanvasElement[]>} 取到的帧画布数组
 */
export async function getVideoFrames(videoUrl: string, frameCount: number) {
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous' // 跨域配置（需服务端配合）
  video.preload = 'metadata'
  video.src = videoUrl

  // 1. 先获取视频总时长（等待元数据加载）
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
        canvas.width = 1000 // 单帧宽度（匹配你的容器）
        canvas.height = 20 // 单帧高度
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
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
      frames.push(frames[frames.length - 1] || createEmptyFrame())
    }
  }

  return frames
}

// 生成空帧（兜底用）
function createEmptyFrame() {
  const canvas = document.createElement('canvas')
  canvas.width = 1000
  canvas.height = 20
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#eee'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * 将帧数组合并为精灵图
 * @param {HTMLCanvasElement[]} frames 取到的帧画布数组
 * @param {number} width 单帧宽度
 * @param {number} height 单帧高度
 * @returns {Promise<string>} 精灵图的base64 URL
 */
export async function createSpriteImage(
  frames: HTMLCanvasElement[],
  width: number,
  height: number,
) {
  const spriteCanvas = document.createElement('canvas')
  // 精灵图尺寸：宽度=单帧宽度，高度=单帧高度*帧数
  spriteCanvas.width = width
  spriteCanvas.height = height * frames.length
  const ctx = spriteCanvas.getContext('2d')!

  // 逐帧绘制到精灵图（竖排）
  frames.forEach((frame, index) => {
    ctx.drawImage(frame, 0, index * height, width, height)
  })

  // 转换为base64（也可用Blob URL，体积更小）
  return new Promise<string>((resolve) => {
    // toDataURL直接返回base64字符串，不接受回调
    resolve(spriteCanvas.toDataURL('image/webp', 0.8)) // webp格式压缩
  })
}
