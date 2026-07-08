import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SaveStatusChip } from './SaveStatusChip'

describe('SaveStatusChip', () => {
  it('renders nothing visible when idle (stable placeholder)', () => {
    const { container } = render(<SaveStatusChip status="idle" onRetry={() => {}} />)
    expect(container.firstChild).toBeInTheDocument()
    expect(container).not.toHaveTextContent(/./)
  })

  it('shows "Saving…" while saving', () => {
    render(<SaveStatusChip status="saving" onRetry={() => {}} />)
    expect(screen.getByText(/Saving/)).toBeInTheDocument()
  })

  it('shows "Saved" after a successful save', () => {
    render(<SaveStatusChip status="saved" onRetry={() => {}} />)
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('error state renders a retry button that calls onRetry', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<SaveStatusChip status="error" onRetry={onRetry} />)
    const button = screen.getByRole('button', { name: /retry/i })
    await user.click(button)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('wraps the message in an aria-live region', () => {
    const { container } = render(<SaveStatusChip status="saving" onRetry={() => {}} />)
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument()
  })
})
