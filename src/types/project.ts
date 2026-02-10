import type { AspectRatio, TimeRange } from './common'

export interface TextOverlay {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  color: string
  fontFamily: string
  time: TimeRange
}

export interface Clip {
  id: string
  mediaAssetId: string
  trim: TimeRange
  order: number
}

export interface Timeline {
  clips: Clip[]
  overlays: TextOverlay[]
}

export interface Project {
  id: string
  name: string
  aspectRatio: AspectRatio
  timeline: Timeline
  createdAt: number
  updatedAt: number
}
