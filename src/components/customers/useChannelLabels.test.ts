import { expect, it } from 'vitest';
import { channelName, liveChannelMap } from './useChannelLabels';
it('falls back to the channel code before any rename is loaded', () => {
  expect(channelName('b2b')).toBe('B2B');
  expect(liveChannelMap({}, true, { B2C: ' / à classer' }).b2c).toBe('B2C / à classer');
});
