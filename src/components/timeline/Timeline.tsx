import { useCallback, useRef } from 'react'
import { useTimelineStore } from '../../stores/timeline-store'
import { TimelineCanvas, CANVAS_HEIGHT } from './TimelineCanvas'
import { TimelineToolbar } from './TimelineToolbar'

export function Timeline() {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const pps = useTimelineStore((s) => s.pixelsPerSecond)
  const totalDuration = useTimelineStore((s) => s.totalDuration)

  // Spacer width: total duration in pixels + extra buffer for scrolling past end
  const spacerWidth = Math.max(totalDuration * pps + 200, 400)

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    useTimelineStore.getState().setScrollX(el.scrollLeft)
  }, [])

  return (
    <div className="bg-slate-950 border-t border-slate-700">
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto"
        onScroll={handleScroll}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div style={{ width: spacerWidth, height: CANVAS_HEIGHT }}>
          <TimelineCanvas scrollContainerRef={scrollContainerRef} />
        </div>
      </div>
      <TimelineToolbar />
    </div>
  )
}
