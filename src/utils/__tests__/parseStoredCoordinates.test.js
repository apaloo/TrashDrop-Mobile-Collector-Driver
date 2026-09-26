import { parseStoredCoordinates } from '../geoUtils';

// logger.js reads import.meta.env, which Jest cannot load.
jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

// Accra: lat 5.6037, lng -0.187
const ACCRA_EWKB = '0101000020E6100000560e2db29defc7bf7c613255306a1640';

describe('parseStoredCoordinates', () => {
  const expectAccra = (result) => {
    expect(result.lat).toBeCloseTo(5.6037, 6);
    expect(result.lng).toBeCloseTo(-0.187, 6);
  };

  it('reads EWKB hex, the default for PostGIS columns', () => {
    expectAccra(parseStoredCoordinates(ACCRA_EWKB));
  });

  it('reads POINT text with and without an SRID prefix', () => {
    expectAccra(parseStoredCoordinates('POINT(-0.187 5.6037)'));
    expectAccra(parseStoredCoordinates('SRID=4326;POINT(-0.187 5.6037)'));
  });

  it('reads GeoJSON, JSON strings, objects and [lat, lng] arrays', () => {
    expectAccra(parseStoredCoordinates({ type: 'Point', coordinates: [-0.187, 5.6037] }));
    expectAccra(parseStoredCoordinates('{"type":"Point","coordinates":[-0.187,5.6037]}'));
    expectAccra(parseStoredCoordinates({ lat: 5.6037, lng: -0.187 }));
    expectAccra(parseStoredCoordinates({ latitude: '5.6037', longitude: '-0.187' }));
    expectAccra(parseStoredCoordinates([5.6037, -0.187]));
  });

  it('returns null for missing or unreadable values', () => {
    expect(parseStoredCoordinates(null)).toBeNull();
    expect(parseStoredCoordinates('')).toBeNull();
    expect(parseStoredCoordinates('not a location')).toBeNull();
    expect(parseStoredCoordinates({})).toBeNull();
  });
});
