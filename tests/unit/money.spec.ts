import { expect, test } from '@playwright/test'

import {
  formatQuantity,
  formatRupees,
  formatRupeesShort,
  lineTotalPaise,
  numericToPaise,
  parseAmountToPaise,
} from '../../src/lib/money'

/**
 * Whole rupee amounts always render without ".00", grouped the Indian way.
 * These three are the exact shapes the shop reads out loud every day.
 */
test('whole rupees show no decimal places and en-IN grouping', () => {
  expect(formatRupees(2400000)).toBe('₹24,000')
  expect(formatRupees(1200000)).toBe('₹12,000')
  expect(formatRupees(5814500)).toBe('₹58,145')
})

test('actual paise always show both decimals; lakh grouping applies', () => {
  expect(formatRupees(1250)).toBe('₹12.50')
  expect(formatRupees(125050)).toBe('₹1,250.50')
  expect(formatRupees(1234567890)).toBe('₹1,23,45,678.90')
})

test('sign handling', () => {
  expect(formatRupees(-2400000)).toBe('-₹24,000')
  expect(formatRupees(2400000, { sign: true })).toBe('+₹24,000')
  expect(formatRupeesShort(2400000)).toBe('₹24,000')
  expect(formatRupeesShort(125050)).toBe('₹1,250.50')
})

test('parsing keeps calculations exact (integer paise, never floats)', () => {
  expect(parseAmountToPaise('24,000')).toBe(2400000)
  expect(parseAmountToPaise('1250.50')).toBe(125050)
  expect(parseAmountToPaise(1250.5)).toBe(125050)
  expect(numericToPaise('58145.00')).toBe(5814500)
  expect(numericToPaise('58145')).toBe(5814500)
  expect(lineTotalPaise(250, 2000)).toBe(5000)
  expect(formatQuantity(250)).toBe('2.5')
})