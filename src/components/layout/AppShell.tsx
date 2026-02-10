import { useEffect, useState } from 'react'
import { useUIStore } from '../../stores/ui-store'
import { useProjectStore } from '../../stores/project-store'
import { useMediaStore } from '../../stores/media-store'
import { BottomNav } from './BottomNav'
import { VideoPreview } from '../preview/VideoPreview'
import { ProjectList } from '../project/ProjectList'
import { SettingsPanel } from '../settings/SettingsPanel'
import { MediaImportSheet } from '../import/MediaImportSheet'
import { NewProjectSheet } from '../project/NewProjectSheet'
import { ImportProgress } from '../import/ImportProgress'
import { readThumbnail, deleteMediaFile, deleteThumbnail } from '../../storage/media-storage'
import type { MediaAsset } from '../../types/media'
import { deleteMediaAsset } from '../../storage/project-persistence'
import { AssetPacksSheet } from '../settings/AssetPacksSheet'

function AssetThumb({ asset }: { asset: MediaAsset }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)

  useEffect(() => {
    let revoked = false
    if (asset.thumbnailPath) {
      readThumbnail(asset.thumbnailPath)
        .then((blob) => {
          if (!revoked) setThumbUrl(URL.createObjectURL(blob))
        })
        .catch(() => {})
    }
    return () => {
      revoked = true
      setThumbUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [asset.thumbnailPath])

  return (
    <div className="bg-slate-700 rounded-lg overflow-hidden">
      <div
        className="aspect-video bg-slate-600"
        style={thumbUrl ? { backgroundImage: `url(${thumbUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      />
      <div className="p-2">
        <p className="text-xs text-white truncate">{asset.fileName}</p>
        <p className="text-[10px] text-slate-400">
          {asset.duration.toFixed(1)}s &middot; {(asset.size / 1024 / 1024).toFixed(1)}MB
        </p>
      </div>
    </div>
  )
}

function EditorContent() {
  const openSheet = useUIStore((s) => s.openSheet)
  const clips = useProjectStore((s) => s.currentProject?.timeline.clips) ?? []
  const assets = useMediaStore((s) => s.assets)
  const removeClip = useProjectStore((s) => s.removeClip)
  const removeAsset = useMediaStore((s) => s.removeAsset)

  return (
    <div>
      <ImportProgress />
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-white">
          Media ({assets.length})
        </h2>
        <button
          onClick={() => openSheet('import')}
          className="text-xs text-blue-400 active:text-blue-300"
        >
          + Import
        </button>
      </div>

      {assets.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-slate-500 text-sm">No media yet</p>
          <button
            onClick={() => openSheet('import')}
            className="mt-2 text-blue-400 text-sm active:text-blue-300"
          >
            Import your first video
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {assets.map((asset) => {
            const clip = clips.find((c) => c.mediaAssetId === asset.id)
            return (
              <div key={asset.id} className="flex items-center gap-3 bg-slate-800 rounded-lg p-2">
                <div className="w-20 shrink-0">
                  <AssetThumb asset={asset} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{asset.fileName}</p>
                  <p className="text-[10px] text-slate-400">
                    {asset.duration.toFixed(1)}s &middot; {(asset.size / 1024 / 1024).toFixed(1)}MB
                  </p>
                  {clip && (
                    <p className="text-[10px] text-slate-500">
                      Trim: {clip.trim.start.toFixed(1)}s – {(clip.trim.start + clip.trim.duration).toFixed(1)}s
                    </p>
                  )}
                </div>
                <button
                  onClick={async () => {
                    const clipsToRemove = clips.filter((c) => c.mediaAssetId === asset.id)
                    for (const c of clipsToRemove) removeClip(c.id)

                    // Delete persistent records/files so reload doesn't resurrect assets.
                    await deleteMediaAsset(asset.id)
                    await deleteMediaFile(asset.opfsPath)
                    if (asset.thumbnailPath) await deleteThumbnail(asset.thumbnailPath)

                    removeAsset(asset.id)
                  }}
                  className="text-xs text-red-400 active:text-red-300 shrink-0 px-2"
                >
                  Remove
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function AppShell() {
  const activePanel = useUIStore((s) => s.activePanel)
  const hasProject = useProjectStore((s) => s.currentProject !== null)

  return (
    <div className="h-full flex flex-col">
      {/* Preview area — top ~50% when in editor mode */}
      {activePanel === 'editor' && hasProject && (
        <div className="shrink-0 p-3 pt-[env(safe-area-inset-top)]">
          <VideoPreview />
        </div>
      )}

      {/* Content area */}
      <main className="flex-1 overflow-y-auto p-4">
        {activePanel === 'projects' && <ProjectList />}
        {activePanel === 'editor' && hasProject && <EditorContent />}
        {activePanel === 'editor' && !hasProject && (
          <div className="text-center py-12">
            <p className="text-slate-500 text-sm">No project open</p>
            <p className="text-slate-600 text-xs mt-1">Go to Projects to create or open one</p>
          </div>
        )}
        {activePanel === 'settings' && <SettingsPanel />}
      </main>

      {/* Bottom nav */}
      <BottomNav />

      {/* Sheets (portals) */}
      <MediaImportSheet />
      <NewProjectSheet />
      <AssetPacksSheet />
    </div>
  )
}
