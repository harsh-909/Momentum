/** Past days are a frozen record; explains why the controls are inert. */
import { Card } from '../../components/Card'
import { LockIcon } from './icons'

export interface ReadonlyNoticeProps {
  /**
   * True on yesterday, where the check toggles stay live (grace window) even
   * though every other edit is frozen - so the copy explains that instead.
   */
  checkable?: boolean
}

export function ReadonlyNotice({ checkable = false }: ReadonlyNoticeProps) {
  return (
    <Card padding="sm" className="flex items-center gap-2.5 text-muted">
      <LockIcon className="h-4 w-4 shrink-0" />
      <p className="text-xs">
        {checkable
          ? 'This day is closed for edits, but you can still tick off anything you finished - the score, streak, and metrics update to match. Unfinished goals were copied to your backlog.'
          : 'Past days are read-only. Unfinished goals were copied to your backlog; the score stays as it was.'}
      </p>
    </Card>
  )
}
