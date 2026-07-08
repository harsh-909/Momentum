import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../store/useAppStore'
import { DateNav } from './DateNav'
import { FUTURE, TODAY, seedStore } from './testUtils'

const initialState = useAppStore.getState()

afterEach(() => {
  useAppStore.setState(initialState, true)
})

describe('DateNav', () => {
  it('disables the previous arrow at minDate', () => {
    seedStore({ selectedDate: TODAY, today: TODAY, minDate: TODAY })
    render(<DateNav />)
    expect(screen.getByRole('button', { name: 'Previous day' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next day' })).toBeEnabled()
  })

  it('shows the Today pill only when viewing another day', async () => {
    const setSelectedDate = vi.fn()
    seedStore({ selectedDate: TODAY, today: TODAY })
    const { unmount } = render(<DateNav />)
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument()
    unmount()

    seedStore({ selectedDate: FUTURE, today: TODAY, actions: { setSelectedDate } })
    render(<DateNav />)
    const pill = screen.getByRole('button', { name: 'Today' })
    await userEvent.click(pill)
    expect(setSelectedDate).toHaveBeenCalledWith(TODAY)
  })

  it('floors the date input at minDate and wires it to setSelectedDate', () => {
    const setSelectedDate = vi.fn()
    seedStore({ selectedDate: FUTURE, today: TODAY, minDate: TODAY, actions: { setSelectedDate } })
    render(<DateNav />)
    const input = screen.getByLabelText('Pick a date') as HTMLInputElement
    expect(input).toHaveAttribute('min', TODAY)
    expect(input.value).toBe(FUTURE)
  })

  it('shifts the day with the arrow buttons', async () => {
    const shiftDate = vi.fn()
    seedStore({ selectedDate: FUTURE, today: TODAY, minDate: TODAY, actions: { shiftDate } })
    render(<DateNav />)
    await userEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(shiftDate).toHaveBeenCalledWith(-1)
    await userEvent.click(screen.getByRole('button', { name: 'Next day' }))
    expect(shiftDate).toHaveBeenCalledWith(1)
  })
})
