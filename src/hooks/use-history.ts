import { useEffect } from 'react'
import { useHistoryStore } from '../stores/history-store'
import { useProjectStore } from '../stores/project-store'

export function useHistory() {
  const canUndo = useHistoryStore((s) => s.canUndo)
  const canRedo = useHistoryStore((s) => s.canRedo)

  // Initialize history with current project on mount
  useEffect(() => {
    const project = useProjectStore.getState().currentProject
    if (project) {
      const state = useHistoryStore.getState()
      if (state.snapshots.length === 0) {
        state.pushSnapshot(project)
      }
    }
  }, [])

  const undo = () => {
    const snapshot = useHistoryStore.getState().undo()
    if (snapshot) {
      useProjectStore.getState().setProject(snapshot)
      useProjectStore.getState().markDirty()
    }
  }

  const redo = () => {
    const snapshot = useHistoryStore.getState().redo()
    if (snapshot) {
      useProjectStore.getState().setProject(snapshot)
      useProjectStore.getState().markDirty()
    }
  }

  return { undo, redo, canUndo, canRedo }
}
