import { isScanForDigitalBin } from '../requestUtils';

jest.mock('../logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

describe('isScanForDigitalBin', () => {
  const request = { id: '87bc52cd-68fa-4608-a5fa-963d379b5cd9', location_id: 'loc-1' };

  it('matches the request\'s own bin id, in any letter case', () => {
    expect(isScanForDigitalBin('87bc52cd-68fa-4608-a5fa-963d379b5cd9', request)).toBe(true);
    expect(isScanForDigitalBin('87BC52CD-68FA-4608-A5FA-963D379B5CD9', request)).toBe(true);
  });

  it('never matches the location id, another bin, or nothing', () => {
    expect(isScanForDigitalBin('loc-1', request)).toBe(false);
    expect(isScanForDigitalBin('another-bin', request)).toBe(false);
    expect(isScanForDigitalBin(undefined, request)).toBe(false);
    expect(isScanForDigitalBin('87bc52cd-68fa-4608-a5fa-963d379b5cd9', null)).toBe(false);
  });
});
