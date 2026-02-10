import { useEffect, useRef, useState } from 'react'
import type { Logger, LogEntry } from '../../utils/log'

const levelColors: Record<LogEntry['level'], string> = {
  info: 'text-slate-400',
  pass: 'text-green-400',
  fail: 'text-red-400',
  warn: 'text-yellow-400',
}

export function LogPanel({ logger }: { logger: Logger }) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => logger.subscribe(setEntries), [logger])
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  return (
    <div className="mt-4 bg-slate-900 rounded-lg p-3 max-h-64 overflow-y-auto font-mono text-xs">
      <div className="flex justify-between items-center mb-2">
        <span className="text-slate-500 text-[10px] uppercase tracking-wider">Log</span>
        <button
          onClick={() => logger.clear()}
          className="text-slate-500 text-[10px] hover:text-slate-300"
        >
          Clear
        </button>
      </div>
      {entries.length === 0 && (
        <p className="text-slate-600">No log entries yet.</p>
      )}
      {entries.map((e, i) => (
        <div key={i} className="flex gap-2 leading-5">
          <span className="text-slate-600 shrink-0">{e.time}</span>
          <span className={levelColors[e.level]}>{e.message}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
