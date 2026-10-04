import { describe, expect, it } from 'vitest';
import { DEFAULT_TOOL, RECENT_COLORS, previousColor, withColor } from './tools';

describe('withColor', () => {
  it('puts the colour first in the recent list, without duplicates', () => {
    const a = withColor(DEFAULT_TOOL, '#DC2626');
    expect(a.color).toBe('#dc2626');
    expect(a.recent).toEqual(['#dc2626', DEFAULT_TOOL.color]);
    expect(withColor(a, DEFAULT_TOOL.color).recent).toEqual([DEFAULT_TOOL.color, '#dc2626']);
  });

  it('keeps the current colour plus the last 8', () => {
    let tool = DEFAULT_TOOL;
    for (let i = 0; i < 20; i++) tool = withColor(tool, `#0000${i.toString(16).padStart(2, '0')}`);
    expect(tool.recent).toHaveLength(RECENT_COLORS + 1);
  });

  it('switches the eraser to the brush, but leaves fill alone', () => {
    expect(withColor({ ...DEFAULT_TOOL, tool: 'eraser' }, '#000000').tool).toBe('brush');
    expect(withColor({ ...DEFAULT_TOOL, tool: 'fill' }, '#000000').tool).toBe('fill');
  });
});

describe('previousColor', () => {
  it('skips the current colour, which may not be committed yet (native picker)', () => {
    const tool = { ...withColor(DEFAULT_TOOL, '#dc2626'), color: '#123456' };
    expect(previousColor(tool)).toBe('#dc2626');
    expect(previousColor(DEFAULT_TOOL)).toBeNull();
  });
});
