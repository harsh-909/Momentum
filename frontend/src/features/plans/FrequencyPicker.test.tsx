import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Recurrence } from '../../types/domain'
import { FrequencyPicker, isRecurrenceValid } from './FrequencyPicker'

const TODAY = '2026-07-03'

function Harness({ initial }: { initial: Recurrence }) {
  const [rec, setRec] = useState(initial)
  return <FrequencyPicker value={rec} today={TODAY} onChange={setRec} />
}

describe('FrequencyPicker fields', () => {
  it('once shows a date field defaulted to today', () => {
    render(<Harness initial={{ freq: 'once', date: TODAY }} />)
    expect(screen.getByRole('button', { name: 'Once' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Date')).toHaveValue(TODAY)
  })

  it('switching to Monthly reveals a day-of-month select and emits a monthly default', async () => {
    render(<Harness initial={{ freq: 'once', date: TODAY }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Monthly' }))
    expect(screen.getByRole('button', { name: 'Monthly' })).toHaveAttribute('aria-pressed', 'true')
    const select = screen.getByLabelText('Day of month')
    expect(select).toHaveValue('1')
    await userEvent.selectOptions(select, '15')
    expect(select).toHaveValue('15')
  })

  it('switching to Yearly reveals month + day selects', async () => {
    render(<Harness initial={{ freq: 'once', date: TODAY }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Yearly' }))
    // Current month of 2026-07-03 is July.
    expect(screen.getByLabelText('Month')).toHaveValue('7')
    expect(screen.getByLabelText('Day')).toHaveValue('1')
  })

  it('emits a complete default recurrence when the frequency changes', async () => {
    const onChange = vi.fn()
    render(<FrequencyPicker value={{ freq: 'once', date: TODAY }} today={TODAY} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Monthly' }))
    expect(onChange).toHaveBeenLastCalledWith({ freq: 'monthly', dayOfMonth: 1 })

    await userEvent.click(screen.getByRole('button', { name: 'Yearly' }))
    expect(onChange).toHaveBeenLastCalledWith({ freq: 'yearly', month: 7, dayOfMonth: 1 })

    await userEvent.click(screen.getByRole('button', { name: 'Once' }))
    expect(onChange).toHaveBeenLastCalledWith({ freq: 'once', date: TODAY })
  })

  it('preserves reusable sub-values when toggling back to a frequency', async () => {
    // dayOfMonth chosen on monthly is reused when switching to yearly.
    render(<Harness initial={{ freq: 'monthly', dayOfMonth: 20 }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Yearly' }))
    expect(screen.getByLabelText('Day')).toHaveValue('20')
  })

  it('renders a live preview from recurrenceLabel', () => {
    render(<Harness initial={{ freq: 'monthly', dayOfMonth: 31 }} />)
    expect(screen.getByText('Monthly on the 31st')).toBeInTheDocument()
  })
})

describe('isRecurrenceValid', () => {
  it('once: valid only with a non-empty date', () => {
    expect(isRecurrenceValid({ freq: 'once', date: TODAY })).toBe(true)
    expect(isRecurrenceValid({ freq: 'once', date: '' })).toBe(false)
    expect(isRecurrenceValid({ freq: 'once' })).toBe(false)
  })

  it('monthly: dayOfMonth must be 1..31', () => {
    expect(isRecurrenceValid({ freq: 'monthly', dayOfMonth: 1 })).toBe(true)
    expect(isRecurrenceValid({ freq: 'monthly', dayOfMonth: 31 })).toBe(true)
    expect(isRecurrenceValid({ freq: 'monthly', dayOfMonth: 0 })).toBe(false)
    expect(isRecurrenceValid({ freq: 'monthly', dayOfMonth: 32 })).toBe(false)
    expect(isRecurrenceValid({ freq: 'monthly' })).toBe(false)
  })

  it('yearly: month 1..12 AND dayOfMonth 1..31', () => {
    expect(isRecurrenceValid({ freq: 'yearly', month: 7, dayOfMonth: 4 })).toBe(true)
    expect(isRecurrenceValid({ freq: 'yearly', month: 0, dayOfMonth: 4 })).toBe(false)
    expect(isRecurrenceValid({ freq: 'yearly', month: 13, dayOfMonth: 4 })).toBe(false)
    expect(isRecurrenceValid({ freq: 'yearly', month: 7 })).toBe(false)
  })

  it('weekly: at least one day', () => {
    expect(isRecurrenceValid({ freq: 'weekly', days: [1] })).toBe(true)
    expect(isRecurrenceValid({ freq: 'weekly', days: [] })).toBe(false)
    expect(isRecurrenceValid({ freq: 'weekly' })).toBe(false)
  })
})
