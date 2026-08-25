/**
 * HoleNavigation — previous/next hole controls.
 */
import { Button } from '../common/Button'

interface HoleNavigationProps {
  holeNumber: number
  onChangeHole: (delta: number) => void
}

export function HoleNavigation({ holeNumber, onChangeHole }: HoleNavigationProps) {
  return (
    <div className="gm-hole-nav">
      <Button variant="ghost" onClick={() => onChangeHole(-1)} aria-label="Previous hole">
        ◀
      </Button>
      <h2>Hole {holeNumber}</h2>
      <Button variant="ghost" onClick={() => onChangeHole(1)} aria-label="Next hole">
        ▶
      </Button>
    </div>
  )
}
