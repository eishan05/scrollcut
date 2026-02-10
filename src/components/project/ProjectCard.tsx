import { useEffect, useState } from 'react'
import type { Project } from '../../types/project'
import { getProjectMediaAssets } from '../../storage/project-persistence'
import { readThumbnail } from '../../storage/media-storage'

interface ProjectCardProps {
  project: Project
  onOpen: (project: Project) => void
  onDelete: (projectId: string) => void
}

export function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)

  useEffect(() => {
    let revoked = false
    getProjectMediaAssets(project.id).then((assets) => {
      const withThumb = assets.find((a) => a.thumbnailPath)
      if (withThumb?.thumbnailPath && !revoked) {
        readThumbnail(withThumb.thumbnailPath)
          .then((blob) => {
            if (!revoked) setThumbnailUrl(URL.createObjectURL(blob))
          })
          .catch(() => {})
      }
    })
    return () => {
      revoked = true
      setThumbnailUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [project.id])

  const date = new Date(project.updatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => onOpen(project)}
        className="w-full text-left"
      >
        <div
          className="aspect-video bg-slate-700 flex items-center justify-center"
          style={thumbnailUrl ? { backgroundImage: `url(${thumbnailUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        >
          {!thumbnailUrl && (
            <span className="text-slate-500 text-2xl">🎬</span>
          )}
        </div>
        <div className="p-3">
          <p className="text-sm font-medium text-white truncate">{project.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {project.aspectRatio} &middot; {date}
          </p>
        </div>
      </button>
      <div className="px-3 pb-3">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(project.id)
          }}
          className="text-xs text-red-400 active:text-red-300"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
