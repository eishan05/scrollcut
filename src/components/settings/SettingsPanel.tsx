import { useEffect, useState } from 'react'
import { useUIStore } from '../../stores/ui-store'
import { getPlatform, getAppMode } from '../../utils/platform'
import { AssetPackManager } from './AssetPackManager'

export function SettingsPanel() {
  const isDebugMode = useUIStore((s) => s.isDebugMode)
  const toggleDebugMode = useUIStore((s) => s.toggleDebugMode)
  const openSheet = useUIStore((s) => s.openSheet)
  const [storageInfo, setStorageInfo] = useState<{ usage: string; quota: string } | null>(null)

  useEffect(() => {
    navigator.storage?.estimate?.().then((est) => {
      setStorageInfo({
        usage: `${((est.usage ?? 0) / 1024 / 1024).toFixed(1)} MB`,
        quota: `${((est.quota ?? 0) / 1024 / 1024).toFixed(0)} MB`,
      })
    })
  }, [])

  return (
    <div>
      <h2 className="text-base font-semibold text-white mb-4">Settings</h2>

      {/* Device info */}
      <section className="mb-6">
        <h3 className="text-sm font-medium text-white mb-2">Device</h3>
        <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-400 space-y-1">
          <p>Platform: {getPlatform()}</p>
          <p>Mode: {getAppMode()}</p>
          {storageInfo && (
            <p>Storage: {storageInfo.usage} / {storageInfo.quota}</p>
          )}
        </div>
      </section>

      {/* Asset Packs */}
      <section className="mb-6">
        <AssetPackManager />
        <button
          onClick={() => openSheet('asset-packs')}
          className="mt-2 text-xs text-blue-400 active:text-blue-300"
        >
          Manage asset packs
        </button>
      </section>

      {/* Debug toggle */}
      <section className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">Debug Mode</h3>
            <p className="text-xs text-slate-400">Show log panel and diagnostics</p>
          </div>
          <button
            onClick={toggleDebugMode}
            className={`w-12 h-7 rounded-full transition-colors ${
              isDebugMode ? 'bg-blue-600' : 'bg-slate-600'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                isDebugMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </section>
    </div>
  )
}
