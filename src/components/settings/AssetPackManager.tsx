import { useCallback, useEffect, useReducer, useState } from 'react'
import { getInstalledPacks, deletePack, type AssetPackManifest } from '../../services/asset-pack'
import type { AssetPackRecord } from '../../storage/db'

// No packs available yet — this is the framework for future packs
const AVAILABLE_PACKS: AssetPackManifest[] = []

export function AssetPackManager() {
  const [installed, setInstalled] = useState<AssetPackRecord[]>([])
  const [refreshKey, refresh] = useReducer((x: number) => x + 1, 0)

  useEffect(() => {
    let cancelled = false
    getInstalledPacks().then((packs) => {
      if (!cancelled) setInstalled(packs)
    })
    return () => { cancelled = true }
  }, [refreshKey])

  const handleDelete = useCallback(async (packId: string) => {
    await deletePack(packId)
    refresh()
  }, [])

  return (
    <div>
      <h3 className="text-sm font-medium text-white mb-2">Asset Packs</h3>

      {AVAILABLE_PACKS.length === 0 && installed.length === 0 && (
        <p className="text-xs text-slate-500">No asset packs available yet.</p>
      )}

      {installed.map((pack) => (
        <div key={pack.packId} className="flex items-center justify-between py-2 border-b border-slate-700">
          <div>
            <p className="text-sm text-white">{pack.name}</p>
            <p className="text-xs text-slate-400">v{pack.version}</p>
          </div>
          <button
            onClick={() => handleDelete(pack.packId)}
            className="text-xs text-red-400 active:text-red-300"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  )
}
