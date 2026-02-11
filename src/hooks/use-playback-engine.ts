import { useCallback, useEffect, useRef, useState } from 'react'
import { useProjectStore } from '../stores/project-store'
import { useMediaStore } from '../stores/media-store'
import { useTimelineStore } from '../stores/timeline-store'
import { computeClipLayouts, computeTotalDuration } from '../utils/timeline-math'
import { getMediaFile } from '../storage/media-storage'
import type { ClipLayout } from '../utils/timeline-math'

interface PlaybackClip {
  clipId: string
  mediaAssetId: string
  localSeekTime: number
}

function resolvePlayhead(globalTime: number, layouts: ClipLayout[], clips: { id: string; mediaAssetId: string; trim: { start: number; duration: number } }[]): PlaybackClip | null {
  for (const layout of layouts) {
    if (globalTime >= layout.startTime && globalTime < layout.endTime) {
      const clip = clips.find((c) => c.id === layout.clipId)
      if (!clip) continue
      const localOffset = globalTime - layout.startTime
      return {
        clipId: clip.id,
        mediaAssetId: clip.mediaAssetId,
        localSeekTime: clip.trim.start + localOffset,
      }
    }
  }
  return null
}

export function usePlaybackEngine() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const currentClipIdRef = useRef<string | null>(null)
  const urlCacheRef = useRef(new Map<string, string>()) // mediaAssetId -> objectUrl
  const playingRef = useRef(false)
  const rafRef = useRef(0)
  const pendingSeekTokenRef = useRef(0)
  const pendingSeekTimeRef = useRef<number | null>(null)

  const projectId = useProjectStore((s) => s.currentProject?.id ?? null)
  const clipsKey = useProjectStore((s) => {
    const clips = s.currentProject?.timeline.clips ?? []
    const sorted = [...clips].sort((a, b) => a.order - b.order)
    return sorted.map((c) => `${c.id}:${c.mediaAssetId}:${c.order}`).join('|')
  })

  // Load a clip's video URL
  const loadClipVideo = useCallback(async (mediaAssetId: string): Promise<string | null> => {
    const cached = urlCacheRef.current.get(mediaAssetId)
    if (cached) return cached

    const asset = useMediaStore.getState().assets.find((a) => a.id === mediaAssetId)
    if (!asset) return null

    try {
      const file = await getMediaFile(asset.opfsPath, { fileName: asset.fileName, mimeType: asset.mimeType })
      const url = URL.createObjectURL(file)
      urlCacheRef.current.set(mediaAssetId, url)
      return url
    } catch {
      return null
    }
  }, [])

  const applyPendingSeek = useCallback(() => {
    const video = videoRef.current
    const seekTime = pendingSeekTimeRef.current
    if (!video || seekTime === null) return

    const token = pendingSeekTokenRef.current
    const doSeek = () => {
      if (pendingSeekTokenRef.current !== token) return
      try {
        video.currentTime = seekTime
      } catch {
        // noop
      }
    }

    if (video.readyState >= 1) doSeek()
    else video.addEventListener('loadedmetadata', doSeek, { once: true })
  }, [])

  const setSourceAndSeek = useCallback((url: string, seekTime: number) => {
    pendingSeekTokenRef.current++
    pendingSeekTimeRef.current = seekTime
    const video = videoRef.current

    // Important: if we're switching between clips that use the same underlying
    // media, the blob URL (and thus <video src>) won't change. In that case,
    // the "videoUrl changed" effect won't run, so we must apply the seek now.
    if (video && (video.currentSrc === url || video.src === url)) {
      applyPendingSeek()
      return
    }

    setVideoUrl(url)
  }, [applyPendingSeek])

  // Apply pending seek after the <video> src updates.
  useEffect(() => {
    applyPendingSeek()
  }, [applyPendingSeek, videoUrl])

  // Sync video element to a global time (no store update — avoids feedback loops)
  const seekVideo = useCallback(async (globalTime: number) => {
    const project = useProjectStore.getState().currentProject
    if (!project) return

    const clips = project.timeline.clips
    const pps = useTimelineStore.getState().pixelsPerSecond
    const layouts = computeClipLayouts(clips, pps)
    const resolved = resolvePlayhead(globalTime, layouts, clips)

    if (!resolved) return

    // If different clip, load its video
    if (resolved.clipId !== currentClipIdRef.current) {
      const url = await loadClipVideo(resolved.mediaAssetId)
      if (url) {
        setSourceAndSeek(url, resolved.localSeekTime)
        currentClipIdRef.current = resolved.clipId
        return
      }
    }

    // Seek the video element
    const video = videoRef.current
    if (!video) return
    pendingSeekTokenRef.current++
    pendingSeekTimeRef.current = resolved.localSeekTime
    if (video.readyState >= 1) video.currentTime = resolved.localSeekTime
    else applyPendingSeek()
  }, [applyPendingSeek, loadClipVideo, setSourceAndSeek])

  // Seek to a specific global time (programmatic — updates store + video)
  const seek = useCallback(async (globalTime: number) => {
    useTimelineStore.getState().setPlayheadTime(globalTime)
    await seekVideo(globalTime)
  }, [seekVideo])

  const pause = useCallback(() => {
    const video = videoRef.current
    if (video) video.pause()
    playingRef.current = false
    useTimelineStore.getState().setIsPlaying(false)
    cancelAnimationFrame(rafRef.current)
  }, [])

  // Sync playhead time with video currentTime during playback
  const startPlayheadSync = useCallback(() => {
    const syncLoop = () => {
      if (!playingRef.current) return

      const video = videoRef.current
      const project = useProjectStore.getState().currentProject
      if (!video || !project) {
        rafRef.current = requestAnimationFrame(syncLoop)
        return
      }

      const clips = project.timeline.clips
      const pps = useTimelineStore.getState().pixelsPerSecond
      const layouts = computeClipLayouts(clips, pps)
      const currentClipId = currentClipIdRef.current
      const layout = layouts.find((l) => l.clipId === currentClipId)

      if (layout) {
        const clip = clips.find((c) => c.id === currentClipId)
        if (clip) {
          const localOffset = video.currentTime - clip.trim.start
          const globalTime = layout.startTime + localOffset
          useTimelineStore.getState().setPlayheadTime(globalTime)

          // Check if we've reached the end of this clip's trim
          if (video.currentTime >= clip.trim.start + clip.trim.duration - 0.05) {
            // Move to next clip
            const currentIdx = layouts.findIndex((l) => l.clipId === currentClipId)
            const nextLayout = layouts[currentIdx + 1]

            if (nextLayout) {
              const nextClip = clips.find((c) => c.id === nextLayout.clipId)
              if (nextClip) {
                // If the next clip is the same underlying media, do a soft seek
                // without pausing or swapping sources. This reduces perceptible gaps.
                if (nextClip.mediaAssetId === clip.mediaAssetId) {
                  currentClipIdRef.current = nextClip.id
                  pendingSeekTokenRef.current++
                  pendingSeekTimeRef.current = nextClip.trim.start
                  try {
                    // Prefer fastSeek when available (Chrome).
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const anyVideo = video as any
                    if (typeof anyVideo.fastSeek === 'function') anyVideo.fastSeek(nextClip.trim.start)
                    else video.currentTime = nextClip.trim.start
                  } catch {
                    // noop
                  }
                  // Keep playing (seek may briefly stall while decoding).
                  video.play().catch(() => {})
                } else {
                  video.pause()
                  loadClipVideo(nextClip.mediaAssetId).then((url) => {
                    if (url && playingRef.current) {
                      setSourceAndSeek(url, nextClip.trim.start)
                      currentClipIdRef.current = nextClip.id
                      requestAnimationFrame(() => {
                        const v = videoRef.current
                        if (v) {
                          const token = pendingSeekTokenRef.current
                          const start = () => {
                            if (pendingSeekTokenRef.current !== token) return
                            v.play().catch(() => {})
                          }
                          v.addEventListener('loadedmetadata', start, { once: true })
                          if (v.readyState >= 1 && v.currentSrc === url) start()
                        }
                      })
                    }
                  })
                }
              }
            } else {
              // End of timeline
              pause()
              useTimelineStore.getState().setPlayheadTime(computeTotalDuration(clips))
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(syncLoop)
    }

    rafRef.current = requestAnimationFrame(syncLoop)
  }, [loadClipVideo, pause, setSourceAndSeek])

  // Play from current playhead position
  const play = useCallback(async () => {
    const project = useProjectStore.getState().currentProject
    if (!project) return

    const clips = project.timeline.clips
    if (clips.length === 0) return

    const pps = useTimelineStore.getState().pixelsPerSecond
    const layouts = computeClipLayouts(clips, pps)
    const playheadTime = useTimelineStore.getState().playheadTime
    const resolved = resolvePlayhead(playheadTime, layouts, clips)

    let nextUrl: string | null = null
    let nextSeekTime = 0
    let waitForNewSource = false

    if (!resolved) {
      // If past end, restart from beginning
      useTimelineStore.getState().setPlayheadTime(0)
      const firstLayout = layouts[0]
      if (!firstLayout) return
      const firstClip = clips.find((c) => c.id === firstLayout.clipId)
      if (!firstClip) return
      const url = await loadClipVideo(firstClip.mediaAssetId)
      if (url) {
        nextUrl = url
        nextSeekTime = firstClip.trim.start
        waitForNewSource = url !== videoUrl
        setSourceAndSeek(url, nextSeekTime)
        currentClipIdRef.current = firstClip.id
      }
    } else {
      const url = await loadClipVideo(resolved.mediaAssetId)
      if (url) {
        nextUrl = url
        nextSeekTime = resolved.localSeekTime
        waitForNewSource = url !== videoUrl
        setSourceAndSeek(url, nextSeekTime)
        currentClipIdRef.current = resolved.clipId
      }
    }

    playingRef.current = true
    useTimelineStore.getState().setIsPlaying(true)
    requestAnimationFrame(() => {
      const v = videoRef.current
      if (!v) return
      const token = pendingSeekTokenRef.current
      const start = () => {
        if (pendingSeekTokenRef.current !== token) return
        v.play().catch(() => {})
      }
      if (waitForNewSource && nextUrl) {
        v.addEventListener('loadedmetadata', start, { once: true })
        if (v.readyState >= 1 && v.currentSrc === nextUrl) start()
        return
      }

      if (v.readyState >= 1) start()
      else v.addEventListener('loadedmetadata', start, { once: true })
    })
    startPlayheadSync()
  }, [loadClipVideo, setSourceAndSeek, startPlayheadSync, videoUrl])

  // Load a reasonable initial clip when the project/clip list changes.
  useEffect(() => {
    const project = useProjectStore.getState().currentProject
    if (!project) {
      queueMicrotask(() => setVideoUrl(null))
      currentClipIdRef.current = null
      return
    }

    const clips = project.timeline.clips
    if (clips.length === 0) {
      queueMicrotask(() => setVideoUrl(null))
      currentClipIdRef.current = null
      return
    }

    // If we're paused, keep preview synced with the current playhead even
    // when the clip list changes (undo/redo, split, delete, reorder, trim).
    if (!playingRef.current) {
      const t = useTimelineStore.getState().playheadTime
      // Defer to avoid synchronous setState inside effect body.
      queueMicrotask(() => seekVideo(t))
    }
  }, [clipsKey, projectId, seekVideo])

  // Handle scrubbing from timeline
  useEffect(() => {
    return useTimelineStore.subscribe(
      (state) => state.isScrubbing,
      (isScrubbing) => {
        if (isScrubbing && playingRef.current) {
          pause()
        }
      },
    )
  }, [pause])

  // Seek video when scrubbing (subscribe to playheadTime only — no store writes to avoid loops)
  useEffect(() => {
    return useTimelineStore.subscribe(
      (state) => state.playheadTime,
      (playheadTime) => {
        const { isScrubbing } = useTimelineStore.getState()

        // During scrubbing, always seek.
        if (isScrubbing) {
          seekVideo(playheadTime)
          return
        }

        // When paused, keep the preview in sync with programmatic/tap playhead changes.
        if (!playingRef.current) {
          seekVideo(playheadTime)
        }
      },
    )
  }, [seekVideo])

  // Cleanup
  useEffect(() => {
    const cache = urlCacheRef.current
    return () => {
      cancelAnimationFrame(rafRef.current)
      for (const url of cache.values()) {
        URL.revokeObjectURL(url)
      }
      cache.clear()
    }
  }, [])

  return {
    videoUrl,
    videoRef,
    play,
    pause,
    seek,
  }
}
