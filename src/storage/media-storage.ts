import { opfs } from './opfs'
import { getDB } from './db'

function mediaPath(projectId: string, assetId: string, ext: string): string {
  return `projects/${projectId}/media/${assetId}.${ext}`
}

function thumbnailPath(projectId: string, assetId: string): string {
  return `projects/${projectId}/thumbnails/${assetId}.jpg`
}

function canUseOpfs(): boolean {
  // OPFS requires secure context in Chromium; on Android LAN dev over http it's typically unavailable.
  return Boolean(globalThis.isSecureContext && navigator.storage && 'getDirectory' in navigator.storage)
}

export async function writeMediaFile(
  projectId: string,
  assetId: string,
  ext: string,
  data: ArrayBuffer,
  mimeType = 'application/octet-stream',
): Promise<string> {
  const path = mediaPath(projectId, assetId, ext)
  if (canUseOpfs()) {
    try {
      await opfs.mkdir(`projects/${projectId}/media`)
      await opfs.write(path, data)
      return path
    } catch {
      // Fall back to IndexedDB below.
    }
  }

  const db = await getDB()
  await db.put('mediaFiles', new Blob([data], { type: mimeType }), path)
  return path
}

export async function readMediaFile(path: string): Promise<ArrayBuffer> {
  if (canUseOpfs()) {
    try {
      return await opfs.read(path)
    } catch {
      // Fall back to IndexedDB below.
    }
  }

  const db = await getDB()
  const blob = await db.get('mediaFiles', path)
  if (!blob) throw new Error('Media file not found')
  return blob.arrayBuffer()
}

export async function getMediaFile(
  path: string,
  info?: { fileName?: string; mimeType?: string },
): Promise<File> {
  if (canUseOpfs()) {
    try {
      return await opfs.file(path)
    } catch {
      // Fall back to IndexedDB below.
    }
  }

  const db = await getDB()
  const blob = await db.get('mediaFiles', path)
  if (!blob) throw new Error('Media file not found')

  const fallbackName = path.split('/').filter(Boolean).pop() ?? 'media'
  const name = info?.fileName ?? fallbackName
  const type = info?.mimeType ?? (blob.type || 'application/octet-stream')
  return new File([blob], name, { type, lastModified: Date.now() })
}

export async function deleteMediaFile(path: string): Promise<void> {
  if (canUseOpfs()) {
    try {
      await opfs.delete(path)
      return
    } catch {
      // fall through to IDB cleanup
    }
  }
  const db = await getDB()
  await db.delete('mediaFiles', path)
}

export async function writeThumbnail(projectId: string, assetId: string, data: ArrayBuffer): Promise<string> {
  const path = thumbnailPath(projectId, assetId)
  if (canUseOpfs()) {
    try {
      await opfs.mkdir(`projects/${projectId}/thumbnails`)
      await opfs.write(path, data)
      return path
    } catch {
      // Fall back to IndexedDB below.
    }
  }

  const db = await getDB()
  await db.put('thumbnails', new Blob([data], { type: 'image/jpeg' }), path)
  return path
}

export async function readThumbnail(path: string): Promise<Blob> {
  if (canUseOpfs()) {
    try {
      const data = await opfs.read(path)
      return new Blob([data], { type: 'image/jpeg' })
    } catch {
      // Fall back to IndexedDB below.
    }
  }

  const db = await getDB()
  const blob = await db.get('thumbnails', path)
  if (!blob) throw new Error('Thumbnail not found')
  return blob
}

export async function deleteThumbnail(path: string): Promise<void> {
  if (canUseOpfs()) {
    try {
      await opfs.delete(path)
      return
    } catch {
      // fall through to IDB cleanup
    }
  }
  const db = await getDB()
  await db.delete('thumbnails', path)
}
