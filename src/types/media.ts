export interface MediaAsset {
  id: string
  projectId: string
  fileName: string
  mimeType: string
  size: number
  duration: number
  width: number
  height: number
  opfsPath: string
  thumbnailPath: string | null
  createdAt: number
}

export interface ImportResult {
  asset: MediaAsset
  thumbnailGenerated: boolean
}

export interface ThumbnailInfo {
  path: string
  width: number
  height: number
}
