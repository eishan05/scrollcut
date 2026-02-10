import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createLogger } from '../utils/log'
import { LogPanel } from '../components/LogPanel'

export function PreviewTest() {
  const logger = useMemo(() => createLogger(), [])
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [fps, setFps] = useState(0)
  const animRef = useRef<number>(0)
  const frameCountRef = useRef(0)
  const lastFpsTimeRef = useRef(0)

  // Detect API support
  useEffect(() => {
    const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype
    logger.info(`requestVideoFrameCallback: ${hasRVFC ? 'supported' : 'NOT supported'}`)
    logger.info(`devicePixelRatio: ${window.devicePixelRatio}`)
    logger.info(`screen: ${screen.width}x${screen.height}`)
  }, [logger])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    logger.info(`Loaded video: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`)
  }, [videoUrl, logger])

  // Canvas overlay rendering loop
  const renderOverlay = useCallback(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const now = performance.now()

    // FPS calculation
    frameCountRef.current++
    if (now - lastFpsTimeRef.current >= 1000) {
      setFps(frameCountRef.current)
      frameCountRef.current = 0
      lastFpsTimeRef.current = now
    }

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Timestamp overlay
    const t = video.currentTime
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(10, 10, 200, 36)
    ctx.fillStyle = '#fff'
    ctx.font = '16px monospace'
    ctx.fillText(`Time: ${t.toFixed(2)}s`, 20, 34)

    // Moving circle
    const cx = (Math.sin(now / 500) * 0.3 + 0.5) * canvas.width
    const cy = (Math.cos(now / 700) * 0.3 + 0.5) * canvas.height
    ctx.beginPath()
    ctx.arc(cx, cy, 20, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(59, 130, 246, 0.7)'
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()

    // FPS overlay
    ctx.fillStyle = fps >= 25 ? '#4ade80' : fps >= 15 ? '#facc15' : '#ef4444'
    ctx.fillRect(canvas.width - 80, 10, 70, 28)
    ctx.fillStyle = '#000'
    ctx.font = 'bold 14px monospace'
    ctx.fillText(`${fps} fps`, canvas.width - 72, 30)
  }, [fps])

  // Animation loop using rVFC or rAF
  const startLoop = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype

    if (hasRVFC) {
      const onFrame = () => {
        renderOverlay()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(video as any).requestVideoFrameCallback(onFrame)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(video as any).requestVideoFrameCallback(onFrame)
      logger.info('Using requestVideoFrameCallback for sync')
    }

    // Always run rAF too for smooth overlay animation
    const rafLoop = () => {
      renderOverlay()
      animRef.current = requestAnimationFrame(rafLoop)
    }
    animRef.current = requestAnimationFrame(rafLoop)
  }, [renderOverlay, logger])

  const handlePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (playing) {
      video.pause()
      cancelAnimationFrame(animRef.current)
      setPlaying(false)
      logger.info('Paused')
    } else {
      video.play().then(() => {
        setPlaying(true)
        startLoop()
        logger.info('Playing')
      }).catch(err => {
        logger.fail(`Play failed: ${err.message}`)
      })
    }
  }, [playing, startLoop, logger])

  // Size canvas to match container
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resize = () => {
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [videoUrl])

  return (
    <div>
      <h2 className="text-base font-semibold mb-3">Preview Test</h2>
      <p className="text-xs text-slate-400 mb-3">
        Validates video playback + Canvas overlay compositing. Pick a video, play it, and watch the FPS counter.
      </p>

      {/* File picker */}
      <div className="flex gap-2 mb-4">
        <label className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg cursor-pointer active:bg-blue-700">
          Choose Video
          <input
            type="file"
            accept="video/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
        {videoUrl && (
          <button
            onClick={handlePlay}
            className="bg-slate-700 text-white text-sm px-4 py-2 rounded-lg active:bg-slate-600"
          >
            {playing ? 'Pause' : 'Play'}
          </button>
        )}
      </div>

      {/* Preview area (9:16 aspect) */}
      {videoUrl && (
        <div
          ref={containerRef}
          className="relative w-full max-w-[270px] mx-auto bg-black rounded-lg overflow-hidden"
          style={{ aspectRatio: '9/16' }}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            onLoadedMetadata={() => {
              const v = videoRef.current!
              logger.info(`Video: ${v.videoWidth}x${v.videoHeight}, duration ${v.duration.toFixed(1)}s`)
            }}
          />
          {/* Animated text overlay (DOM) */}
          <div className="absolute top-4 left-0 right-0 text-center pointer-events-none">
            <span
              className="inline-block bg-black/60 text-white text-sm px-3 py-1 rounded-full"
              style={{ animation: 'pulse 2s ease-in-out infinite' }}
            >
              DOM Text Overlay
            </span>
          </div>
          {/* Canvas overlay */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
          />
        </div>
      )}

      <LogPanel logger={logger} />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
      `}</style>
    </div>
  )
}
