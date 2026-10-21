import { renderHook, act } from '@testing-library/react';
import useWakeLock from '../useWakeLock';

const makeSentinel = () => {
  const listeners = {};
  return {
    released: false,
    addEventListener: (t, fn) => { listeners[t] = fn; },
    release: jest.fn(function () { this.released = true; listeners.release?.(); return Promise.resolve(); }),
    fireRelease() { listeners.release?.(); },
  };
};

let visibility = 'visible';
beforeAll(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});

describe('useWakeLock', () => {
  it('takes the lock again when the page is visible after the browser released it', async () => {
    const sentinels = [];
    navigator.wakeLock = { request: jest.fn(() => { const s = makeSentinel(); sentinels.push(s); return Promise.resolve(s); }) };
    const { result } = renderHook(() => useWakeLock(true));
    await act(async () => {});
    expect(navigator.wakeLock.request).toHaveBeenCalledTimes(1);

    // Screen off / app switched: the browser releases the lock
    await act(async () => { visibility = 'hidden'; sentinels[0].fireRelease(); document.dispatchEvent(new Event('visibilitychange')); });
    // Back on screen: the hook must request it again
    await act(async () => { visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
    expect(navigator.wakeLock.request).toHaveBeenCalledTimes(2);
    expect(result.current.isEnabled).toBe(true);
  });

  it('does not take it again after disable()', async () => {
    navigator.wakeLock = { request: jest.fn(() => Promise.resolve(makeSentinel())) };
    const { result } = renderHook(() => useWakeLock(false));
    await act(async () => { await result.current.enable(); });
    await act(async () => { await result.current.disable(); });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(navigator.wakeLock.request).toHaveBeenCalledTimes(1);
  });
});
