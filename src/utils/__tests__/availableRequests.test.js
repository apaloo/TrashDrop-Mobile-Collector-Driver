import { filterAvailableRequests, toLatLng, distanceKm, getCachedPosition } from '../availableRequests';

// Pokuase area (screenshot): collector, a bin ~1 km away, a bag ~4 km away
const here = [5.6850, -0.2860];
const nearBin = { id: 'bin-near', source_type: 'digital_bin', status: 'available', coordinates: { lat: 5.6940, lng: -0.2860 }, waste_type: 'general', fee: 23 };
const farBag = { id: 'bag-far', source_type: 'pickup_request', status: 'pending', coordinates: [5.7210, -0.2860], waste_type: 'plastic', fee: 30 };
const acceptedBag = { id: 'bag-taken', source_type: 'pickup_request', status: 'accepted', coordinates: [5.6855, -0.2860] };
const noCoords = { id: 'no-coords', source_type: 'digital_bin', coordinates: null };
const all = [farBag, nearBin, acceptedBag, noCoords];
const ids = (matches) => matches.map(m => m.request.id);

describe('filterAvailableRequests', () => {
  it('shows nothing when Off-Duty, whatever the radius', () => {
    expect(filterAvailableRequests(all, { isOnDuty: false, position: here, filters: { searchRadius: 10 } })).toEqual([]);
  });

  it('shows nothing without a position', () => {
    expect(filterAvailableRequests(all, { isOnDuty: true, position: null, filters: { searchRadius: 10 } })).toEqual([]);
  });

  it('On-Duty: only requests inside the radius, nearest first', () => {
    expect(ids(filterAvailableRequests(all, { isOnDuty: true, position: here, filters: { searchRadius: 2 } }))).toEqual(['bin-near']);
    expect(ids(filterAvailableRequests(all, { isOnDuty: true, position: here, filters: { searchRadius: 10 } }))).toEqual(['bin-near', 'bag-far']);
  });

  it('skips pickups that are no longer pending and requests without coordinates', () => {
    const result = ids(filterAvailableRequests(all, { isOnDuty: true, position: here, filters: { searchRadius: 10 } }));
    expect(result).not.toContain('bag-taken');
    expect(result).not.toContain('no-coords');
  });

  it('applies waste type, minimum payment and priority filters', () => {
    const on = { isOnDuty: true, position: here };
    expect(ids(filterAvailableRequests(all, { ...on, filters: { searchRadius: 10, activeFilter: 'plastic' } }))).toEqual(['bag-far']);
    expect(ids(filterAvailableRequests(all, { ...on, filters: { searchRadius: 10, wasteTypes: ['general'] } }))).toEqual(['bin-near']);
    expect(ids(filterAvailableRequests(all, { ...on, filters: { searchRadius: 10, minPayment: 25 } }))).toEqual(['bag-far']);
    expect(ids(filterAvailableRequests(all, { ...on, filters: { searchRadius: 10, priority: 'high' } }))).toEqual([]);
  });

  it('accepts {latitude, longitude} positions and does not change the requests', () => {
    const before = JSON.stringify(nearBin);
    const [match] = filterAvailableRequests([nearBin], { isOnDuty: true, position: { latitude: here[0], longitude: here[1] }, filters: { searchRadius: 2 } });
    expect(match.distanceKm).toBeCloseTo(1.0, 1);
    expect(JSON.stringify(nearBin)).toBe(before);
  });
});

describe('helpers', () => {
  it('toLatLng handles arrays, objects and rejects 0,0 / junk', () => {
    expect(toLatLng([1, 2])).toEqual([1, 2]);
    expect(toLatLng({ lat: '1', lng: '2' })).toEqual([1, 2]);
    expect(toLatLng([0, 0])).toBeNull();
    expect(toLatLng('nope')).toBeNull();
  });

  it('distanceKm is roughly right', () => {
    expect(distanceKm([5.6, -0.2], [5.7, -0.2])).toBeCloseTo(11.1, 0);
  });

  it('getCachedPosition reads the Map page cache', () => {
    localStorage.setItem('userLastPosition', JSON.stringify([5.68, -0.28]));
    expect(getCachedPosition()).toEqual([5.68, -0.28]);
    localStorage.setItem('userLastPosition', 'garbage');
    expect(getCachedPosition()).toBeNull();
  });
});
