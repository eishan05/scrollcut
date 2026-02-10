import { useCallback, useMemo, useRef, useState } from 'react'
import { createLogger } from '../utils/log'
import { LogPanel } from '../components/LogPanel'

const MIME_CANDIDATES = [
  'video/mp4',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=h264,aac',
  'video/webm',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=h264',
]

export function ExportTest() {
  const logger = useMemo(() => createLogger(), [])
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(URL.createObjectURL(file))
    logger.info(`Source video: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`)
  }, [videoUrl, logger])

  const checkMimeSupport = useCallback(() => {
    logger.info('--- MIME Type Support ---')
    for (const mime of MIME_CANDIDATES) {
      const supported = MediaRecorder.isTypeSupported(mime)
      if (supported) {
        logger.pass(`${mime}`)
      } else {
        logger.fail(`${mime}`)
      }
    }
  }, [logger])

  const startRecording = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    // Set canvas size
    canvas.width = 1080
    canvas.height = 1920

    const ctx = canvas.getContext('2d')!

    // Set up audio context
    const audioCtx = new AudioContext()
    const source = audioCtx.createMediaElementSource(video)
    const dest = audioCtx.createMediaStreamDestination()

    // Add a subtle test tone
    const osc = audioCtx.createOscillator()
    const oscGain = audioCtx.createGain()
    osc.frequency.value = 440
    oscGain.gain.value = 0.05
    osc.connect(oscGain)
    oscGain.connect(dest)
    osc.start()

    // Connect video audio to both destination and speakers
    const gainNode = audioCtx.createGain()
    gainNode.gain.value = 1
    source.connect(gainNode)
    gainNode.connect(dest)
    gainNode.connect(audioCtx.destination)

    // Combine canvas stream + audio
    const canvasStream = canvas.captureStream(30)
    const combined = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ])

    // Choose MIME type
    let mimeType = 'video/mp4'
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8,opus'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm'
      }
    }

    logger.info(`Recording MIME: ${mimeType}`)

    const recorder = new MediaRecorder(combined, {
      mimeType,
      videoBitsPerSecond: 5_000_000,
    })
    recorderRef.current = recorder
    const chunks: Blob[] = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    recorder.onstop = () => {
      osc.stop()
      audioCtx.close()
      const blob = new Blob(chunks, { type: mimeType })
      if (resultUrl) URL.revokeObjectURL(resultUrl)
      const url = URL.createObjectURL(blob)
      setResultUrl(url)
      logger.pass(`Recording complete: ${(blob.size / 1024 / 1024).toFixed(2)}MB`)
      logger.info(`Blob MIME: ${blob.type}`)
      logger.info(`Is MP4: ${blob.type.includes('mp4') ? 'YES' : 'NO'}`)
      setRecording(false)
    }

    recorder.onerror = (e) => {
      logger.fail(`Recorder error: ${e}`)
      setRecording(false)
    }

    // Render loop: draw video frames + overlays onto canvas
    const startTime = performance.now()
    let frameCount = 0

    const renderFrame = () => {
      if (recorder.state !== 'recording') return

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Text overlay
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(40, 40, 400, 60)
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 28px sans-serif'
      ctx.fillText(`Export Test - ${video.currentTime.toFixed(1)}s`, 60, 80)

      // Frame counter
      frameCount++
      ctx.fillStyle = '#4ade80'
      ctx.font = '20px monospace'
      ctx.fillText(`Frame: ${frameCount}`, 60, 130)

      requestAnimationFrame(renderFrame)
    }

    // Start
    video.currentTime = 0
    await video.play()
    recorder.start(100)
    setRecording(true)
    renderFrame()
    logger.info('Recording started...')

    // Auto-stop after video ends or 15s
    const maxDuration = Math.min(video.duration, 15) * 1000
    setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop()
        video.pause()
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1)
        logger.info(`Recorded ${elapsed}s, ${frameCount} frames (${(frameCount / parseFloat(elapsed)).toFixed(1)} fps)`)
      }
    }, maxDuration)
  }, [videoUrl, resultUrl, logger])

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
      videoRef.current?.pause()
    }
  }, [])

  return (
    <div>
      <h2 className="text-base font-semibold mb-3">Export Test</h2>
      <p className="text-xs text-slate-400 mb-3">
        Validates MediaRecorder capturing Canvas + WebAudio to MP4.
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
          onClick={checkMimeSupport}
          className="bg-slate-700 text-white text-sm px-4 py-2 rounded-lg active:bg-slate-600"
        >
          Check MIME
        </button>
        {videoUrl && !recording && (
          <button
            onClick={startRecording}
            className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg active:bg-green-700"
          >
            Record
          </button>
        )}
        {recording && (
          <button
            onClick={stopRecording}
            className="bg-red-600 text-white text-sm px-4 py-2 rounded-lg active:bg-red-700"
          >
            Stop
          </button>
        )}
      </div>

      {/* Hidden source video */}
      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          muted={false}
          className="hidden"
          onLoadedMetadata={() => {
            const v = videoRef.current!
            logger.info(`Source: ${v.videoWidth}x${v.videoHeight}, ${v.duration.toFixed(1)}s`)
          }}
        />
      )}

      {/* Hidden render canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Result playback */}
      {resultUrl && (
        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2 text-slate-300">Result:</h3>
          <video
            src={resultUrl}
            controls
            playsInline
            className="w-full max-w-[270px] mx-auto rounded-lg bg-black"
            style={{ aspectRatio: '9/16' }}
          />
          <div className="mt-2 text-center">
            <a
              href={resultUrl}
              download="export-test.mp4"
              className="text-blue-400 text-sm underline"
            >
              Download Result
            </a>
          </div>
        </div>
      )}

      <LogPanel logger={logger} />
    </div>
  )
}
