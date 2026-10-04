import { describe, expect, it } from 'vitest';
import { hasProfanity, maskProfanity } from './profanity';

describe('profanity', () => {
  it.each([
    ['shit happens', '**** happens'],
    ['you are a f4ggot', 'you are a ******'],
    ['what the fuuuck', 'what the ******'],
    ['clean message', 'clean message'],
  ])('masks %j', (text, masked) => {
    expect(maskProfanity(text)).toBe(masked);
  });

  it.each([
    'Scunthorpe',
    'cocktail',
    'assassin',
    'Essex',
    'bass guitar',
    'Moby Dick',
    'Dick Van Dyke',
    'Cockpit',
    'Shiitake mushrooms',
    'Great tit',
    'Pussy willow',
  ])('leaves %j alone', (text) => {
    expect(hasProfanity(text)).toBe(false);
    expect(maskProfanity(text)).toBe(text);
  });

  it('keeps emoji and other characters in place', () => {
    expect(maskProfanity('🎃 shit 🎃')).toBe('🎃 **** 🎃');
  });
});
