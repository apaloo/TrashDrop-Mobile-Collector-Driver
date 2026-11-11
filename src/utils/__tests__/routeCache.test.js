import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { setCachedRoute, getCachedRoute } from '../routeCache';

const START = { lat: 5.6037, lng: -0.187 };
const END = { lat: 5.6145, lng: -0.2057 };

describe('routeCache', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => jest.restoreAllMocks());

  it('stores and returns a route', () => {
    expect(setCachedRoute(START, END, { distance: 1200 })).toBe(true);
    expect(getCachedRoute(START, END)).toEqual({ distance: 1200 });
  });

  it('retries after clearing old routes when storage is full', () => {
    for (let i = 0; i < 4; i++) {
      sessionStorage.setItem(`route_cache_old_${i}`, JSON.stringify({ route: {}, timestamp: Date.now() }));
    }
    const realSetItem = Storage.prototype.setItem;
    let calls = 0;
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      calls += 1;
      if (calls === 1) {
        const full = new Error('full');
        full.name = 'QuotaExceededError';
        throw full;
      }
      return realSetItem.call(this, key, value);
    });

    // Used to throw a ReferenceError in the retry and return false
    expect(setCachedRoute(START, END, { distance: 1200 })).toBe(true);
    expect(getCachedRoute(START, END)).toEqual({ distance: 1200 });
  });
});
