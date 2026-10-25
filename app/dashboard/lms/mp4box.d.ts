declare module 'mp4box' {
  export interface MP4BoxTrack {
    id: number
    name?: string
    codec: string
    track_width?: number
    track_height?: number
    duration?: number
    timescale?: number
    bitrate?: number
    video?: {
      width: number
      height: number
    }
  }

  export interface MP4BoxInfo {
    videoTracks: MP4BoxTrack[]
    audioTracks: MP4BoxTrack[]
    duration: number
    timescale: number
    isFragmented: boolean
    hasMoov: boolean
  }

  export interface MP4BoxFile {
    onError?: (e: string | Error) => void
    onReady?: (info: MP4BoxInfo) => void
    appendBuffer(buffer: ArrayBuffer): number
    flush(): void
    nextParsePosition: number
  }

  export function createFile(keepBuffers?: boolean): MP4BoxFile

  const mp4box: {
    createFile: (keepBuffers?: boolean) => MP4BoxFile
  }

  export default mp4box
}
