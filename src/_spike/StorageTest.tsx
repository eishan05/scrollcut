import { useCallback, useMemo } from 'react'
import { createLogger } from '../utils/log'
import { LogPanel } from '../components/common/LogPanel'

export function StorageTest() {
  const logger = useMemo(() => createLogger(), [])

  const testOPFS = useCallback(async () => {
    logger.info('--- OPFS Test ---')
    try {
      const root = await navigator.storage.getDirectory()
      logger.pass('OPFS: getDirectory() succeeded')

      // Write 10MB test file
      const size = 10 * 1024 * 1024
      const data = new Uint8Array(size)
      for (let i = 0; i < size; i++) data[i] = i & 0xff

      const fileHandle = await root.getFileHandle('test-10mb.bin', { create: true })

      // Safari/iOS doesn't support createWritable(), only createSyncAccessHandle() in Workers.
      // Use an inline Worker so this works cross-browser.
      const workerCode = `
        self.onmessage = async (e) => {
          try {
            const { data } = e.data;
            const root = await navigator.storage.getDirectory();
            const fh = await root.getFileHandle('test-10mb.bin', { create: true });
            const ah = await fh.createSyncAccessHandle();
            ah.write(data);
            ah.flush();
            ah.close();
            self.postMessage({ ok: true });
          } catch (err) {
            self.postMessage({ ok: false, error: err.message });
          }
        };
      `

      const writeStart = performance.now()
      let method = 'SyncAccessHandle (Worker)'

      // Try Worker-based sync access first (works in Safari + Chrome)
      let wroteViaWorker = false
      try {
        const blob = new Blob([workerCode], { type: 'application/javascript' })
        const url = URL.createObjectURL(blob)
        const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
          const w = new Worker(url)
          w.onmessage = (e) => { resolve(e.data); w.terminate() }
          w.onerror = (e) => { resolve({ ok: false, error: e.message }); w.terminate() }
          w.postMessage({ data }, [data.buffer])
        })
        URL.revokeObjectURL(url)
        if (!result.ok) throw new Error(result.error)
        wroteViaWorker = true
      } catch {
        // Worker approach failed, try createWritable (Chrome main thread)
      }

      if (!wroteViaWorker) {
        if (typeof fileHandle.createWritable === 'function') {
          const writable = await fileHandle.createWritable()
          await writable.write(data)
          await writable.close()
          method = 'WritableStream'
        } else {
          throw new Error('No supported OPFS write method available')
        }
      }

      const writeTime = performance.now() - writeStart
      logger.pass(`Write 10MB: ${writeTime.toFixed(0)}ms (${method})`)

      // Read back
      const readStart = performance.now()
      const file = await fileHandle.getFile()
      const readBuf = new Uint8Array(await file.arrayBuffer())
      const readTime = performance.now() - readStart
      logger.pass(`Read 10MB: ${readTime.toFixed(0)}ms`)

      // Verify — data was transferred to worker so re-generate expected values
      let match = readBuf.length === size
      if (match) {
        for (let i = 0; i < 1000; i++) {
          const idx = Math.floor(Math.random() * size)
          if (readBuf[idx] !== (idx & 0xff)) { match = false; break }
        }
      }
      if (match) {
        logger.pass('Integrity check: PASSED')
      } else {
        logger.fail('Integrity check: FAILED')
      }

      // Cleanup
      await root.removeEntry('test-10mb.bin')
      logger.info('Cleaned up test file')
    } catch (err) {
      logger.fail(`OPFS error: ${err instanceof Error ? err.message : err}`)
    }
  }, [logger])

  const testIndexedDB = useCallback(async () => {
    logger.info('--- IndexedDB Test ---')
    try {
      const dbName = 'spike-test'
      const storeName = 'projects'

      // Open DB
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(dbName, 1)
        req.onupgradeneeded = () => {
          req.result.createObjectStore(storeName, { keyPath: 'id' })
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      logger.pass('IndexedDB: opened successfully')

      // Create ~100KB test project
      const project = {
        id: 'test-project',
        name: 'Test Project',
        timeline: Array.from({ length: 100 }, (_, i) => ({
          clipId: `clip-${i}`,
          start: i * 3,
          duration: 3,
          overlays: Array.from({ length: 5 }, (_, j) => ({
            type: 'text',
            content: `Overlay ${j} on clip ${i} with some extra text padding`,
            x: Math.random(),
            y: Math.random(),
          })),
        })),
        createdAt: Date.now(),
      }

      const jsonSize = new Blob([JSON.stringify(project)]).size

      // Write
      const writeStart = performance.now()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        tx.objectStore(storeName).put(project)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      const writeTime = performance.now() - writeStart
      logger.pass(`Write ${(jsonSize / 1024).toFixed(0)}KB project: ${writeTime.toFixed(0)}ms`)

      // Read
      const readStart = performance.now()
      await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly')
        const req = tx.objectStore(storeName).get('test-project')
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      const readTime = performance.now() - readStart
      logger.pass(`Read project: ${readTime.toFixed(0)}ms`)

      // Cleanup
      db.close()
      indexedDB.deleteDatabase(dbName)
      logger.info('Cleaned up test DB')
    } catch (err) {
      logger.fail(`IndexedDB error: ${err instanceof Error ? err.message : err}`)
    }
  }, [logger])

  const testCacheAPI = useCallback(async () => {
    logger.info('--- Cache API Test ---')
    try {
      const cache = await caches.open('spike-test-cache')
      logger.pass('Cache API: opened successfully')

      // Cache a synthetic response
      const testData = 'Hello from Cache API test! '.repeat(1000)
      const response = new Response(testData, {
        headers: { 'Content-Type': 'text/plain' },
      })

      const writeStart = performance.now()
      await cache.put('/test-asset', response)
      const writeTime = performance.now() - writeStart
      logger.pass(`Cache put: ${writeTime.toFixed(0)}ms`)

      // Retrieve
      const readStart = performance.now()
      const cached = await cache.match('/test-asset')
      const text = await cached?.text()
      const readTime = performance.now() - readStart

      if (text === testData) {
        logger.pass(`Cache match + read: ${readTime.toFixed(0)}ms (verified)`)
      } else {
        logger.fail('Cache verification failed')
      }

      // Cleanup
      await caches.delete('spike-test-cache')
      logger.info('Cleaned up test cache')
    } catch (err) {
      logger.fail(`Cache API error: ${err instanceof Error ? err.message : err}`)
    }
  }, [logger])

  const testPersistence = useCallback(async () => {
    logger.info('--- Persistence & Quota ---')
    try {
      // Storage estimate
      if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate()
        const usageMB = ((est.usage ?? 0) / 1024 / 1024).toFixed(1)
        const quotaMB = ((est.quota ?? 0) / 1024 / 1024).toFixed(0)
        logger.info(`Usage: ${usageMB}MB / ${quotaMB}MB quota`)
      } else {
        logger.warn('storage.estimate() not available')
      }

      // Persistence request
      if (navigator.storage?.persist) {
        const persisted = await navigator.storage.persisted()
        logger.info(`Already persisted: ${persisted}`)

        if (!persisted) {
          const granted = await navigator.storage.persist()
          if (granted) {
            logger.pass('Persistence: GRANTED')
          } else {
            logger.warn('Persistence: DENIED (data may be evicted)')
          }
        } else {
          logger.pass('Persistence: already active')
        }
      } else {
        logger.warn('storage.persist() not available')
      }

      // Service Worker status
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg) {
          logger.pass(`Service Worker: ${reg.active ? 'active' : reg.waiting ? 'waiting' : 'installing'}`)
        } else {
          logger.info('Service Worker: not registered yet')
        }
      } else {
        logger.fail('Service Worker: NOT supported')
      }

      // Online status
      logger.info(`Online: ${navigator.onLine}`)
    } catch (err) {
      logger.fail(`Persistence error: ${err instanceof Error ? err.message : err}`)
    }
  }, [logger])

  const runAll = useCallback(async () => {
    logger.clear()
    await testOPFS()
    await testIndexedDB()
    await testCacheAPI()
    await testPersistence()
    logger.info('=== All storage tests complete ===')
  }, [logger, testOPFS, testIndexedDB, testCacheAPI, testPersistence])

  return (
    <div>
      <h2 className="text-base font-semibold mb-3">Storage Test</h2>
      <p className="text-xs text-slate-400 mb-3">
        Validates OPFS, IndexedDB, Cache API, and persistence on this device.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={runAll}
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg active:bg-blue-700"
        >
          Run All
        </button>
        <button
          onClick={testOPFS}
          className="bg-slate-700 text-white text-sm px-4 py-2 rounded-lg active:bg-slate-600"
        >
          OPFS
        </button>
        <button
          onClick={testIndexedDB}
          className="bg-slate-700 text-white text-sm px-4 py-2 rounded-lg active:bg-slate-600"
        >
          IndexedDB
        </button>
        <button
          onClick={testCacheAPI}
          className="bg-slate-700 text-white text-sm px-4 py-2 rounded-lg active:bg-slate-600"
        >
          Cache API
        </button>
        <button
          onClick={testPersistence}
          className="bg-slate-700 text-white text-sm px-4 py-2 rounded-lg active:bg-slate-600"
        >
          Persistence
        </button>
      </div>

      <LogPanel logger={logger} />
    </div>
  )
}
