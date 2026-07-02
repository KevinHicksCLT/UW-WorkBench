// format — fmt helpers + the status/stage vocabularies (pure).
import { describe, expect, it } from 'vitest';
import {
  fmt,
  PARTICIPATION_CLASS,
  STAGE_LABELS,
  STAGE_ORDER,
  STATUS_LABEL,
  STATUS_PILL_CLASS,
} from '../../src/lib/format';

describe('fmt.currency', () => {
  it('formats whole USD with no fraction digits by default', () => {
    expect(fmt.currency(1234567)).toBe('$1,234,567');
    expect(fmt.currency(0)).toBe('$0');
  });

  it('formats compact notation with one fraction digit', () => {
    expect(fmt.currency(1234567, { compact: true })).toBe('$1.2M');
    expect(fmt.currency(4500, { compact: true })).toBe('$4.5K');
  });

  it('returns the em-dash for null/undefined/NaN', () => {
    expect(fmt.currency(null)).toBe('—');
    expect(fmt.currency(undefined)).toBe('—');
    expect(fmt.currency(Number.NaN)).toBe('—');
  });
});

describe('fmt.number', () => {
  it('formats with at most one fraction digit by default', () => {
    expect(fmt.number(1234.56)).toBe('1,234.6');
    expect(fmt.number(10)).toBe('10');
  });

  it('honours Intl option overrides', () => {
    expect(fmt.number(0.1234, { style: 'percent', maximumFractionDigits: 0 })).toBe('12%');
  });

  it('returns the em-dash for null/undefined/NaN', () => {
    expect(fmt.number(null)).toBe('—');
    expect(fmt.number(Number.NaN)).toBe('—');
  });
});

describe('fmt.percent', () => {
  it('multiplies by 100 and rounds to whole percent', () => {
    expect(fmt.percent(0.614)).toBe('61%');
    expect(fmt.percent(1)).toBe('100%');
    expect(fmt.percent(0)).toBe('0%');
  });

  it('returns the em-dash for null/undefined/NaN', () => {
    expect(fmt.percent(null)).toBe('—');
    expect(fmt.percent(undefined)).toBe('—');
  });
});

describe('fmt.date / fmt.month', () => {
  it('formats dates as "Mon D, YYYY"', () => {
    expect(fmt.date('2026-07-01T12:00:00Z')).toBe('Jul 1, 2026');
  });

  it('formats months as "Mon YY"', () => {
    expect(fmt.month('2026-07-01T12:00:00Z')).toBe('Jul 26');
  });

  it('returns the em-dash for empty inputs', () => {
    expect(fmt.date(null)).toBe('—');
    expect(fmt.date('')).toBe('—');
    expect(fmt.month(undefined)).toBe('—');
    expect(fmt.month(0)).toBe('—'); // falsy timestamp treated as empty
  });
});

describe('stage/status vocabularies', () => {
  it('orders the four stages and labels them', () => {
    expect(STAGE_ORDER).toEqual(['IDEA', 'PLAN', 'EXECUTE', 'COMPLETE']);
    expect(STAGE_ORDER.map((s) => STAGE_LABELS[s])).toEqual(['Idea', 'Plan', 'Execute', 'Complete']);
  });

  it('maps statuses to pill classes and labels 1:1', () => {
    expect(STATUS_PILL_CLASS.ON_TRACK).toBe('pill-green');
    expect(STATUS_PILL_CLASS.AT_RISK).toBe('pill-amber');
    expect(STATUS_PILL_CLASS.OFF_TRACK).toBe('pill-red');
    expect(STATUS_PILL_CLASS.GAIN).toBe('chip-gain');
    expect(STATUS_LABEL.OFF_TRACK).toBe('Off Track');
    expect(Object.keys(STATUS_PILL_CLASS)).toEqual(Object.keys(STATUS_LABEL));
  });

  it('maps participation types to pill classes', () => {
    expect(PARTICIPATION_CLASS.Lead).toBe('pill-blue');
    expect(PARTICIPATION_CLASS.Oversight).toBe(PARTICIPATION_CLASS.Control);
  });
});
