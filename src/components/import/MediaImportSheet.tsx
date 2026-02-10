import { useRef } from 'react'
import { BottomSheet } from '../layout/BottomSheet'
import { useMediaImport } from '../../hooks/use-media-import'
import { useUIStore } from '../../stores/ui-store'
import { ImportProgress } from './ImportProgress'
import { useMediaStore } from '../../stores/media-store'

export function MediaImportSheet() {
  const activeSheet = useUIStore((s) => s.activeSheet)
  const closeSheet = useUIStore((s) => s.closeSheet)
  const isImporting = useMediaStore((s) => s.isImporting)
  const { importFile } = useMediaImport()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await importFile(file)
      closeSheet()
    } catch (err) {
      console.error('Import failed:', err)
    }
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  return (
    <BottomSheet
      open={activeSheet === 'import'}
      onClose={closeSheet}
      title="Import Media"
    >
      <div className="flex flex-col gap-3">
        <ImportProgress />

        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={isImporting}
          className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-medium active:bg-blue-700 disabled:opacity-50"
        >
          Record Video
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="w-full py-3 bg-slate-700 text-white rounded-xl text-sm font-medium active:bg-slate-600 disabled:opacity-50"
        >
          Choose from Library
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/*'
            input.capture = 'environment'
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0]
              if (file) importFile(file).then(closeSheet).catch(console.error)
            }
            input.click()
          }}
          disabled={isImporting}
          className="w-full py-3 bg-slate-700 text-white rounded-xl text-sm font-medium active:bg-slate-600 disabled:opacity-50"
        >
          Take Photo
        </button>
      </div>
    </BottomSheet>
  )
}
