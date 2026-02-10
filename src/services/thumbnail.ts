const THUMBNAIL_WIDTH = 320
const THUMBNAIL_QUALITY = 0.7

export async function extractThumbnail(videoFile: File | Blob, seekTime = 0.5): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(videoFile)

    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = url

    const cleanup = () => {
      URL.revokeObjectURL(url)
      video.remove()
    }

    video.onloadedmetadata = () => {
      // Seek to the requested time (clamped to duration)
      video.currentTime = Math.min(seekTime, video.duration * 0.5)
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        const aspect = video.videoWidth / video.videoHeight
        canvas.width = THUMBNAIL_WIDTH
        canvas.height = Math.round(THUMBNAIL_WIDTH / aspect)

        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        canvas.toBlob(
          (blob) => {
            cleanup()
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Failed to create thumbnail blob'))
            }
          },
          'image/jpeg',
          THUMBNAIL_QUALITY,
        )
      } catch (err) {
        cleanup()
        reject(err)
      }
    }

    video.onerror = () => {
      cleanup()
      reject(new Error('Failed to load video for thumbnail'))
    }
  })
}
