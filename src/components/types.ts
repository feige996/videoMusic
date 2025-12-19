// ===================== 类型定义 =====================

/**
 * 视频元数据接口
 */
export interface VideoMetadata {
  duration: number // 视频时长（秒）
  width: number // 视频宽度
  height: number // 视频高度
  aspectRatio: number // 宽高比
  hasAudio: boolean // 是否包含音频轨道
  frameRate: number // 视频帧率
}
export interface VideoFramesInfo {
  frames: HTMLCanvasElement[]
  videoAspectRatio: number
  frameWidth: number
  frameHeight: number
  duration: number // 视频时长
}

export interface SpriteInfo {
  spriteUrl: string
  rows: number
  cols: number
}

export interface CachedFullFrameData {
  videoAspectRatio: number
  frameWidth: number
  frameHeight: number
  totalFrames: number // 精准计算的全量帧数
  duration: number
  timestamp: number
}

export interface CachedFullSpriteData {
  spriteInfo: SpriteInfo
  videoAspectRatio: number
  frameWidth: number
  frameHeight: number
  totalFrames: number
  timestamp: number
}

export interface FrameItem {
  index: number
  row: number
  col: number
  dataThumb: string
  displayWidth: number
  displayHeight: number
  scale: number // 新增：传递缩放比例到模板
}
