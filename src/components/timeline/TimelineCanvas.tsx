import { useEffect, useRef } from 'react'
import { useTimelineStore } from '../../stores/timeline-store'
import { useProjectStore } from '../../stores/project-store'
import { useMediaStore } from '../../stores/media-store'
import { computeClipLayouts, computeTotalDuration } from '../../utils/timeline-math'
import { renderTimeline, RULER_HEIGHT, TRACK_HEIGHT } from '../../utils/timeline-renderer'
import { useTimelineGestures } from '../../hooks/use-timeline-gestures'
import { thumbnailStripService, CELL_WIDTH } from '../../services/thumbnail-strip'
import { getMediaFile } from '../../storage/media-storage'
import type { RenderContext } from '../../utils/timeline-renderer'

export const CANVAS_HEIGHT = RULER_HEIGHT + 4 + TRACK_HEIGHT + 8

interface TimelineCanvasProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}

export function TimelineCanvas({ scrollContainerRef }: TimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dirtyRef = useRef(true)
  const rafRef = useRef(0)
  const thumbnailImagesRef = useRef(new Map<string, HTMLImageElement[]>())
  const thumbnailKeyByClipIdRef = useRef(new Map<string, string>()) // clipId -> cache key
  const videoUrlsRef = useRef(new Map<string, string>()) // mediaAssetId -> objectUrl

  const gestures = useTimelineGestures(scrollContainerRef)

  // Mark dirty on any relevant state change
  useEffect(() => {
    const unsubTimeline = useTimelineStore.subscribe(() => { dirtyRef.current = true })
    const unsubProject = useProjectStore.subscribe(() => { dirtyRef.current = true })
    return () => { unsubTimeline(); unsubProject() }
  }, [])

  // Subscribe to thumbnail strip updates
  useEffect(() => {
    return thumbnailStripService.subscribe(() => {
      dirtyRef.current = true
    })
  }, [])

  // Load video URLs for thumbnail extraction
  useEffect(() => {
    const assets = useMediaStore.getState().assets
    for (const asset of assets) {
      if (!videoUrlsRef.current.has(asset.id)) {
        getMediaFile(asset.opfsPath)
          .then((file) => {
            const url = URL.createObjectURL(file)
            videoUrlsRef.current.set(asset.id, url)
            dirtyRef.current = true
          })
          .catch(() => {})
      }
    }
  }, [])

  // Recheck when media store changes
  useEffect(() => {
    return useMediaStore.subscribe((state) => {
      const assetIds = new Set(state.assets.map((a) => a.id))

      // Revoke URLs for removed assets.
      for (const [assetId, url] of videoUrlsRef.current) {
        if (!assetIds.has(assetId)) {
          URL.revokeObjectURL(url)
          videoUrlsRef.current.delete(assetId)
          dirtyRef.current = true
        }
      }

      for (const asset of state.assets) {
        if (!videoUrlsRef.current.has(asset.id)) {
          getMediaFile(asset.opfsPath)
            .then((file) => {
              const url = URL.createObjectURL(file)
              videoUrlsRef.current.set(asset.id, url)
              dirtyRef.current = true
            })
            .catch(() => {})
        }
      }
    })
  }, [])

  // Cleanup object URLs on unmount.
  useEffect(() => {
    const map = videoUrlsRef.current
    const imageMap = thumbnailImagesRef.current
    const keyMap = thumbnailKeyByClipIdRef.current
    return () => {
      for (const url of map.values()) {
        URL.revokeObjectURL(url)
      }
      map.clear()
      imageMap.clear()
      keyMap.clear()
    }
  }, [])

  // Canvas sizing with ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const w = rect.width
      const h = CANVAS_HEIGHT

      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`

      const ctx = canvas.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      useTimelineStore.getState().setViewportWidth(w)
      dirtyRef.current = true
    }

    const observer = new ResizeObserver(resize)
    if (canvas.parentElement) observer.observe(canvas.parentElement)
    resize()

    return () => observer.disconnect()
  }, [])

  const drawRef = useRef<() => void>(() => {})

  useEffect(() => {
    drawRef.current = () => {
      if (!dirtyRef.current) {
        rafRef.current = requestAnimationFrame(() => drawRef.current())
        return
      }
      dirtyRef.current = false

      const canvas = canvasRef.current
      if (!canvas) {
        rafRef.current = requestAnimationFrame(() => drawRef.current())
        return
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        rafRef.current = requestAnimationFrame(() => drawRef.current())
        return
      }

      const timelineState = useTimelineStore.getState()
      const projectState = useProjectStore.getState()
      const clips = projectState.currentProject?.timeline.clips ?? []
      const clipById = new Map(clips.map((c) => [c.id, c]))
      const pps = timelineState.pixelsPerSecond
      const layouts = computeClipLayouts(clips, pps)

      // Update total duration
      const totalDur = computeTotalDuration(clips)
      if (totalDur !== timelineState.totalDuration) {
        useTimelineStore.getState().setTotalDuration(totalDur)
      }

      // Build clip media ID map
      const clipMediaIds = new Map<string, string>()
      for (const clip of clips) {
        clipMediaIds.set(clip.id, clip.mediaAssetId)
      }

      // Request thumbnail strips and build image maps
      const thumbnailImages = new Map<string, HTMLImageElement[]>()
      for (const layout of layouts) {
        const clip = clipById.get(layout.clipId)
        if (!clip) continue

        const cellCount = Math.max(1, Math.ceil(layout.width / CELL_WIDTH))
        const key = thumbnailStripService.getCacheKey(
          clip.mediaAssetId,
          cellCount,
          clip.trim.start,
          clip.trim.duration,
        )
        const cached = thumbnailStripService.getCached(key)

        if (cached) {
          // Convert to HTMLImageElement array (cached per draw)
          const existing = thumbnailImagesRef.current.get(layout.clipId)
          const prevKey = thumbnailKeyByClipIdRef.current.get(layout.clipId)
          if (!existing || existing.length !== cached.length || prevKey !== key) {
            const imgs: HTMLImageElement[] = cached.map((url) => {
              if (!url) return new Image()
              const img = new Image()
              img.src = url
              img.onload = () => { dirtyRef.current = true }
              return img
            })
            thumbnailImagesRef.current.set(layout.clipId, imgs)
            thumbnailKeyByClipIdRef.current.set(layout.clipId, key)
            thumbnailImages.set(layout.clipId, imgs)
          } else {
            thumbnailImages.set(layout.clipId, existing)
          }
        } else {
          // Request extraction
          const videoUrl = videoUrlsRef.current.get(clip.mediaAssetId)
          if (videoUrl) {
            thumbnailStripService.request(
              clip.mediaAssetId,
              videoUrl,
              clip.trim.start,
              clip.trim.duration,
              cellCount,
            )
          }
        }
      }

      const dpr = window.devicePixelRatio || 1
      const rc: RenderContext = {
        width: canvas.width / dpr,
        height: canvas.height / dpr,
        pps,
        scrollX: timelineState.scrollX,
        playheadTime: timelineState.playheadTime,
        selectedClipId: timelineState.selectedClipId,
        clipLayouts: layouts,
        clipMediaIds,
        thumbnailFrames: new Map(),
        thumbnailImages,
        dragState: timelineState.dragState,
        trimState: timelineState.trimState,
        totalDuration: totalDur,
      }

      renderTimeline(ctx, rc)
      rafRef.current = requestAnimationFrame(() => drawRef.current())
    }
  }, [])

  // Start/stop RAF loop
  useEffect(() => {
    rafRef.current = requestAnimationFrame(() => drawRef.current())
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="block"
      style={{
        position: 'sticky',
        left: 0,
        touchAction: 'none',
      }}
      onPointerDown={gestures.onPointerDown}
      onPointerMove={gestures.onPointerMove}
      onPointerUp={gestures.onPointerUp}
      onPointerCancel={gestures.onPointerCancel}
    />
  )
}
