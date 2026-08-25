/**
 * ParSelector — par 3/4/5 picker for the current hole.
 */
import { Button } from '../common/Button'

interface ParSelectorProps {
  selectedPar: number | null
  onSelectPar: (par: number) => void
}

const PAR_OPTIONS = [3, 4, 5]

export function ParSelector({ selectedPar, onSelectPar }: ParSelectorProps) {
  return (
    <div className="gm-grid gm-grid--3">
      {PAR_OPTIONS.map((par) => (
        <Button
          key={par}
          selected={selectedPar === par}
          onClick={() => onSelectPar(par)}
        >
          Par {par}
        </Button>
      ))}
    </div>
  )
}
