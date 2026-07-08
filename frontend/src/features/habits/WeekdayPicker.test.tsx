import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { WeekdayPicker } from './WeekdayPicker'

function Harness({ initial }: { initial: number[] }) {
  const [days, setDays] = useState(initial)
  return <WeekdayPicker value={days} onChange={setDays} />
}

describe('WeekdayPicker', () => {
  it('toggles a day off and back on', async () => {
    render(<Harness initial={[0, 1, 2, 3, 4, 5, 6]} />)
    const sunday = screen.getByRole('button', { name: 'Su' })
    expect(sunday).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(sunday)
    expect(sunday).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(sunday)
    expect(sunday).toHaveAttribute('aria-pressed', 'true')
  })

  it('reports toggles through onChange', async () => {
    const onChange = vi.fn()
    render(<WeekdayPicker value={[1, 2]} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Mo' }))
    expect(onChange).toHaveBeenCalledWith([2])
    await userEvent.click(screen.getByRole('button', { name: 'Fr' }))
    expect(onChange).toHaveBeenCalledWith([1, 2, 5])
  })

  it('presets replace the selection', async () => {
    const onChange = vi.fn()
    render(<WeekdayPicker value={[3]} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Every day' }))
    expect(onChange).toHaveBeenCalledWith([0, 1, 2, 3, 4, 5, 6])
    await userEvent.click(screen.getByRole('button', { name: 'Weekdays' }))
    expect(onChange).toHaveBeenCalledWith([1, 2, 3, 4, 5])
    await userEvent.click(screen.getByRole('button', { name: 'Weekends' }))
    expect(onChange).toHaveBeenCalledWith([0, 6])
  })

  it('shows the alert hint only when no day is selected', () => {
    const { rerender } = render(<WeekdayPicker value={[]} onChange={() => {}} />)
    expect(screen.getByText('Pick at least one day')).toBeInTheDocument()
    rerender(<WeekdayPicker value={[2]} onChange={() => {}} />)
    expect(screen.queryByText('Pick at least one day')).not.toBeInTheDocument()
  })
})
