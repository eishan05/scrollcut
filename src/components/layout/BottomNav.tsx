import { useUIStore, type ActivePanel } from '../../stores/ui-store'
import { useProjectStore } from '../../stores/project-store'

const navItems: { id: ActivePanel; label: string; icon: string }[] = [
  { id: 'projects', label: 'Projects', icon: '📁' },
  { id: 'editor', label: 'Editor', icon: '✂️' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export function BottomNav() {
  const activePanel = useUIStore((s) => s.activePanel)
  const setActivePanel = useUIStore((s) => s.setActivePanel)
  const hasProject = useProjectStore((s) => s.currentProject !== null)

  return (
    <nav className="flex bg-slate-800 border-t border-slate-700 shrink-0 pb-[env(safe-area-inset-bottom)]">
      {navItems.map((item) => {
        const disabled = item.id === 'editor' && !hasProject
        return (
          <button
            key={item.id}
            onClick={() => !disabled && setActivePanel(item.id)}
            disabled={disabled}
            className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
              activePanel === item.id
                ? 'text-blue-400'
                : disabled
                  ? 'text-slate-600'
                  : 'text-slate-400 active:text-slate-200'
            }`}
          >
            <span className="text-lg leading-none mb-0.5">{item.icon}</span>
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
