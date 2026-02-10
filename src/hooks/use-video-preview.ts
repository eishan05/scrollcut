import { useCallback, useEffect, useRef, useState } from 'react'

interface UseVideoPreviewOptions {
  onFrame?: (ctx: CanvasRenderingContext2D, video: HTMLVideoElement, time: number) => void
}

export function useVideoPreview(options: UseVideoPreviewOptions = {}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [fps, setFps] = useState(0)
  const loopActiveRef = useRef(false)
  const animRef = useRef<number>(0)
  const frameCountRef = useRef(0)
  const lastFpsTimeRef = useRef(0)
  const onFrameRef = useRef(options.onFrame)
  useEffect(() => {
    onFrameRef.current = options.onFrame
  }, [options.onFrame])

  // Resize canvas to match container with DPR
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const renderFrame = useCallback(() => {
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
  }, [])

  const startLoop = useCallback(() => {
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
  }, [renderFrame])

  const stopLoop = useCallback(() => {
    loopActiveRef.current = false
    cancelAnimationFrame(animRef.current)
  }, [])

  const play = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    try {
      await video.play()
      setPlaying(true)
      startLoop()
    } catch {
      stopLoop()
      setPlaying(false)
    }
  }, [startLoop, stopLoop])

  const pause = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.pause()
    stopLoop()
    setPlaying(false)
  }, [stopLoop])

  const togglePlay = useCallback(async () => {
    if (playing) {
      pause()
    } else {
      await play()
    }
  }, [playing, play, pause])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopLoop()
  }, [stopLoop])

  // Keep state in sync with media element lifecycle.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleEnded = () => {
      stopLoop()
      setPlaying(false)
    }

    const handleError = () => {
      stopLoop()
      setPlaying(false)
    }

    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)
    return () => {
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
    }
  }, [stopLoop])

  return {
    videoRef,
    canvasRef,
    containerRef,
    playing,
    fps,
    play,
    pause,
    togglePlay,
  }
}
