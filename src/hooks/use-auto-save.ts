import { useEffect } from 'react'
import { useProjectStore } from '../stores/project-store'
import { scheduleSave, startPeriodicSave, stopPeriodicSave, saveImmediately } from '../storage/auto-save'

export function useAutoSave(): void {
  useEffect(() => {
    // Subscribe to dirty changes for debounced save
    const unsubscribe = useProjectStore.subscribe(
      (state) => ({ project: state.currentProject, dirty: state.isDirty }),
      ({ project, dirty }) => {
        if (project && dirty) {
          scheduleSave(project)
        }
      },
      { equalityFn: (a, b) => a.dirty === b.dirty && a.project?.updatedAt === b.project?.updatedAt },
    )

    // Periodic safety-net save
    startPeriodicSave()

    // Save on visibility change (iOS backgrounding) and pagehide
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const { currentProject, isDirty } = useProjectStore.getState()
        if (currentProject && isDirty) {
          saveImmediately(currentProject)
        }
      }
    }

    const handlePageHide = () => {
      const { currentProject, isDirty } = useProjectStore.getState()
      if (currentProject && isDirty) {
        saveImmediately(currentProject)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      unsubscribe()
      stopPeriodicSave()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [])
}
