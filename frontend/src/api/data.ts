import type { Snapshot } from '../types/domain'
import { request } from './client'

export interface LoadResponse {
  version: number
  updatedAt: string | null
  /** null when the user has never saved (fresh account). */
  data: Snapshot | null
}

export interface SaveResponse {
  version: number
  updatedAt: string
}

/** Body of a 409 version_conflict: the server returns the winning doc. */
export interface ConflictBody {
  error: 'version_conflict'
  version: number
  data: Snapshot
}

export function loadData(): Promise<LoadResponse> {
  return request<LoadResponse>('/api/data')
}

export function saveData(
  version: number,
  data: Snapshot,
  opts: { keepalive?: boolean } = {},
): Promise<SaveResponse> {
  return request<SaveResponse>('/api/data', {
    method: 'PUT',
    body: { version, data },
    keepalive: opts.keepalive,
  })
}
