import { describe, expect, it } from 'vitest';
import { assertAllowedRequest, isBlockedText } from './content-check';

describe('generation blocklist', () => {
  it.each(['sh1t', 'Nazis', 'porn stars', 'School shootings', 'Hentai characters'])(
    'blocks %j',
    (text) => {
      expect(isBlockedText(text)).toBe(true);
    },
  );

  it.each([
    'Pirates',
    'World War 2',
    'Moby Dick',
    'Scunthorpe United',
    'Cocktails',
    'Horror movies',
  ])('allows %j', (text) => {
    expect(isBlockedText(text)).toBe(false);
  });

  it('checks the theme and the notes', () => {
    expect(() => assertAllowedRequest({ theme: 'pirates', notes: '' })).not.toThrow();
    expect(() => assertAllowedRequest({ theme: 'pirates', notes: 'make it about porn' })).toThrow(
      expect.objectContaining({ code: 'VALIDATION' }),
    );
  });
});
