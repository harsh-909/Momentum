import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../store/useAppStore'
import { TabBar } from './TabBar'

describe('TabBar', () => {
  beforeEach(() => {
    useAppStore.setState({ ui: { ...useAppStore.getState().ui, activeTab: 'today' } })
  })

  it('renders 5 tabs with aria-selected on the active one', () => {
    render(<TabBar variant="top" />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(5)
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
  })

  it('clicking a tab selects it in the store', () => {
    render(<TabBar variant="top" />)
    fireEvent.click(screen.getByRole('tab', { name: /habits/i }))
    expect(useAppStore.getState().ui.activeTab).toBe('habits')
    expect(screen.getByRole('tab', { name: /habits/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('ArrowRight moves selection and focus to the next tab', () => {
    render(<TabBar variant="top" />)
    const tabs = screen.getAllByRole('tab')
    tabs[0].focus()
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' })
    expect(useAppStore.getState().ui.activeTab).toBe('backlog')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(tabs[1])
  })

  it('ArrowLeft wraps from the first to the last tab', () => {
    render(<TabBar variant="top" />)
    const tabs = screen.getAllByRole('tab')
    tabs[0].focus()
    fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' })
    expect(useAppStore.getState().ui.activeTab).toBe('metrics')
    expect(document.activeElement).toBe(tabs[4])
  })

  it('only the active tab is in the tab order (roving tabindex)', () => {
    render(<TabBar variant="top" />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0]).toHaveAttribute('tabindex', '0')
    for (const tab of tabs.slice(1)) expect(tab).toHaveAttribute('tabindex', '-1')
  })
})
