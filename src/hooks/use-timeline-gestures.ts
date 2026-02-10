import { useCallback, useRef } from 'react'
import { useTimelineStore } from '../stores/timeline-store'
import { useProjectStore } from '../stores/project-store'
import { useHistoryStore } from '../stores/history-store'
import { pixelToTime, hitTestClip, hitTestTrimHandle, computeClipLayouts } from '../utils/timeline-math'
import { clampTrim } from '../utils/clip-operations'
import { useMediaStore } from '../stores/media-store'
import { RULER_HEIGHT, TRACK_TOP, TRACK_HEIGHT, HANDLE_WIDTH } from '../utils/timeline-renderer'

interface PointerState {
  startX: number
  startY: number
  startTime: number
  pointerId: number
  lastX: number
}

type GestureMode = 'none' | 'pending' | 'scrub' | 'trim' | 'drag' | 'scroll' | 'pinch'

// What was hit on pointerDown, used to resolve taps on pointerUp
interface HitInfo {
  clipId: string | null
  region: 'ruler' | 'track' | 'trim'
  worldX: number
}

const LONG_PRESS_MS = 500
const DRAG_THRESHOLD = 8

export function useTimelineGestures(scrollContainerRef: React.RefObject<HTMLDivElement | null>) {
  const pointers = useRef(new Map<number, PointerState>())
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gestureMode = useRef<GestureMode>('none')
  const pinchStartDist = useRef(0)
  const pinchStartPps = useRef(0)
  const hitInfo = useRef<HitInfo | null>(null)
  const scrollStartX = useRef(0) // scrollLeft at drag start

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const vibrate = (ms: number) => {
    try { navigator.vibrate?.(ms) } catch { /* noop */ }
  }

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    pointers.current.set(e.pointerId, {
      startX: x,
      startY: y,
      startTime: Date.now(),
      pointerId: e.pointerId,
      lastX: x,
    })

    const store = useTimelineStore.getState()
    const pps = store.pixelsPerSecond
    const scrollX = store.scrollX

    // Two-pointer → pinch zoom
    if (pointers.current.size === 2) {
      clearLongPress()
      gestureMode.current = 'pinch'
      canvas.setPointerCapture(e.pointerId)
      const pts = Array.from(pointers.current.values())
      pinchStartDist.current = Math.abs(pts[0].startX - pts[1].startX)
      pinchStartPps.current = pps
      return
    }

    const clips = useProjectStore.getState().currentProject?.timeline.clips ?? []
    const layouts = computeClipLayouts(clips, pps)
    const worldX = x + scrollX

    // Check trim handle first (only for selected clips)
    const trimHit = hitTestTrimHandle(
      worldX, y, layouts, store.selectedClipId,
      TRACK_TOP, TRACK_HEIGHT, HANDLE_WIDTH + 15,
    )
    if (trimHit) {
      gestureMode.current = 'trim'
      canvas.setPointerCapture(e.pointerId)
      hitInfo.current = { clipId: trimHit.clipId, region: 'trim', worldX }
      const clip = clips.find((c) => c.id === trimHit.clipId)
      if (clip) {
        useHistoryStore.getState().captureBeforeMutation()
        useTimelineStore.getState().setTrimState({
          clipId: trimHit.clipId,
          edge: trimHit.edge,
          originalStart: clip.trim.start,
          originalDuration: clip.trim.duration,
          startX: x,
        })
        vibrate(10)
      }
      return
    }

    // Check ruler tap → scrub (capture immediately for dragging across ruler)
    if (y < RULER_HEIGHT) {
      gestureMode.current = 'scrub'
      canvas.setPointerCapture(e.pointerId)
      hitInfo.current = { clipId: null, region: 'ruler', worldX }
      const time = pixelToTime(worldX, pps)
      useTimelineStore.getState().setPlayheadTime(Math.max(0, time))
      useTimelineStore.getState().setIsScrubbing(true)
      return
    }

    // Track area — clip or empty: enter 'pending' mode (resolve on move or up)
    const clipHit = hitTestClip(worldX, y, layouts, TRACK_TOP, TRACK_HEIGHT)
    hitInfo.current = { clipId: clipHit?.clipId ?? null, region: 'track', worldX }
    gestureMode.current = 'pending'
    scrollStartX.current = scrollContainerRef.current?.scrollLeft ?? 0

    // Start long-press timer for clip reorder
    if (clipHit) {
      clearLongPress()
      longPressTimer.current = setTimeout(() => {
        if (gestureMode.current !== 'pending') return // already scrolling
        gestureMode.current = 'drag'
        canvas.setPointerCapture(e.pointerId)
        vibrate(20)

        const currentClips = useProjectStore.getState().currentProject?.timeline.clips ?? []
        const currentPps = useTimelineStore.getState().pixelsPerSecond
        const clip = currentClips.find((c) => c.id === clipHit.clipId)
        if (clip) {
          useHistoryStore.getState().captureBeforeMutation()
          const currentLayouts = computeClipLayouts(currentClips, currentPps)
          const layoutIdx = currentLayouts.findIndex((l) => l.clipId === clipHit.clipId)
          useTimelineStore.getState().setDragState({
            clipId: clipHit.clipId,
            startOrder: clip.order,
            currentInsertIndex: layoutIdx,
            startX: x,
            currentX: x,
          })
        }
      }, LONG_PRESS_MS)
    }
  }, [scrollContainerRef])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const ptr = pointers.current.get(e.pointerId)
    if (!ptr) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left

    const dx = x - ptr.startX

    const store = useTimelineStore.getState()
    const pps = store.pixelsPerSecond

    const applyScrollMove = () => {
      const container = scrollContainerRef.current
      if (container) {
        const delta = ptr.lastX - x
        container.scrollLeft += delta
        useTimelineStore.getState().setScrollX(container.scrollLeft)
      }
      ptr.lastX = x
    }

    switch (gestureMode.current) {
      case 'pending': {
        // Once moved beyond threshold, decide: scroll
        if (Math.abs(dx) > DRAG_THRESHOLD) {
          clearLongPress()
          gestureMode.current = 'scroll'
          applyScrollMove()
          break
        } else {
          ptr.lastX = x
          return
        }
      }
      case 'scroll': {
        applyScrollMove()
        break
      }

      case 'pinch': {
        if (pointers.current.size < 2) return
        const pts = Array.from(pointers.current.values())
        const otherPtr = pts.find((p) => p.pointerId !== e.pointerId)
        if (!otherPtr) return
        const currentDist = Math.abs(x - otherPtr.lastX)
        if (pinchStartDist.current > 0) {
          const scale = currentDist / pinchStartDist.current
          const newPps = Math.round(pinchStartPps.current * scale)
          store.setPixelsPerSecond(newPps)
        }
        break
      }

      case 'scrub': {
        const worldX = x + store.scrollX
        const time = pixelToTime(worldX, pps)
        store.setPlayheadTime(Math.max(0, Math.min(time, store.totalDuration)))
        break
      }

      case 'trim': {
        const trimState = store.trimState
        if (!trimState) return

        const deltaTime = pixelToTime(x - trimState.startX, pps)
        const clips = useProjectStore.getState().currentProject?.timeline.clips ?? []
        const clip = clips.find((c) => c.id === trimState.clipId)
        if (!clip) return

        const asset = useMediaStore.getState().assets.find((a) => a.id === clip.mediaAssetId)
        const mediaDuration = asset?.duration ?? Infinity

        let newTrim = { start: trimState.originalStart, duration: trimState.originalDuration }

        if (trimState.edge === 'start') {
          const newStart = trimState.originalStart + deltaTime
          const newDuration = trimState.originalDuration - deltaTime
          newTrim = { start: newStart, duration: newDuration }
        } else {
          const newDuration = trimState.originalDuration + deltaTime
          newTrim = { start: trimState.originalStart, duration: newDuration }
        }

        newTrim = clampTrim(newTrim, mediaDuration)
        useProjectStore.getState().updateClip(trimState.clipId, { trim: newTrim })
        break
      }

      case 'drag': {
        const dragState = store.dragState
        if (!dragState) return

        const clips = useProjectStore.getState().currentProject?.timeline.clips ?? []
        const layouts = computeClipLayouts(clips, pps)
        const worldX = x + store.scrollX

        // Find insert index
        let insertIdx = layouts.length
        for (let i = 0; i < layouts.length; i++) {
          const mid = layouts[i].left + layouts[i].width / 2
          if (worldX < mid) {
            insertIdx = i
            break
          }
        }

        store.setDragState({
          ...dragState,
          currentX: x,
          currentInsertIndex: insertIdx,
        })
        break
      }
    }
  }, [scrollContainerRef])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId)
    clearLongPress()

    const store = useTimelineStore.getState()

    switch (gestureMode.current) {
      case 'pending': {
        // It was a tap (didn't move enough to become a scroll)
        const hit = hitInfo.current
        if (hit) {
          if (hit.clipId) {
            // Tap on clip → select it
            store.selectClip(hit.clipId)
          } else {
            // Tap on empty track → deselect + move playhead
            store.selectClip(null)
            const pps = store.pixelsPerSecond
            const time = pixelToTime(hit.worldX, pps)
            store.setPlayheadTime(Math.max(0, time))
          }
        }
        break
      }

      case 'scroll':
        // Nothing to clean up
        break

      case 'scrub':
        store.setIsScrubbing(false)
        break

      case 'trim':
        store.setTrimState(null)
        useHistoryStore.getState().commitMutation()
        break

      case 'drag': {
        const dragState = store.dragState
        if (dragState) {
          const clips = useProjectStore.getState().currentProject?.timeline.clips ?? []
          const sorted = [...clips].sort((a, b) => a.order - b.order)
          const dragIdx = sorted.findIndex((c) => c.id === dragState.clipId)

          if (dragIdx !== -1 && dragState.currentInsertIndex !== dragIdx) {
            const clip = sorted.splice(dragIdx, 1)[0]
            const insertAt = dragState.currentInsertIndex > dragIdx
              ? dragState.currentInsertIndex - 1
              : dragState.currentInsertIndex
            sorted.splice(insertAt, 0, clip)

            const reordered = sorted.map((c, i) => ({ ...c, order: i }))
            useProjectStore.getState().reorderClips(reordered)
          }

          useHistoryStore.getState().commitMutation()
          vibrate(10)
        }
        store.setDragState(null)
        break
      }

      case 'pinch':
        if (pointers.current.size === 0) {
          gestureMode.current = 'none'
        }
        hitInfo.current = null
        return // Don't reset mode until all pointers up
    }

    if (pointers.current.size === 0) {
      gestureMode.current = 'none'
    }
    hitInfo.current = null
  }, [])

  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId)
    clearLongPress()

    const store = useTimelineStore.getState()
    if (gestureMode.current === 'trim') {
      store.setTrimState(null)
      useHistoryStore.getState().abortMutation()
    }
    if (gestureMode.current === 'drag') {
      store.setDragState(null)
      useHistoryStore.getState().abortMutation()
    }
    store.setIsScrubbing(false)

    if (pointers.current.size === 0) {
      gestureMode.current = 'none'
    }
    hitInfo.current = null
  }, [])

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}
