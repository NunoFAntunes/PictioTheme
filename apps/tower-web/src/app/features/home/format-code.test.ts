import { describe, expect, it } from 'vitest';
import { formatCode } from './components/HomePage';

describe('the join field', () => {
  it('formats a code as it is typed', () => {
    expect(formatCode('abc')).toBe('ABC');
    expect(formatCode('abcd')).toBe('ABC-D');
    expect(formatCode('abc def')).toBe('ABC-DEF');
    expect(formatCode('abc-defgh')).toBe('ABC-DEF');
  });

  it('turns a pasted invite link into its code', () => {
    expect(formatCode('https://doodletower.example/r/KMB-XRT')).toBe('KMB-XRT');
    expect(formatCode('Join us! http://localhost:4322/r/kmbxrt/')).toBe('KMB-XRT');
  });
});
