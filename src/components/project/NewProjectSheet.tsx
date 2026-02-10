import { useState } from 'react'
import { BottomSheet } from '../layout/BottomSheet'
import { useUIStore } from '../../stores/ui-store'
import { useProjectStore } from '../../stores/project-store'
import { useMediaStore } from '../../stores/media-store'
import { useHistoryStore } from '../../stores/history-store'
import type { AspectRatio } from '../../types/common'

const ASPECT_OPTIONS: { value: AspectRatio; label: string; desc: string }[] = [
  { value: '9:16', label: '9:16', desc: 'Reels / Shorts / TikTok' },
  { value: '1:1', label: '1:1', desc: 'Square' },
  { value: '4:5', label: '4:5', desc: 'Instagram Portrait' },
]

export function NewProjectSheet() {
  const activeSheet = useUIStore((s) => s.activeSheet)
  const closeSheet = useUIStore((s) => s.closeSheet)
  const setActivePanel = useUIStore((s) => s.setActivePanel)
  const createProject = useProjectStore((s) => s.createProject)
  const setAssets = useMediaStore((s) => s.setAssets)

  const [name, setName] = useState('')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16')

  const handleCreate = () => {
    const projectName = name.trim() || 'Untitled Project'
    const project = createProject(projectName, aspectRatio)
    setAssets([])
    setName('')
    setAspectRatio('9:16')
    closeSheet()
    setActivePanel('editor')

    // Initialize undo history with the new project
    useHistoryStore.getState().clear()
    useHistoryStore.getState().pushSnapshot(project)
  }

  return (
    <BottomSheet
      open={activeSheet === 'new-project'}
      onClose={closeSheet}
      title="New Project"
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Project Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Untitled Project"
            className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Aspect Ratio</label>
          <div className="flex gap-2">
            {ASPECT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setAspectRatio(opt.value)}
                className={`flex-1 py-2.5 rounded-lg text-center transition-colors ${
                  aspectRatio === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-400 active:bg-slate-600'
                }`}
              >
                <span className="text-sm font-medium block">{opt.label}</span>
                <span className="text-[10px] opacity-70">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleCreate}
          className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-medium active:bg-blue-700"
        >
          Create Project
        </button>
      </div>
    </BottomSheet>
  )
}
