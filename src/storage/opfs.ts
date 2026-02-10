// Main-thread async wrapper for OPFS operations via Web Worker

type PendingRequest = {
  resolve: (value: { ok: boolean; data?: ArrayBuffer; error?: string }) => void
}

let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, PendingRequest>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./opfs-worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent) => {
      const { id, ...rest } = e.data
      const req = pending.get(id)
      if (req) {
        pending.delete(id)
        req.resolve(rest)
      }
    }
    worker.onerror = (e) => {
      console.error('[OPFS Worker Error]', e.message)
    }
  }
  return worker
}

function send(type: string, path: string, data?: ArrayBuffer): Promise<{ ok: boolean; data?: ArrayBuffer; error?: string }> {
  return new Promise((resolve) => {
    const id = nextId++
    pending.set(id, { resolve })
    const msg: Record<string, unknown> = { type, id, path }
    const transfer: Transferable[] = []
    if (data) {
      msg.data = data
      transfer.push(data)
    }
    getWorker().postMessage(msg, { transfer })
  })
}

export const opfs = {
  async write(path: string, data: ArrayBuffer | Uint8Array): Promise<void> {
    const buffer = data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer : data
    const result = await send('write', path, buffer)
    if (!result.ok) throw new Error(result.error ?? 'OPFS write failed')
  },

  async read(path: string): Promise<ArrayBuffer> {
    const result = await send('read', path)
    if (!result.ok) throw new Error(result.error ?? 'OPFS read failed')
    return result.data!
  },

  async delete(path: string): Promise<void> {
    const result = await send('delete', path)
    if (!result.ok) throw new Error(result.error ?? 'OPFS delete failed')
  },

  async mkdir(path: string): Promise<void> {
    const result = await send('mkdir', path)
    if (!result.ok) throw new Error(result.error ?? 'OPFS mkdir failed')
  },
}
