import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { resizeCanvasToContainer } from '../utils/canvas'

interface UseVideoPreviewOptions {
  onFrame?: (ctx: CanvasRenderingContext2D, video: HTMLVideoElement, time: number) => void
  videoRef?: RefObject<HTMLVideoElement | null>
  containerRef?: RefObject<HTMLDivElement | null>
  extraCanvasRefs?: Array<RefObject<HTMLCanvasElement | null>>
}

export function useVideoPreview(options: UseVideoPreviewOptions = {}) {
  const internalVideoRef = useRef<HTMLVideoElement>(null)
  const videoRef = options.videoRef ?? internalVideoRef
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const internalContainerRef = useRef<HTMLDivElement>(null)
  const containerRef = options.containerRef ?? internalContainerRef
  const extraCanvasRefsRef = useRef(options.extraCanvasRefs ?? [])
  const [playing, setPlaying] = useState(false)
  const [fps, setFps] = useState(0)
  const loopActiveRef = useRef(false)
  const animRef = useRef<number>(0)
  const frameCountRef = useRef(0)
  const lastFpsTimeRef = useRef(0)
  const startLoopRef = useRef<() => void>(() => {})
  const stopLoopRef = useRef<() => void>(() => {})
  const onFrameRef = useRef(options.onFrame)
  useEffect(() => {
    onFrameRef.current = options.onFrame
  }, [options.onFrame])

  useEffect(() => {
    extraCanvasRefsRef.current = options.extraCanvasRefs ?? []
  }, [options.extraCanvasRefs])

  // Resize canvas to match container with DPR
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resize = () => {
      resizeCanvasToContainer(canvas, container)
      for (const ref of extraCanvasRefsRef.current) {
        const c = ref.current
        if (c) resizeCanvasToContainer(c, container)
      }
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [containerRef])

  const renderFrame = () => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const now = performance.now()

    // FPS counter
    frameCountRef.current++
    if (now - lastFpsTimeRef.current >= 1000) {
      setFps(frameCountRef.current)
      frameCountRef.current = 0
      lastFpsTimeRef.current = now
    }

    // Clear and draw
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    ctx.clearRect(0, 0, w, h)

    // Custom frame callback
    onFrameRef.current?.(ctx, video, video.currentTime)
  }

  const startLoop = () => {
    const video = videoRef.current
    if (!video || loopActiveRef.current) return
    loopActiveRef.current = true

    const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype

    if (hasRVFC) {
      const onFrame = () => {
        if (!loopActiveRef.current) return
        renderFrame()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(video as any).requestVideoFrameCallback(onFrame)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(video as any).requestVideoFrameCallback(onFrame)
    } else {
      const rafLoop = () => {
        if (!loopActiveRef.current) return
        renderFrame()
        animRef.current = requestAnimationFrame(rafLoop)
      }
      animRef.current = requestAnimationFrame(rafLoop)
    }
  }

  const stopLoop = () => {
    loopActiveRef.current = false
    cancelAnimationFrame(animRef.current)
  }

  // Provide stable loop controls to effects/event listeners.
  useEffect(() => {
    startLoopRef.current = startLoop
    stopLoopRef.current = stopLoop
  })

  const play = async () => {
    const video = videoRef.current
    if (!video) return
    try {
      await video.play()
      setPlaying(true)
      startLoopRef.current()
    } catch {
      stopLoopRef.current()
      setPlaying(false)
    }
  }

  const pause = () => {
    const video = videoRef.current
    if (!video) return
    video.pause()
    stopLoopRef.current()
    setPlaying(false)
  }

  const togglePlay = async () => {
    if (playing) {
      pause()
    } else {
      await play()
    }
  }

  const seek = (time: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = time
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => stopLoopRef.current()
  }, [])

  // Keep state in sync with media element lifecycle.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handlePlay = () => {
      setPlaying(true)
      startLoopRef.current()
    }

    const handlePause = () => {
      stopLoopRef.current()
      setPlaying(false)
    }

    const handleEnded = () => {
      stopLoopRef.current()
      setPlaying(false)
    }

    const handleError = () => {
      stopLoopRef.current()
      setPlaying(false)
    }

    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)
    video.addEventListener('play', handlePlay)
    video.addEventListener('playing', handlePlay)
    video.addEventListener('pause', handlePause)
    return () => {
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('playing', handlePlay)
      video.removeEventListener('pause', handlePause)
    }
  }, [videoRef])

  return {
    videoRef,
    canvasRef,
    containerRef,
    playing,
    fps,
    play,
    pause,
    togglePlay,
    seek,
  }
}
