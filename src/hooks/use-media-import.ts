import { useCallback } from 'react'
import { importMediaAndAppendClip } from '../actions/editor-actions'

export function useMediaImport() {
  const importFile = useCallback(async (file: File) => {
    return importMediaAndAppendClip(file)
  }, [])

  return { importFile }
}
