/**
 * Future-day hint: habits are materialized only when the day arrives, so a
 * future date just announces what is scheduled.
 */
import { Card } from '../../components/Card'
import { RotateIcon } from './icons'

export function FutureHabitHint({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <Card padding="sm" className="flex items-center gap-2.5 text-muted">
      <RotateIcon className="h-4 w-4 shrink-0" />
      <p className="text-xs">
        <span className="font-mono-num">{count}</span> habit{count > 1 ? 's' : ''} scheduled -
        they'll appear when the day arrives.
      </p>
    </Card>
  )
}
