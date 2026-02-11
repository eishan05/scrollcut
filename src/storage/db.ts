import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Project } from '../types/project'
import type { MediaAsset } from '../types/media'

export interface AssetPackRecord {
  packId: string
  name: string
  version: number
  installedAt: number
}

export interface AutoSaveRecord {
  key: string
  project: Project
  savedAt: number
}

interface VideoEditorDB extends DBSchema {
  projects: {
    key: string
    value: Project
    indexes: { 'by-updated': number }
  }
  mediaAssets: {
    key: string
    value: MediaAsset
    indexes: { 'by-project': string }
  }
  // Fallback storage when OPFS isn't available (e.g. Android over plain HTTP LAN dev).
  // Key is the same "projects/<id>/media/<asset>.<ext>" style path used for OPFS.
  mediaFiles: {
    key: string
    value: Blob
  }
  thumbnails: {
    key: string
    value: Blob
  }
  assetPacks: {
    key: string
    value: AssetPackRecord
  }
  autoSave: {
    key: string
    value: AutoSaveRecord
  }
}

let dbPromise: Promise<IDBPDatabase<VideoEditorDB>> | null = null

export function getDB(): Promise<IDBPDatabase<VideoEditorDB>> {
  if (!dbPromise) {
    dbPromise = openDB<VideoEditorDB>('video-editor', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' })
          projectStore.createIndex('by-updated', 'updatedAt')

          const mediaStore = db.createObjectStore('mediaAssets', { keyPath: 'id' })
          mediaStore.createIndex('by-project', 'projectId')

          db.createObjectStore('assetPacks', { keyPath: 'packId' })
          db.createObjectStore('autoSave')
        }

        if (oldVersion < 2) {
          // No keyPath; we use explicit string keys.
          db.createObjectStore('mediaFiles')
          db.createObjectStore('thumbnails')
        }
      },
    })
  }
  return dbPromise
}

export type { VideoEditorDB }
