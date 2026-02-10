const CELL_WIDTH = 80
const CELL_HEIGHT = 45
const CELL_QUALITY = 0.5
const MAX_CACHE_SIZE = 80

interface CacheEntry {
  key: string
  urls: (string | null)[]
  lastUsed: number
}

type Listener = (key: string, urls: (string | null)[]) => void

class ThumbnailStripService {
  private cache = new Map<string, CacheEntry>()
  private queue: Array<{
    key: string
    videoUrl: string
    trimStart: number
    trimDuration: number
    cellCount: number
  }> = []
  private processing = false
  private listeners = new Set<Listener>()

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(key: string, urls: (string | null)[]) {
    for (const fn of this.listeners) fn(key, urls)
  }

  getCacheKey(mediaAssetId: string, cellCount: number): string {
    return `${mediaAssetId}:${cellCount}`
  }

  getCached(key: string): (string | null)[] | null {
    const entry = this.cache.get(key)
    if (entry) {
      entry.lastUsed = Date.now()
      return entry.urls
    }
    return null
  }

  request(
    mediaAssetId: string,
    videoUrl: string,
    trimStart: number,
    trimDuration: number,
    cellCount: number,
  ): void {
    const key = this.getCacheKey(mediaAssetId, cellCount)

    // Already cached
    if (this.cache.has(key)) return

    // Already queued
    if (this.queue.some((q) => q.key === key)) return

    this.queue.push({ key, videoUrl, trimStart, trimDuration, cellCount })
    this.processQueue()
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true

    while (this.queue.length > 0) {
      const item = this.queue.shift()!
      // Skip if already cached (may have been extracted by a prior queued item)
      if (this.cache.has(item.key)) continue

      try {
        const urls = await this.extractStrip(
          item.videoUrl,
          item.trimStart,
          item.trimDuration,
          item.cellCount,
        )
        this.addToCache(item.key, urls)
        this.notify(item.key, urls)
      } catch {
        // Failed — push nulls so we don't retry indefinitely
        const nulls = new Array(item.cellCount).fill(null)
        this.addToCache(item.key, nulls)
        this.notify(item.key, nulls)
      }
    }

    this.processing = false
  }

  private addToCache(key: string, urls: (string | null)[]): void {
    // Evict if at capacity
    while (this.cache.size >= MAX_CACHE_SIZE) {
      let oldest: string | null = null
      let oldestTime = Infinity
      for (const [k, entry] of this.cache) {
        if (entry.lastUsed < oldestTime) {
          oldest = k
          oldestTime = entry.lastUsed
        }
      }
      if (oldest) {
        const entry = this.cache.get(oldest)!
        for (const url of entry.urls) {
          if (url) URL.revokeObjectURL(url)
        }
        this.cache.delete(oldest)
      }
    }

    this.cache.set(key, { key, urls, lastUsed: Date.now() })
  }

  private extractStrip(
    videoUrl: string,
    trimStart: number,
    trimDuration: number,
    cellCount: number,
  ): Promise<(string | null)[]> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true
      video.playsInline = true
      video.src = videoUrl

      const results: (string | null)[] = new Array(cellCount).fill(null)
      let currentCell = 0

      const canvas = document.createElement('canvas')
      canvas.width = CELL_WIDTH
      canvas.height = CELL_HEIGHT
      const ctx = canvas.getContext('2d')!

      const cleanup = () => {
        video.remove()
      }

      const seekNext = () => {
        if (currentCell >= cellCount) {
          cleanup()
          resolve(results)
          return
        }

        // Evenly spaced seek times within trim range
        const t = cellCount === 1
          ? trimStart + trimDuration * 0.5
          : trimStart + (trimDuration * currentCell) / (cellCount - 1)

        video.currentTime = Math.min(t, video.duration - 0.01)
      }

      video.onloadedmetadata = () => {
        seekNext()
      }

      video.onseeked = () => {
        try {
          ctx.drawImage(video, 0, 0, CELL_WIDTH, CELL_HEIGHT)
          canvas.toBlob(
            (blob) => {
              if (blob) {
                results[currentCell] = URL.createObjectURL(blob)
              }
              currentCell++
              seekNext()
            },
            'image/jpeg',
            CELL_QUALITY,
          )
        } catch {
          currentCell++
          seekNext()
        }
      }

      video.onerror = () => {
        cleanup()
        reject(new Error('Failed to load video for thumbnail strip'))
      }
    })
  }

  clear(): void {
    for (const [, entry] of this.cache) {
      for (const url of entry.urls) {
        if (url) URL.revokeObjectURL(url)
      }
    }
    this.cache.clear()
    this.queue = []
  }
}

export const thumbnailStripService = new ThumbnailStripService()
export { CELL_WIDTH }
