import { useCallback } from 'react'
import { useMediaStore } from '../stores/media-store'
import { useProjectStore } from '../stores/project-store'
import { importMediaFile } from '../services/media-import'
import type { Clip } from '../types/project'
import { newId } from '../utils/id'

export function useMediaImport() {
  const setImporting = useMediaStore((s) => s.setImporting)
  const setImportProgress = useMediaStore((s) => s.setImportProgress)
  const addAsset = useMediaStore((s) => s.addAsset)
  const currentProject = useProjectStore((s) => s.currentProject)
  const addClip = useProjectStore((s) => s.addClip)

  const importFile = useCallback(async (file: File) => {
    if (!currentProject) throw new Error('No active project')

    setImporting(true)
    setImportProgress(0)

    try {
      const result = await importMediaFile(file, currentProject.id, (progress) => {
        setImportProgress(progress)
      })
      addAsset(result.asset)

      // Auto-create a clip on the timeline for the imported asset
      const clip: Clip = {
        id: newId('clip'),
        mediaAssetId: result.asset.id,
        trim: { start: 0, duration: result.asset.duration },
        order: currentProject.timeline.clips.length,
      }
      addClip(clip)

      return result
    } finally {
      setImporting(false)
      setImportProgress(0)
    }
  }, [currentProject, setImporting, setImportProgress, addAsset, addClip])

  return { importFile }
}
