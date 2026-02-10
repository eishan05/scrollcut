import { useCallback, useEffect, useReducer, useState } from 'react'
import type { Project } from '../../types/project'
import { listProjects, deleteProject } from '../../storage/project-persistence'
import { useProjectStore } from '../../stores/project-store'
import { useMediaStore } from '../../stores/media-store'
import { useUIStore } from '../../stores/ui-store'
import { useHistoryStore } from '../../stores/history-store'
import { getProjectMediaAssets } from '../../storage/project-persistence'
import { ProjectCard } from './ProjectCard'

export function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([])
  const [refreshKey, refresh] = useReducer((x: number) => x + 1, 0)
  const setProject = useProjectStore((s) => s.setProject)
  const setAssets = useMediaStore((s) => s.setAssets)
  const setActivePanel = useUIStore((s) => s.setActivePanel)
  const openSheet = useUIStore((s) => s.openSheet)

  useEffect(() => {
    let cancelled = false
    listProjects().then((list) => {
      if (!cancelled) setProjects(list)
    })
    return () => { cancelled = true }
  }, [refreshKey])

  const handleOpen = useCallback(async (project: Project) => {
    setProject(project)
    const assets = await getProjectMediaAssets(project.id)
    setAssets(assets)
    setActivePanel('editor')

    // Initialize undo history with the loaded project
    useHistoryStore.getState().clear()
    useHistoryStore.getState().pushSnapshot(project)
  }, [setProject, setAssets, setActivePanel])

  const handleDelete = useCallback(async (projectId: string) => {
    await deleteProject(projectId)
    refresh()
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white">Projects</h2>
        <button
          onClick={() => openSheet('new-project')}
          className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg active:bg-blue-700"
        >
          New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 text-sm">No projects yet</p>
          <button
            onClick={() => openSheet('new-project')}
            className="mt-3 text-blue-400 text-sm active:text-blue-300"
          >
            Create your first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={handleOpen}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
