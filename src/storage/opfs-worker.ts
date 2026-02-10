// Web Worker for OPFS sync access handle operations (required for Safari/iOS)

interface WriteRequest {
  type: 'write'
  id: number
  path: string
  data: ArrayBuffer
}

interface ReadRequest {
  type: 'read'
  id: number
  path: string
}

interface DeleteRequest {
  type: 'delete'
  id: number
  path: string
}

interface MkdirRequest {
  type: 'mkdir'
  id: number
  path: string
}

type WorkerRequest = WriteRequest | ReadRequest | DeleteRequest | MkdirRequest

interface WorkerResponse {
  id: number
  ok: boolean
  data?: ArrayBuffer
  error?: string
}

async function getDirectoryHandle(path: string, create: boolean): Promise<FileSystemDirectoryHandle> {
  const parts = path.split('/').filter(Boolean)
  let dir = await navigator.storage.getDirectory()
  // Navigate to parent directories
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create })
  }
  return dir
}

async function getFileParentAndName(path: string, create: boolean): Promise<{ dir: FileSystemDirectoryHandle; name: string }> {
  const parts = path.split('/').filter(Boolean)
  const name = parts.pop()!
  let dir = await navigator.storage.getDirectory()
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create })
  }
  return { dir, name }
}

async function handleWrite(path: string, data: ArrayBuffer): Promise<void> {
  const { dir, name } = await getFileParentAndName(path, true)
  const fileHandle = await dir.getFileHandle(name, { create: true })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accessHandle = await (fileHandle as any).createSyncAccessHandle()
  try {
    accessHandle.truncate(0)
    accessHandle.write(new Uint8Array(data))
    accessHandle.flush()
  } finally {
    accessHandle.close()
  }
}

async function handleRead(path: string): Promise<ArrayBuffer> {
  const { dir, name } = await getFileParentAndName(path, false)
  const fileHandle = await dir.getFileHandle(name)
  const file = await fileHandle.getFile()
  return file.arrayBuffer()
}

async function handleDelete(path: string): Promise<void> {
  const { dir, name } = await getFileParentAndName(path, false)
  await dir.removeEntry(name)
}

async function handleMkdir(path: string): Promise<void> {
  await getDirectoryHandle(path, true)
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data
  const response: WorkerResponse = { id: req.id, ok: false }

  try {
    switch (req.type) {
      case 'write':
        await handleWrite(req.path, req.data)
        response.ok = true
        break
      case 'read': {
        const data = await handleRead(req.path)
        response.ok = true
        response.data = data
        break
      }
      case 'delete':
        await handleDelete(req.path)
        response.ok = true
        break
      case 'mkdir':
        await handleMkdir(req.path)
        response.ok = true
        break
    }
  } catch (err) {
    response.error = err instanceof Error ? err.message : String(err)
  }

  const transfer = response.data ? [response.data] : []
  self.postMessage(response, { transfer })
}
