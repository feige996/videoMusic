// global.d.ts
interface HTMLVideoElement {
  /** 音频轨道列表（标准 API） */
  audioTracks: AudioTrackList
  /** 视频轨道列表（可选，按需添加） */
  videoTracks: VideoTrackList
  /** Firefox 非标准属性（兼容用，可选） */
  mozHasAudio?: boolean
  /** WebKit 非标准属性（兼容用，可选） */
  webkitAudioDecodedByteCount?: number
}

// 补充 AudioTrackList/AudioTrack 的类型（若 TS 未识别）
interface AudioTrackList extends EventTarget {
  length: number
  [index: number]: AudioTrack
  getTrackById(id: string): AudioTrack | null
  // 可选：添加事件相关方法
  addEventListener(type: 'change' | 'addtrack' | 'removetrack', listener: EventListener): void
  removeEventListener(type: 'change' | 'addtrack' | 'removetrack', listener: EventListener): void
}

interface AudioTrack {
  id: string
  kind: string
  label: string
  language: string
  enabled: boolean
}
