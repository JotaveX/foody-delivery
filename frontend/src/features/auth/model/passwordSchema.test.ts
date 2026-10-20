import { describe, expect, it } from 'vitest'
import { passwordSchema } from './passwordSchema'

describe('passwordSchema', () => {
  it('counts UTF-8 bytes, not characters, against the BCrypt limit', () => {
    expect(passwordSchema.safeParse('é'.repeat(36)).success).toBe(true) // 72 bytes
    expect(passwordSchema.safeParse('é'.repeat(40)).success).toBe(false) // 40 chars, 80 bytes
    expect(passwordSchema.safeParse('a'.repeat(73)).success).toBe(false)
  })

  it('requires at least 8 characters', () => {
    expect(passwordSchema.safeParse('curta').success).toBe(false)
    expect(passwordSchema.safeParse('s3nha-segura').success).toBe(true)
  })
})
