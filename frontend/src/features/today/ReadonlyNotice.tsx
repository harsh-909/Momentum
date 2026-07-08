/** Past days are a frozen record; explains why every control is inert. */
import { Card } from '../../components/Card'
import { LockIcon } from './icons'

export function ReadonlyNotice() {
  return (
    <Card padding="sm" className="flex items-center gap-2.5 text-muted">
      <LockIcon className="h-4 w-4 shrink-0" />
      <p className="text-xs">
        Past days are read-only. Unfinished goals were copied to your backlog; the score stays as
        it was.
      </p>
    </Card>
  )
}
