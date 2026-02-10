import { useState } from 'react'
import { PreviewTest } from './tabs/PreviewTest'
import { ExportTest } from './tabs/ExportTest'
import { StorageTest } from './tabs/StorageTest'
import { LimitsTest } from './tabs/LimitsTest'

const tabs = [
  { id: 'preview', label: 'Preview', component: PreviewTest },
  { id: 'export', label: 'Export', component: ExportTest },
  { id: 'storage', label: 'Storage', component: StorageTest },
  { id: 'limits', label: 'Limits', component: LimitsTest },
] as const

export default function App() {
  const [activeTab, setActiveTab] = useState<string>(tabs[0].id)
  const ActiveComponent = tabs.find(t => t.id === activeTab)!.component

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-slate-800 px-4 py-3 shrink-0">
        <h1 className="text-lg font-bold text-white">M0 Capability Spike</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {navigator.userAgent.includes('iPhone') ? 'iPhone' :
           navigator.userAgent.includes('Android') ? 'Android' : 'Desktop'}
          {' · '}
          {window.matchMedia('(display-mode: standalone)').matches ? 'PWA' : 'Browser'}
        </p>
      </header>

      {/* Tab bar */}
      <nav className="flex bg-slate-800/50 border-b border-slate-700 shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <main className="flex-1 overflow-y-auto p-4">
        <ActiveComponent />
      </main>

      {/* PWA install hint */}
      <footer className="bg-slate-800/50 px-4 py-2 text-center text-[10px] text-slate-500 shrink-0">
        iOS: Share → Add to Home Screen for PWA mode
      </footer>
    </div>
  )
}
