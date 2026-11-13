// New-job alerts on the collector's phone (Realtime inserts into
// pickup_requests and digital_bins): which ones sound, and which are skipped.
// The coordinates are what Realtime really sends for a geography column:
// EWKB hex, here made by PostGIS for two made-up points.
import { realtimeNotificationService as service } from '../realtimeNotificationService';
import { audioAlertService } from '../audioAlertService';

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../supabase.js', () => ({ supabase: { channel: jest.fn(), removeChannel: jest.fn() } }));
jest.mock('../audioAlertService.js', () => ({
  audioAlertService: { initialize: jest.fn(), playNewRequestAlert: jest.fn(), speak: jest.fn() },
}));

const OSU = '0101000020E6100000560E2DB29DEFC7BF7C613255306A1640'; // POINT(-0.187 5.6037), Accra
const KUMASI = '0101000020E61000005AF5B9DA8AFDF9BF1B2FDD2406C11A40'; // POINT(-1.6244 6.6885), ~200 km away
const NEAR_OSU = { lat: 5.61, lng: -0.19 };

let alerts;
let now;
beforeEach(() => {
  jest.clearAllMocks();
  alerts = [];
  now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  service.callbacks = new Set([(req, distance, type) => alerts.push({ id: req.id, distance, type })]);
  service.lastNotificationTime = 0;
  service.audioInitialized = true;
  service.searchRadius = 5;
  service.collectorLocation = NEAR_OSU;
  audioAlertService.playNewRequestAlert.mockResolvedValue();
  audioAlertService.speak.mockResolvedValue();
});
afterEach(() => jest.restoreAllMocks());

describe('distance to a new request', () => {
  it('reads the geography Realtime sends (EWKB hex)', () => {
    expect(service.calculateDistanceToRequest({ coordinates: OSU })).toBeCloseTo(0.75, 1);
    expect(service.calculateDistanceToRequest({ coordinates: KUMASI })).toBeGreaterThan(150);
  });

  it('also reads latitude/longitude, WKT and [lat, lng]', () => {
    expect(service.calculateDistanceToRequest({ latitude: 5.6037, longitude: -0.187 })).toBeCloseTo(0.75, 1);
    expect(service.calculateDistanceToRequest({ coordinates: 'POINT(-0.187 5.6037)' })).toBeCloseTo(0.75, 1);
    expect(service.calculateDistanceToRequest({ coordinates: [5.6037, -0.187] })).toBeCloseTo(0.75, 1);
  });

  it('unknown without the collector position or a usable point', () => {
    expect(service.calculateDistanceToRequest({ coordinates: 'garbage' })).toBeNull();
    service.collectorLocation = null;
    expect(service.calculateDistanceToRequest({ coordinates: OSU })).toBeNull();
  });
});

describe('which new requests sound an alert', () => {
  it('a pending request within the radius: sound, voice with the distance and fee, and the page is told', async () => {
    await service.handleNewRequest({ new: { id: 'r1', coordinates: OSU, waste_type: 'plastic', fee: 20 } });
    expect(audioAlertService.playNewRequestAlert).toHaveBeenCalled();
    expect(audioAlertService.speak.mock.calls[0][0]).toMatch(/^New plastic pickup request 0\.\d kilometers away\. Fee: ₵20\./);
    expect(alerts).toEqual([{ id: 'r1', distance: expect.any(Number), type: 'pickup_request' }]);
  });

  it('a request 200 km away is not announced', async () => {
    await service.handleNewRequest({ new: { id: 'far', coordinates: KUMASI } });
    expect(alerts).toEqual([]);
    expect(audioAlertService.playNewRequestAlert).not.toHaveBeenCalled();
  });

  it('a request already taken by a collector is not announced', async () => {
    await service.handleNewRequest({ new: { id: 'taken', coordinates: OSU, collector_id: 'c2' } });
    expect(alerts).toEqual([]);
  });

  it('a second alert within 3 seconds is held back', async () => {
    await service.handleNewRequest({ new: { id: 'a', coordinates: OSU } });
    now += 1000;
    await service.handleNewRequest({ new: { id: 'b', coordinates: OSU } });
    now += 3000;
    await service.handleNewRequest({ new: { id: 'c', coordinates: OSU } });
    expect(alerts.map((a) => a.id)).toEqual(['a', 'c']);
  });

  it('a digital bin (no position on the row) is announced as nearby', async () => {
    await service.handleNewDigitalBin({ new: { id: 'bin1', waste_type: 'general' } });
    expect(alerts).toEqual([{ id: 'bin1', distance: null, type: 'digital_bin' }]);
    expect(audioAlertService.speak.mock.calls[0][0]).toMatch(/digital bin nearby/);
  });

  it('a failing sound still tells the page', async () => {
    audioAlertService.playNewRequestAlert.mockRejectedValue(new Error('autoplay blocked'));
    await service.handleNewRequest({ new: { id: 'r2', coordinates: OSU } });
    expect(alerts.map((a) => a.id)).toEqual(['r2']);
  });
});
