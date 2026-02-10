import type { ClipLayout } from './timeline-math'
import type { DragState, TrimState } from '../stores/timeline-store'

const RULER_HEIGHT = 20
const TRACK_TOP = RULER_HEIGHT + 4
const TRACK_HEIGHT = 72
const CLIP_RADIUS = 6
const HANDLE_WIDTH = 8
const PLAYHEAD_COLOR = '#ef4444'

// Deterministic clip color from mediaAssetId hash
const CLIP_COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#6366f1',
]

function hashColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  }
  return CLIP_COLORS[Math.abs(hash) % CLIP_COLORS.length]
}

export interface RenderContext {
  width: number
  height: number
  pps: number
  scrollX: number
  playheadTime: number
  selectedClipId: string | null
  clipLayouts: ClipLayout[]
  clipMediaIds: Map<string, string> // clipId -> mediaAssetId
  thumbnailFrames: Map<string, (string | null)[]> // clipId -> frame urls
  thumbnailImages: Map<string, HTMLImageElement[]> // clipId -> loaded images
  dragState: DragState | null
  trimState: TrimState | null
  totalDuration: number
}

export { RULER_HEIGHT, TRACK_TOP, TRACK_HEIGHT, HANDLE_WIDTH }

export function renderTimeline(ctx: CanvasRenderingContext2D, rc: RenderContext): void {
  ctx.clearRect(0, 0, rc.width, rc.height)

  renderTimeRuler(ctx, rc)
  renderClips(ctx, rc)
  renderDragPreview(ctx, rc)
  renderPlayhead(ctx, rc)
}

function renderTimeRuler(ctx: CanvasRenderingContext2D, rc: RenderContext): void {
  const { width, pps, scrollX } = rc

  ctx.fillStyle = '#1e293b'
  ctx.fillRect(0, 0, width, RULER_HEIGHT)

  // Determine tick interval based on zoom level
  let tickInterval = 1 // seconds
  if (pps < 30) tickInterval = 5
  else if (pps < 60) tickInterval = 2
  else if (pps > 150) tickInterval = 0.5

  const startTime = Math.floor(scrollX / pps / tickInterval) * tickInterval
  const endTime = (scrollX + width) / pps

  ctx.fillStyle = '#94a3b8'
  ctx.font = '10px system-ui, sans-serif'
  ctx.textBaseline = 'top'

  for (let t = startTime; t <= endTime; t += tickInterval) {
    const x = t * pps - scrollX
    if (x < -50 || x > width + 50) continue

    // Major tick
    ctx.strokeStyle = '#475569'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, RULER_HEIGHT - 6)
    ctx.lineTo(x, RULER_HEIGHT)
    ctx.stroke()

    // Label
    const label = t >= 60
      ? `${Math.floor(t / 60)}:${(t % 60).toFixed(tickInterval < 1 ? 1 : 0).padStart(tickInterval < 1 ? 4 : 2, '0')}`
      : `${t.toFixed(tickInterval < 1 ? 1 : 0)}s`
    ctx.fillText(label, x + 3, 3)

    // Minor ticks
    if (tickInterval >= 1) {
      const minorInterval = tickInterval / 4
      for (let m = 1; m < 4; m++) {
        const mx = (t + m * minorInterval) * pps - scrollX
        if (mx < 0 || mx > width) continue
        ctx.strokeStyle = '#334155'
        ctx.beginPath()
        ctx.moveTo(mx, RULER_HEIGHT - 3)
        ctx.lineTo(mx, RULER_HEIGHT)
        ctx.stroke()
      }
    }
  }

  // Bottom border
  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, RULER_HEIGHT)
  ctx.lineTo(width, RULER_HEIGHT)
  ctx.stroke()
}

