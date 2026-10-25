import * as MP4Box from 'mp4box'
import type { MP4BoxInfo } from 'mp4box'

export type VideoCodec = 'h264' | 'hevc' | 'av1' | 'vp8' | 'vp9' | 'prores' | 'other'

export interface VideoInspectionResult {
  valid: boolean
  duration: number
  width: number
  height: number
  codec: VideoCodec
  audioCodec: string | null
  summary: string
  blockingError: string | null
  warning: string | null
  canOverride: boolean
  requiresOverride: boolean
  rawVideoCodec?: string
}

export function formatDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds) || seconds <= 0) return '0:00'
  const s = Math.round(seconds)
  const hrs = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1000) {
    return `${(mb / 1024).toFixed(2)} GB`
  }
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}

export function formatCodecLabel(codec: VideoCodec): string {
  switch (codec) {
    case 'h264':
      return 'H.264'
    case 'hevc':
      return 'HEVC (H.265)'
    case 'av1':
      return 'AV1'
    case 'vp8':
      return 'VP8'
    case 'vp9':
      return 'VP9'
    case 'prores':
      return 'ProRes'
    default:
      return 'Unknown codec'
  }
}

function mapVideoCodec(raw: string): VideoCodec {
  const c = (raw || '').toLowerCase().trim()
  if (c.startsWith('avc1')) return 'h264'
  if (c.startsWith('hvc1') || c.startsWith('hev1')) return 'hevc'
  if (c.startsWith('av01')) return 'av1'
  if (c.startsWith('vp09')) return 'vp9'
  if (
    c.startsWith('apch') ||
    c.startsWith('apcn') ||
    c.startsWith('apcs') ||
    c.startsWith('apco') ||
    c.startsWith('ap4h')
  ) {
    return 'prores'
  }
  return 'other'
}

/**
 * Reads track metadata using MP4Box via incremental slicing.
 */
async function parseMp4Tracks(file: File): Promise<{
  videoCodec: VideoCodec
  rawVideoCodec?: string
  audioCodec: string | null
}> {
  return new Promise((resolve) => {
    let resolved = false
    const mp4boxfile = MP4Box.createFile()

    mp4boxfile.onError = () => {
      if (!resolved) {
        resolved = true
        resolve({ videoCodec: 'other', audioCodec: null })
      }
    }

    mp4boxfile.onReady = (info: MP4BoxInfo) => {
      if (resolved) return
      resolved = true

      const vTrack = info.videoTracks?.[0]
      const rawCodec = vTrack?.codec || ''
      const mapped = mapVideoCodec(rawCodec)

      const aTrack = info.audioTracks?.[0]
      const rawAudio = (aTrack?.codec || '').toLowerCase()
      const audioCodec = rawAudio.startsWith('mp4a') ? 'aac' : rawAudio || null

      resolve({
        videoCodec: mapped,
        rawVideoCodec: rawCodec,
        audioCodec,
      })
    }

    const sliceSize = 2 * 1024 * 1024 // 2 MB
    let offset = 0

    const readNextSlice = async () => {
      if (resolved) return
      if (offset >= file.size) {
        try {
          mp4boxfile.flush()
        } catch {
          // ignore
        }
        if (!resolved) {
          resolved = true
          resolve({ videoCodec: 'other', audioCodec: null })
        }
        return
      }

      const end = Math.min(offset + sliceSize, file.size)
      try {
        const sliceBlob = file.slice(offset, end)
        const arrayBuffer = await sliceBlob.arrayBuffer()
        ;(arrayBuffer as unknown as { fileStart: number }).fileStart = offset

        let nextOffset: number | undefined
        try {
          nextOffset = mp4boxfile.appendBuffer(arrayBuffer)
        } catch {
          // ignore parse errors and proceed to next offset
        }

        if (resolved) return

        if (typeof nextOffset === 'number' && nextOffset > offset) {
          offset = nextOffset
        } else {
          offset = end
        }

        setTimeout(readNextSlice, 0)
      } catch {
        if (!resolved) {
          resolved = true
          resolve({ videoCodec: 'other', audioCodec: null })
        }
      }
    }

    readNextSlice()
  })
}

/**
 * Runs browser playability test via a hidden HTML5 video element.
 */
