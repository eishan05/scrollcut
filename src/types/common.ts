export type AspectRatio = '9:16' | '1:1' | '4:5'

export interface Dimensions {
  width: number
  height: number
}

export interface TimeRange {
  start: number
  duration: number
}

export const ASPECT_RATIO_VALUES: Record<AspectRatio, number> = {
  '9:16': 9 / 16,
  '1:1': 1,
  '4:5': 4 / 5,
}

export const EXPORT_DIMENSIONS: Record<AspectRatio, Dimensions> = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
}
