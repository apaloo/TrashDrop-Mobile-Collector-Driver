// The collector app's position readers all accept the EWKB hex Supabase
// returns for a geography column (TD71: two of them couldn't, which made the
// new-job alerts and Route Optimisation drop jobs). Hex made by PostGIS for a
// made-up point.
import { parsePointString } from '../geoUtils';

jest.mock('../logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const OSU = '0101000020E6100000560E2DB29DEFC7BF7C613255306A1640'; // POINT(-0.187 5.6037)

describe('parsePointString', () => {
  it('reads EWKB hex', () => {
    const p = parsePointString(OSU);
    expect(p.lat).toBeCloseTo(5.6037, 6);
    expect(p.lng).toBeCloseTo(-0.187, 6);
  });

  it('still reads WKT, with or without an SRID', () => {
    expect(parsePointString('POINT(-0.187 5.6037)')).toEqual({ lat: 5.6037, lng: -0.187 });
    expect(parsePointString('SRID=4326;POINT(-0.187 5.6037)')).toEqual({ lat: 5.6037, lng: -0.187 });
  });

  it('nothing usable is null, never a made-up position', () => {
    for (const v of [null, '', 'Osu, Accra', 'POINT(0 0)', 'POINT(200 95)', 42]) expect(parsePointString(v)).toBeNull();
  });
});
