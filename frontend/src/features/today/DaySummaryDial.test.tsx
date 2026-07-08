import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DaySummaryDial } from './DaySummaryDial'
import { makeGoal, makeSubtask } from './testUtils'

describe('DaySummaryDial', () => {
  it('renders the pct readout and an accessible day summary', () => {
    const goals = [
      makeGoal({ completed: true, hours: 2, loggedHours: 1.5 }),
      makeGoal({
        hours: 1,
        subtasks: [makeSubtask({ completed: true }), makeSubtask()],
      }),
    ]
    render(<DaySummaryDial goals={goals} />)
    // avg progress = (1 + 0.5) / 2 = 75%
    expect(screen.getByRole('img')).toHaveAccessibleName('Day 75% complete, 1 of 2 goals done')
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('renders one ring segment per goal', () => {
    const goals = [makeGoal(), makeGoal(), makeGoal({ completed: true })]
    const { container } = render(<DaySummaryDial goals={goals} />)
    expect(container.querySelectorAll('[data-segment]')).toHaveLength(3)
    expect(container.querySelector('[data-ring-complete]')).toBeNull()
  })

  it('unifies the ring when every goal is complete', () => {
    const goals = [makeGoal({ completed: true }), makeGoal({ completed: true })]
    const { container } = render(<DaySummaryDial goals={goals} />)
    expect(container.querySelectorAll('[data-segment]')).toHaveLength(0)
    expect(container.querySelector('[data-ring-complete]')).not.toBeNull()
    expect(screen.getByRole('img')).toHaveAccessibleName('Day 100% complete, 2 of 2 goals done')
  })

  it('shows an empty dial for a day without goals', () => {
    const { container } = render(<DaySummaryDial goals={[]} />)
    expect(screen.getByRole('img')).toHaveAccessibleName('Day 0% complete, 0 of 0 goals done')
    expect(container.querySelectorAll('[data-segment]')).toHaveLength(0)
    expect(container.querySelector('[data-sweep-hand]')).toBeNull()
  })

  it('shows planned (warn) and logged (good) durations', () => {
    const goals = [
      makeGoal({ completed: true, hours: 2, loggedHours: 1.5 }),
      makeGoal({ hours: 1 }),
    ]
    render(<DaySummaryDial goals={goals} />)
    expect(screen.getByText('3h')).toBeInTheDocument() // planned
    expect(screen.getByText('1h 30m')).toBeInTheDocument() // logged
    expect(screen.getByText('1/2')).toBeInTheDocument() // goals done
  })
})
