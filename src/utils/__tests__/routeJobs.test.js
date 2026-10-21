import { formatDistanceKm, formatDuration, isActiveJob } from '../routeJobs';

describe('routeJobs', () => {
  it('formats distances in km or m', () => {
    expect(formatDistanceKm(416.8922)).toBe('416.9 km');
    expect(formatDistanceKm(0.35)).toBe('350 m');
    expect(formatDistanceKm(NaN)).toBe('');
  });
  it('formats long times as hours and minutes', () => {
    expect(formatDuration(854)).toBe('14 h 14 min');
    expect(formatDuration(120)).toBe('2 h');
    expect(formatDuration(45)).toBe('45 min');
  });
  it('counts accepted, on the way and arrived jobs as active', () => {
    expect(['accepted', 'en_route', 'arrived'].every(status => isActiveJob({ status }))).toBe(true);
    expect(isActiveJob({ status: 'pending' })).toBe(false);
  });
});
