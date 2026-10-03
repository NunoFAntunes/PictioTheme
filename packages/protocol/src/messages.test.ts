import { describe, expect, it } from 'vitest';
import { ClientMessage } from './messages';

describe('ClientMessage', () => {
  it('accepts a valid guess and trims it', () => {
    expect(ClientMessage.parse({ t: 'guess', text: '  pumpkin ' })).toEqual({
      t: 'guess',
      text: 'pumpkin',
    });
  });

  it('rejects guesses longer than 60 chars', () => {
    expect(ClientMessage.safeParse({ t: 'guess', text: 'x'.repeat(61) }).success).toBe(false);
  });

  it('rejects unknown message types', () => {
    expect(ClientMessage.safeParse({ t: 'admin:giveMePoints' }).success).toBe(false);
  });

  it('requires draw points to be [x, y, pressure] triplets', () => {
    expect(ClientMessage.safeParse({ t: 'draw:pts', id: 's1', pts: [1, 2, 0.5] }).success).toBe(
      true,
    );
    expect(ClientMessage.safeParse({ t: 'draw:pts', id: 's1', pts: [1, 2] }).success).toBe(false);
  });

  it('rejects stroke starts outside the logical canvas', () => {
    const begin = {
      t: 'draw:begin',
      id: 's1',
      tool: 'brush',
      color: '#ff0000',
      size: 12,
      opacity: 0.8,
      x: 5000,
      y: 10,
    };
    expect(ClientMessage.safeParse(begin).success).toBe(false);
  });
});
