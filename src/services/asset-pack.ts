import { getDB } from '../storage/db'
import type { AssetPackRecord } from '../storage/db'

export interface AssetPackManifest {
  packId: string
  name: string
  version: number
  description: string
  files: AssetPackFile[]
  totalSize: number
}

export interface AssetPackFile {
  path: string
  url: string
  size: number
  type: string
}

const CACHE_PREFIX = 'asset-pack-'

export async function getInstalledPacks(): Promise<AssetPackRecord[]> {
  const db = await getDB()
  return db.getAll('assetPacks')
}

export async function downloadPack(
  manifest: AssetPackManifest,
  onProgress?: (downloaded: number, total: number) => void,
): Promise<void> {
  const cacheName = CACHE_PREFIX + manifest.packId
  const cache = await caches.open(cacheName)

  let downloaded = 0
  for (const file of manifest.files) {
    const response = await fetch(file.url)
    if (!response.ok) throw new Error(`Failed to download ${file.path}: ${response.status}`)
    await cache.put(file.path, response)
    downloaded += file.size
    onProgress?.(downloaded, manifest.totalSize)
  }

  // Record in IndexedDB
  const db = await getDB()
  await db.put('assetPacks', {
    packId: manifest.packId,
    name: manifest.name,
    version: manifest.version,
    installedAt: Date.now(),
  })
}

export async function deletePack(packId: string): Promise<void> {
  const cacheName = CACHE_PREFIX + packId
  await caches.delete(cacheName)
  const db = await getDB()
  await db.delete('assetPacks', packId)
}

export async function getPackAsset(packId: string, path: string): Promise<Response | undefined> {
  const cacheName = CACHE_PREFIX + packId
  const cache = await caches.open(cacheName)
  return cache.match(path)
}
