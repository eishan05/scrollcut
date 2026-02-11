import type { MediaAsset, ImportResult } from '../types/media'
import { writeMediaFile, writeThumbnail } from '../storage/media-storage'
import { saveMediaAsset } from '../storage/project-persistence'
import { extractThumbnail } from './thumbnail'
import { newId } from '../utils/id'

function getExtension(fileName: string): string {
  const parts = fileName.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : 'mp4'
}

async function getVideoMetadata(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = url

    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      })
      URL.revokeObjectURL(url)
      video.remove()
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      video.remove()
      reject(new Error('Failed to load video metadata'))
    }
  })
}

export async function importMediaFile(
  file: File,
  projectId: string,
  onProgress?: (progress: number) => void,
): Promise<ImportResult> {
  if (file.type && !file.type.startsWith('video/')) {
    throw new Error('Only video imports are supported right now')
  }

  const id = newId('asset')
  const ext = getExtension(file.name)

  onProgress?.(0.1)

  // Read file data
  const buffer = await file.arrayBuffer()
  onProgress?.(0.3)

  // Write to storage (OPFS when available; IndexedDB fallback on insecure contexts like Android LAN dev).
  const opfsPath = await writeMediaFile(projectId, id, ext, buffer, file.type || 'video/mp4')
  onProgress?.(0.5)

  // Extract metadata
  const metadata = await getVideoMetadata(file)
  onProgress?.(0.7)

  // Generate thumbnail
  let thumbnailPath: string | null = null
  let thumbnailGenerated = false
  try {
    const thumbBlob = await extractThumbnail(file)
    const thumbBuffer = await thumbBlob.arrayBuffer()
    thumbnailPath = await writeThumbnail(projectId, id, thumbBuffer)
    thumbnailGenerated = true
  } catch {
    // Thumbnail generation is best-effort
  }
  onProgress?.(0.9)

  // Create asset record
  const asset: MediaAsset = {
    id,
    projectId,
    fileName: file.name,
    mimeType: file.type || 'video/mp4',
    size: file.size,
    duration: metadata.duration,
    width: metadata.width,
    height: metadata.height,
    opfsPath,
    thumbnailPath,
    createdAt: Date.now(),
  }

  // Save to IndexedDB
  await saveMediaAsset(asset)
  onProgress?.(1.0)

  return { asset, thumbnailGenerated }
}
