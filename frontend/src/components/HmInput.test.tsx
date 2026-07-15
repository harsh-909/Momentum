import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HmInput, hoursPart, minsPart } from './HmInput'

describe('hoursPart / minsPart', () => {
  it('splits decimal hours like v1', () => {
    expect(hoursPart(1.5)).toBe(1)
    expect(minsPart(1.5)).toBe(30)
    expect(hoursPart(0.25)).toBe(0)
    expect(minsPart(0.25)).toBe(15)
    // float-noise guard: 1.9999... reads as 2h 0m, not 1h 60m
    expect(hoursPart(1.9999999999)).toBe(2)
  })
})

describe('HmInput', () => {
  it('displays the h and m parts of the decimal value', () => {
    render(<HmInput valueHours={2.75} onChange={() => {}} label="planned" />)
    expect(screen.getByLabelText('planned hours')).toHaveValue(2)
    expect(screen.getByLabelText('planned minutes')).toHaveValue(45)
  })

  it('renders a zero part as an empty field (no leading "0"), not a literal 0', () => {
    // 1h 0m: hours shows 1, minutes shows empty rather than "0" so typing is clean.
    render(<HmInput valueHours={1} onChange={() => {}} label="planned" />)
    expect(screen.getByLabelText('planned hours')).toHaveValue(1)
    expect(screen.getByLabelText('planned minutes')).toHaveValue(null)
    // 0h 0m: both empty.
    render(<HmInput valueHours={0} onChange={() => {}} label="took" />)
    expect(screen.getByLabelText('took hours')).toHaveValue(null)
    expect(screen.getByLabelText('took minutes')).toHaveValue(null)
  })

  it('combines h + m into decimal hours on change', () => {
    const onChange = vi.fn()
    render(<HmInput valueHours={1.5} onChange={onChange} label="planned" />)
    fireEvent.change(screen.getByLabelText('planned minutes'), { target: { value: '45' } })
    expect(onChange).toHaveBeenCalledWith(1.75)
    fireEvent.change(screen.getByLabelText('planned hours'), { target: { value: '3' } })
    expect(onChange).toHaveBeenCalledWith(3.5)
  })

  it('floors hours at 0 (no upper clamp - v1 data can exceed 24h) and clamps minutes to 0-55', () => {
    const onChange = vi.fn()
    render(<HmInput valueHours={1.5} onChange={onChange} label="planned" />)
    fireEvent.change(screen.getByLabelText('planned hours'), { target: { value: '99' } })
    expect(onChange).toHaveBeenCalledWith(99.5)
    fireEvent.change(screen.getByLabelText('planned minutes'), { target: { value: '70' } })
    expect(onChange).toHaveBeenCalledWith(1 + 55 / 60)
    fireEvent.change(screen.getByLabelText('planned hours'), { target: { value: '-2' } })
    expect(onChange).toHaveBeenCalledWith(0.5)
  })

  it('treats an emptied field as 0', () => {
    const onChange = vi.fn()
    render(<HmInput valueHours={1.5} onChange={onChange} label="planned" />)
    fireEvent.change(screen.getByLabelText('planned hours'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(0.5)
  })

  it('disables both fields when disabled', () => {
    render(<HmInput valueHours={1} onChange={() => {}} label="planned" disabled />)
    expect(screen.getByLabelText('planned hours')).toBeDisabled()
    expect(screen.getByLabelText('planned minutes')).toBeDisabled()
  })
})
