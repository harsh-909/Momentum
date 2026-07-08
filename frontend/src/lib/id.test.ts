import { describe, expect, it } from 'vitest'
import { uid } from './id'

describe('uid', () => {
  it('returns a non-empty base36 string', () => {
    expect(uid()).toMatch(/^[a-z0-9]+$/)
  })
  it('is unique across many rapid calls', () => {
    const ids = Array.from({ length: 1000 }, () => uid())
    expect(new Set(ids).size).toBe(1000)
  })
})