function playabilityTest(file: File): Promise<{
  playable: boolean
  duration: number
  width: number
  height: number
  error?: string
}> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    let cleanedUp = false
    const objectUrl = URL.createObjectURL(file)

    const cleanup = () => {
      if (cleanedUp) return
      cleanedUp = true
      clearTimeout(timer)
      video.onloadedmetadata = null
      video.onerror = null
      URL.revokeObjectURL(objectUrl)
      video.src = ''
    }

    const timer = setTimeout(() => {
      cleanup()
      resolve({
        playable: false,
        duration: 0,
        width: 0,
        height: 0,
        error: 'Video inspection timed out after 10s. The file may be corrupt or unreadable.',
      })
    }, 10000)

    video.onloadedmetadata = () => {
      const dur = isFinite(video.duration) ? Math.round(video.duration) : 0
      const width = video.videoWidth || 0
      const height = video.videoHeight || 0
      cleanup()

      if (width <= 0 || height <= 0) {
        resolve({
          playable: false,
          duration: dur,
          width,
          height,
          error: 'Video file has zero dimensions and cannot be played.',
        })
        return
      }

      if (dur <= 0) {
        resolve({
          playable: false,
          duration: dur,
          width,
          height,
          error: 'Video has no valid duration.',
        })
        return
      }

      resolve({
        playable: true,
        duration: dur,
        width,
        height,
      })
    }

    video.onerror = () => {
      cleanup()
      resolve({
        playable: false,
        duration: 0,
        width: 0,
        height: 0,
        error: 'The file could not be decoded as a video.',
      })
    }

    video.src = objectUrl
  })
}

/**
 * Main inspection function to run before upload.
 */
export async function inspectVideoFile(file: File): Promise<VideoInspectionResult> {
  const isWebm = file.type === 'video/webm' || file.name.toLowerCase().endsWith('.webm')

  // Run playability test and track parsing
  const playabilityPromise = playabilityTest(file)
  const trackPromise = isWebm
    ? Promise.resolve({ videoCodec: 'vp9' as VideoCodec, rawVideoCodec: 'vp9', audioCodec: null })
    : parseMp4Tracks(file)

  const [playback, tracks] = await Promise.all([playabilityPromise, trackPromise])

  const codec = tracks.videoCodec
  const duration = playback.duration
  const width = playback.width
  const height = playback.height
  const audioCodec = tracks.audioCodec

  // Duration / Playability checks
  if (!playback.playable || width <= 0 || height <= 0) {
    return {
      valid: false,
      duration,
      width,
      height,
      codec,
      audioCodec,
      summary: `${formatCodecLabel(codec)} · ${width}x${height} · ${formatDuration(duration)} · ${formatFileSize(file.size)}`,
      blockingError: playback.error || 'This video file is unreadable and cannot be uploaded.',
      warning: null,
      canOverride: false,
      requiresOverride: false,
      rawVideoCodec: tracks.rawVideoCodec,
    }
  }

  if (duration <= 0) {
    return {
      valid: false,
      duration: 0,
      width,
      height,
      codec,
      audioCodec,
      summary: `${formatCodecLabel(codec)} · ${width}x${height} · 0:00 · ${formatFileSize(file.size)}`,
      blockingError: 'Video has zero or missing duration.',
      warning: null,
      canOverride: false,
      requiresOverride: false,
      rawVideoCodec: tracks.rawVideoCodec,
    }
  }

  const summary = `${formatCodecLabel(codec)} · ${width}x${height} · ${formatDuration(duration)} · ${formatFileSize(file.size)}`

  // Codec compatibility checks
  if (codec === 'hevc' || codec === 'prores' || codec === 'av1') {
    const label = formatCodecLabel(codec)
    return {
      valid: false,
      duration,
      width,
      height,
      codec,
      audioCodec,
      summary,
      blockingError: `This video uses ${label}, which many phones and computers can't play. Convert it to H.264 MP4 (for example with HandBrake, preset 'Fast 720p30') and upload again.`,
      warning: null,
      canOverride: true,
      requiresOverride: true,
      rawVideoCodec: tracks.rawVideoCodec,
    }
  }

  // Non-AAC audio warning for MP4
  let warning: string | null = null
  if (!isWebm && audioCodec && audioCodec !== 'aac') {
    warning = `This video uses ${audioCodec.toUpperCase()} audio instead of standard AAC. Some devices may not play sound.`
  }

  return {
    valid: true,
    duration,
    width,
    height,
    codec,
    audioCodec,
    summary,
    blockingError: null,
    warning,
    canOverride: false,
    requiresOverride: false,
    rawVideoCodec: tracks.rawVideoCodec,
  }
}
