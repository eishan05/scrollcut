import { useCallback, useMemo, useRef, useState } from 'react'
import { createLogger } from '../utils/log'
import { LogPanel } from '../components/LogPanel'

const RESOLUTIONS = [
  { label: '720p', w: 720, h: 1280 },
  { label: '1080p', w: 1080, h: 1920 },
  { label: '1440p', w: 1440, h: 2560 },
]

export function LimitsTest() {
  const logger = useMemo(() => createLogger(), [])
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [running, setRunning] = useState(false)

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(URL.createObjectURL(file))
    logger.info(`Source: ${file.name}`)
  }, [videoUrl, logger])

  const reportDeviceInfo = useCallback(() => {
    logger.info('--- Device Info ---')
    logger.info(`UA: ${navigator.userAgent}`)
    logger.info(`DPR: ${window.devicePixelRatio}`)
    logger.info(`Screen: ${screen.width}x${screen.height}`)
    logger.info(`Viewport: ${window.innerWidth}x${window.innerHeight}`)
    logger.info(`Cores: ${navigator.hardwareConcurrency ?? 'unknown'}`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mem = (performance as any).memory
    if (mem) {
      logger.info(`JS Heap: ${(mem.usedJSHeapSize / 1024 / 1024).toFixed(0)}MB / ${(mem.jsHeapSizeLimit / 1024 / 1024).toFixed(0)}MB`)
    } else {
      logger.warn('performance.memory not available (non-Chrome)')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logger.info(`Max touch points: ${(navigator as any).maxTouchPoints ?? 'unknown'}`)
  }, [logger])

  const benchmarkRendering = useCallback(async () => {
    logger.info('--- Render Benchmark ---')
    const video = videoRef.current
    if (!video) {
      logger.fail('No video loaded')
      return
    }

    setRunning(true)

    for (const res of RESOLUTIONS) {
      logger.info(`Testing ${res.label} (${res.w}x${res.h})...`)

      const canvas = document.createElement('canvas')
      canvas.width = res.w
      canvas.height = res.h
      const ctx = canvas.getContext('2d')!

      // Render 60 frames and measure
      const frames = 60
      const start = performance.now()

      for (let i = 0; i < frames; i++) {
        // Draw video frame
        ctx.drawImage(video, 0, 0, res.w, res.h)

        // Draw overlays (simulate real compositing load)
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(20, 20, 300, 50)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 24px sans-serif'
        ctx.fillText(`Frame ${i} @ ${res.label}`, 30, 52)

        // Gradient bar
        const grad = ctx.createLinearGradient(0, res.h - 60, res.w, res.h - 60)
        grad.addColorStop(0, '#3b82f6')
        grad.addColorStop(1, '#8b5cf6')
        ctx.fillStyle = grad
        ctx.fillRect(0, res.h - 60, res.w * (i / frames), 60)

        // Force GPU flush by reading a pixel
        if (i % 10 === 0) ctx.getImageData(0, 0, 1, 1)

        // Yield to keep UI responsive
        if (i % 15 === 0) await new Promise(r => setTimeout(r, 0))
      }

      const elapsed = performance.now() - start
      const fps = (frames / (elapsed / 1000)).toFixed(1)
      const level = parseFloat(fps) >= 25 ? 'pass' : parseFloat(fps) >= 15 ? 'warn' : 'fail'
      logger[level](`${res.label}: ${fps} fps (${elapsed.toFixed(0)}ms for ${frames} frames)`)
    }

    setRunning(false)
  }, [logger])

  const benchmarkExport = useCallback(async () => {
    logger.info('--- Export Benchmark ---')
    const video = videoRef.current
    if (!video) {
      logger.fail('No video loaded')
      return
    }

    setRunning(true)

    for (const res of RESOLUTIONS) {
      logger.info(`Export test: ${res.label}...`)

      const canvas = document.createElement('canvas')
      canvas.width = res.w
      canvas.height = res.h
      const ctx = canvas.getContext('2d')!

      // Set up MediaRecorder
      const stream = canvas.captureStream(30)
      let mimeType = 'video/mp4'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm'
      }

      try {
        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 5_000_000,
        })
        const chunks: Blob[] = []
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data)
        }

        const done = new Promise<Blob>((resolve) => {
          recorder.onstop = () => {
            resolve(new Blob(chunks, { type: mimeType }))
          }
        })

        recorder.start(100)
        const exportStart = performance.now()

        // Render 5 seconds of frames at 30fps
        const totalFrames = 150
        for (let i = 0; i < totalFrames; i++) {
          ctx.drawImage(video, 0, 0, res.w, res.h)
          ctx.fillStyle = '#fff'
          ctx.font = 'bold 24px sans-serif'
          ctx.fillText(`${res.label} frame ${i}/${totalFrames}`, 30, 52)

          // ~33ms per frame for 30fps
          await new Promise(r => setTimeout(r, 33))
        }

        recorder.stop()
        const blob = await done
        const exportTime = performance.now() - exportStart

        logger.pass(
          `${res.label}: ${(exportTime / 1000).toFixed(1)}s export, ` +
          `${(blob.size / 1024 / 1024).toFixed(2)}MB output`
        )
      } catch (err) {
        logger.fail(`${res.label}: ${err instanceof Error ? err.message : err}`)
      }
    }

    setRunning(false)
  }, [logger])

  return (
    <div>
      <h2 className="text-base font-semibold mb-3">Limits Test</h2>
      <p className="text-xs text-slate-400 mb-3">
        Benchmarks rendering and export at different resolutions. Load a video first.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <label className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg cursor-pointer active:bg-blue-700">
          Choose Video
          <input
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
        <button
          onClick={reportDeviceInfo}
          className="bg-slate-700 text-white text-sm px-4 py-2 rounded-lg active:bg-slate-600"
        >
          Device Info
        </button>
        <button
          onClick={benchmarkRendering}
          disabled={!videoUrl || running}
          className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg active:bg-green-700 disabled:opacity-50"
        >
          Render Bench
        </button>
        <button
          onClick={benchmarkExport}
          disabled={!videoUrl || running}
          className="bg-purple-600 text-white text-sm px-4 py-2 rounded-lg active:bg-purple-700 disabled:opacity-50"
        >
          Export Bench
        </button>
      </div>

      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          muted
          className="hidden"
          onLoadedMetadata={() => {
            const v = videoRef.current!
            logger.info(`Video loaded: ${v.videoWidth}x${v.videoHeight}, ${v.duration.toFixed(1)}s`)
          }}
        />
      )}

      <LogPanel logger={logger} />
    </div>
  )
}
