/**
 * CourseSetup — course name + player name inputs for a new round.
 */
import { useState } from 'react'
import { Button } from '../common/Button'
import './RoundViews.css'

interface CourseSetupProps {
  defaultCourseName: string
  onStart: (courseName: string, playerName: string) => void
}

export function CourseSetup({ defaultCourseName, onStart }: CourseSetupProps) {
  const [courseName, setCourseName] = useState(defaultCourseName)
  const [playerName, setPlayerName] = useState('Golfer')

  return (
    <div className="gm-setup">
      <label className="gm-setup__label" htmlFor="gm-course">
        Course name
      </label>
      <input
        id="gm-course"
        className="gm-setup__input"
        type="text"
        value={courseName}
        placeholder="e.g. Hooks Point GC"
        onChange={(event) => setCourseName(event.target.value)}
      />
      <label className="gm-setup__label" htmlFor="gm-player">
        Player name
      </label>
      <input
        id="gm-player"
        className="gm-setup__input"
        type="text"
        value={playerName}
        onChange={(event) => setPlayerName(event.target.value)}
      />
      <Button
        variant="primary"
        full
        onClick={() => onStart(courseName, playerName)}
        disabled={courseName.trim().length === 0}
      >
        Start Round
      </Button>
    </div>
  )
}