function renderClips(ctx: CanvasRenderingContext2D, rc: RenderContext): void {
  const { scrollX, selectedClipId, clipLayouts, clipMediaIds } = rc

  // Track background
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, TRACK_TOP, rc.width, TRACK_HEIGHT)

  for (const layout of clipLayouts) {
    const x = layout.left - scrollX
    const w = layout.width

    // Skip offscreen clips
    if (x + w < -10 || x > rc.width + 10) continue

    const mediaId = clipMediaIds.get(layout.clipId) ?? ''
    const color = hashColor(mediaId)
    const isSelected = layout.clipId === selectedClipId

    // Clip body
    ctx.save()
    roundRect(ctx, x, TRACK_TOP + 2, w, TRACK_HEIGHT - 4, CLIP_RADIUS)
    ctx.fillStyle = color + '40' // translucent fill
    ctx.fill()
    ctx.strokeStyle = isSelected ? '#ffffff' : color
    ctx.lineWidth = isSelected ? 2 : 1
    ctx.stroke()
    ctx.clip()

    // Draw thumbnail strip
    const images = rc.thumbnailImages.get(layout.clipId)
    if (images && images.length > 0) {
      const cellWidth = w / images.length
      for (let i = 0; i < images.length; i++) {
        const img = images[i]
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, x + i * cellWidth, TRACK_TOP + 2, cellWidth, TRACK_HEIGHT - 4)
        }
      }
      // Overlay tint
      ctx.fillStyle = color + '30'
      ctx.fillRect(x, TRACK_TOP + 2, w, TRACK_HEIGHT - 4)
    }

    ctx.restore()

    // Duration label
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 10px system-ui, sans-serif'
    ctx.textBaseline = 'bottom'
    const durationLabel = `${layout.duration.toFixed(1)}s`
    ctx.fillText(durationLabel, x + 6, TRACK_TOP + TRACK_HEIGHT - 6)

    // Trim handles on selected clip
    if (isSelected) {
      renderTrimHandles(ctx, x, w)
    }
  }
}

function renderTrimHandles(ctx: CanvasRenderingContext2D, x: number, w: number): void {
  // Start handle
  ctx.fillStyle = '#ffffffcc'
  roundRect(ctx, x, TRACK_TOP + 8, HANDLE_WIDTH, TRACK_HEIGHT - 20, 3)
  ctx.fill()

  // Handle grip lines
  ctx.strokeStyle = '#00000066'
  ctx.lineWidth = 1
  const midY = TRACK_TOP + TRACK_HEIGHT / 2
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(x + HANDLE_WIDTH / 2, midY + i * 5)
    ctx.lineTo(x + HANDLE_WIDTH / 2, midY + i * 5 + 2)
    ctx.stroke()
  }

  // End handle
  const endX = x + w - HANDLE_WIDTH
  ctx.fillStyle = '#ffffffcc'
  roundRect(ctx, endX, TRACK_TOP + 8, HANDLE_WIDTH, TRACK_HEIGHT - 20, 3)
  ctx.fill()

  ctx.strokeStyle = '#00000066'
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(endX + HANDLE_WIDTH / 2, midY + i * 5)
    ctx.lineTo(endX + HANDLE_WIDTH / 2, midY + i * 5 + 2)
    ctx.stroke()
  }
}

function renderDragPreview(ctx: CanvasRenderingContext2D, rc: RenderContext): void {
  const { dragState, clipLayouts, scrollX, clipMediaIds } = rc
  if (!dragState) return

  const layout = clipLayouts.find((l) => l.clipId === dragState.clipId)
  if (!layout) return

  const dragOffset = dragState.currentX - dragState.startX
  const x = layout.left - scrollX + dragOffset

  const mediaId = clipMediaIds.get(layout.clipId) ?? ''
  const color = hashColor(mediaId)

  ctx.save()
  ctx.globalAlpha = 0.5
  roundRect(ctx, x, TRACK_TOP + 2, layout.width, TRACK_HEIGHT - 4, CLIP_RADIUS)
  ctx.fillStyle = color + '60'
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.setLineDash([4, 4])
  ctx.stroke()
  ctx.restore()

  // Drop indicator line
  const insertLayout = clipLayouts[dragState.currentInsertIndex]
  if (insertLayout) {
    const indicatorX = insertLayout.left - scrollX
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(indicatorX, TRACK_TOP)
    ctx.lineTo(indicatorX, TRACK_TOP + TRACK_HEIGHT)
    ctx.stroke()
  }
}

function renderPlayhead(ctx: CanvasRenderingContext2D, rc: RenderContext): void {
  const { playheadTime, pps, scrollX, height } = rc
  const x = playheadTime * pps - scrollX

  if (x < -2 || x > rc.width + 2) return

  // Line
  ctx.strokeStyle = PLAYHEAD_COLOR
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x, height)
  ctx.stroke()

  // Top triangle
  ctx.fillStyle = PLAYHEAD_COLOR
  ctx.beginPath()
  ctx.moveTo(x - 6, 0)
  ctx.lineTo(x + 6, 0)
  ctx.lineTo(x, 8)
  ctx.closePath()
  ctx.fill()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
