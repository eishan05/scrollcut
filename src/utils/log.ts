export interface LogEntry {
  time: string
  level: 'info' | 'pass' | 'fail' | 'warn'
  message: string
}

export function createLogger() {
  let entries: LogEntry[] = []
  let listener: ((entries: LogEntry[]) => void) | null = null

  function log(level: LogEntry['level'], message: string) {
    const time = new Date().toLocaleTimeString()
    entries = [...entries, { time, level, message }]
    listener?.(entries)
  }

  return {
    info: (msg: string) => log('info', msg),
    pass: (msg: string) => log('pass', msg),
    fail: (msg: string) => log('fail', msg),
    warn: (msg: string) => log('warn', msg),
    clear: () => {
      entries = []
      listener?.(entries)
    },
    subscribe: (fn: (entries: LogEntry[]) => void) => {
      listener = fn
      fn(entries)
      return () => { listener = null }
    },
    getEntries: () => entries,
  }
}

export type Logger = ReturnType<typeof createLogger>
