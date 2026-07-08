/**
 * "How long did it actually take" row: a caption plus an h/m pair over a
 * decimal-hours value. Used for whole goals ("Time actually spent") and for
 * completed subtasks ("took"). Emits h + m separately - the store actions
 * (logGoalTime / logSubtaskTime) take them apart.
 */
import { HmInput } from '../../components/HmInput'
import { hoursPart, minsPart } from '../../lib/engine/time'

export interface TimeLogRowProps {
  label: string
  /** Seed value, decimal hours. */
  valueHours: number
  onLog: (h: number, m: number) => void
  /** Accessible name prefix for the two inputs; defaults to the label. */
  inputLabel?: string
}

export function TimeLogRow({ label, valueHours, onLog, inputLabel }: TimeLogRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted">{label}</span>
      <HmInput
        valueHours={valueHours}
        label={inputLabel ?? label}
        onChange={(dec) => onLog(hoursPart(dec), minsPart(dec))}
      />
    </div>
  )
}
