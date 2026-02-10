import { useEffect } from 'react'
import { AppShell } from './components/layout/AppShell'
import { useAutoSave } from './hooks/use-auto-save'
import { recoverAutoSave, clearAutoSave } from './storage/auto-save'
import { useProjectStore } from './stores/project-store'
import { useMediaStore } from './stores/media-store'
import { useUIStore } from './stores/ui-store'
import { useHistoryStore } from './stores/history-store'
import { getProjectMediaAssets } from './storage/project-persistence'

export default function App() {
  useAutoSave()

  // Crash recovery on startup
  useEffect(() => {
    recoverAutoSave().then(async (project) => {
      if (project) {
        useProjectStore.getState().setProject(project)
        const assets = await getProjectMediaAssets(project.id)
        useMediaStore.getState().setAssets(assets)
        useUIStore.getState().setActivePanel('editor')
        await clearAutoSave()

        // Initialize history with recovered project
        useHistoryStore.getState().clear()
        useHistoryStore.getState().pushSnapshot(project)
      }
    })
  }, [])

  return <AppShell />
}
