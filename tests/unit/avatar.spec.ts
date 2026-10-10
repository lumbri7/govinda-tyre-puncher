import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

import { AVATAR_KEYS, AVATAR_LABELS, initialsOf, isAvatarKey } from '../../src/lib/avatars'

test('every bundled avatar key has a human label', () => {
  expect(AVATAR_KEYS.length).toBeGreaterThanOrEqual(4)
  for (const key of AVATAR_KEYS) {
    expect(AVATAR_LABELS[key]).toBeTruthy()
  }
})

test('isAvatarKey accepts only the bundled keys', () => {
  expect(isAvatarKey('cap')).toBe(true)
  expect(isAvatarKey('goggles')).toBe(true)
  expect(isAvatarKey('nope')).toBe(false)
  expect(isAvatarKey('')).toBe(false)
  expect(isAvatarKey(null)).toBe(false)
  expect(isAvatarKey(undefined)).toBe(false)
})

test('initialsOf always yields something readable', () => {
  expect(initialsOf('Ravi Kumar')).toBe('RK')
  expect(initialsOf('Ravi')).toBe('R')
  expect(initialsOf('govinda tyre puncture')).toBe('GP')
  expect(initialsOf('   ')).toBe('?')
  expect(initialsOf(null)).toBe('?')
  expect(initialsOf(undefined)).toBe('?')
})

test('the migration check constraint lists exactly the bundled keys', () => {
  const sql = readFileSync(
    path.resolve(process.cwd(), 'supabase/migrations/20260101001000_employee_avatars.sql'),
    'utf8',
  )
  expect(sql).toContain('add column avatar text')
  for (const key of AVATAR_KEYS) {
    expect(sql).toContain(`'${key}'`)
  }
})