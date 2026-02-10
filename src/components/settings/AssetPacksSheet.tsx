import { BottomSheet } from '../layout/BottomSheet'
import { useUIStore } from '../../stores/ui-store'
import { AssetPackManager } from './AssetPackManager'

export function AssetPacksSheet() {
  const activeSheet = useUIStore((s) => s.activeSheet)
  const closeSheet = useUIStore((s) => s.closeSheet)

  return (
    <BottomSheet
      open={activeSheet === 'asset-packs'}
      onClose={closeSheet}
      title="Asset Packs"
    >
      <AssetPackManager />
    </BottomSheet>
  )
}

