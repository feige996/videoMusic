// ===================== 类型定义 =====================
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
