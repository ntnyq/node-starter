import { describe, it, expect } from 'vitest'
import { greet, msg } from '../src'

describe('Group', () => {
  it('Should return message', () => {
    expect(greet()).toBe(msg)
  })
})
