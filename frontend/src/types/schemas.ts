/**
 * Zod schemas validating snapshots that cross a trust boundary:
 * server loads (GET /api/data) and user-picked import files.
 *
 * Deliberately tolerant: v1 files carry legacy fields (`addingSubtask`,
 * subtasks without `loggedHours`) and future clients may add fields.
 * Unknown keys are stripped, missing optionals defaulted, so a validated
 * snapshot is always safe for the engine.
 */
import { z } from 'zod'
import type { Snapshot } from './domain'

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')

const subtaskSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean().default(false),
  loggedHours: z.number().nullable().optional(),
})

const goalSchema = z.object({
  id: z.string(),
  topic: z.string(),
  // coerce, don't .catch(0): v1 tolerated numeric strings (parseFloat reads),
  // and a .catch default would silently zero every planned hour on import.
  hours: z.coerce.number().nonnegative(),
  loggedHours: z.number().nullable().default(null),
  completed: z.boolean().default(false),
  subtasks: z.array(subtaskSchema).default([]),
  createdAt: dateStr.catch(''),
  recurringId: z.string().optional(),
  carried: z.boolean().optional(),
  originalDate: dateStr.optional(),
  backlognedAt: dateStr.optional(),
})

const habitTemplateSchema = z.object({
  id: z.string(),
  topic: z.string(),
  hours: z.coerce.number().nonnegative(),
  subtasks: z.array(z.object({ text: z.string() })).default([]),
  startDate: dateStr,
  days: z.array(z.number().int().min(0).max(6)).min(1),
})

export const snapshotSchema = z.object({
  username: z.string().default(''),
  install: dateStr,
  updatedAt: z.string().default(''),
  goals: z.record(dateStr, z.array(goalSchema)).default({}),
  backlog: z.array(goalSchema).default([]),
  recurring: z.array(habitTemplateSchema).default([]),
  seeded: z.record(dateStr, z.array(z.string())).default({}),
  carriedThrough: z.union([dateStr, z.literal('')]).default(''),
})

/**
 * Parse an untrusted value (server doc or import file) into a Snapshot.
 * Throws ZodError with a readable message on structural mismatch.
 */
export function parseSnapshot(raw: unknown): Snapshot {
  return snapshotSchema.parse(raw) as Snapshot
}
