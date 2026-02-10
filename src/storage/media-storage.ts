import { opfs } from './opfs'

function mediaPath(projectId: string, assetId: string, ext: string): string {
  return `projects/${projectId}/media/${assetId}.${ext}`
}

function thumbnailPath(projectId: string, assetId: string): string {
  return `projects/${projectId}/thumbnails/${assetId}.jpg`
}

export async function writeMediaFile(projectId: string, assetId: string, ext: string, data: ArrayBuffer): Promise<string> {
  const path = mediaPath(projectId, assetId, ext)
  await opfs.mkdir(`projects/${projectId}/media`)
  await opfs.write(path, data)
  return path
}

export async function readMediaFile(path: string): Promise<ArrayBuffer> {
  return opfs.read(path)
}

export async function deleteMediaFile(path: string): Promise<void> {
  try {
    await opfs.delete(path)
  } catch {
    // File may already be deleted
  }
}

export async function writeThumbnail(projectId: string, assetId: string, data: ArrayBuffer): Promise<string> {
  const path = thumbnailPath(projectId, assetId)
  await opfs.mkdir(`projects/${projectId}/thumbnails`)
  await opfs.write(path, data)
  return path
}

export async function readThumbnail(path: string): Promise<Blob> {
  const data = await opfs.read(path)
  return new Blob([data], { type: 'image/jpeg' })
}

export async function deleteThumbnail(path: string): Promise<void> {
  try {
    await opfs.delete(path)
  } catch {
    // File may already be deleted
  }
}
