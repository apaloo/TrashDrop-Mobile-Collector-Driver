import { render, screen, fireEvent, act } from '@testing-library/react';
import RequestCard from '../RequestCard';

// The scanner reports whatever code the test hands it
jest.mock('../QRCodeScanner', () => ({ onScanSuccess }) => (
  <input aria-label="scanned code" onChange={(e) => onScanSuccess(e.target.value)} />
));
jest.mock('../../services/bagPricing', () => ({ scanPickupBag: jest.fn() }));
jest.mock('../../context/CurrencyContext', () => ({ useCurrency: () => ({ currency: 'GHS' }) }));
jest.mock('../../utils/geoUtils', () => ({ formatLocationAsync: jest.fn(() => Promise.resolve('Pokuase')) }));
jest.mock('../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const BIN_ID = '87bc52cd-68fa-4608-a5fa-963d379b5cd9';
const LOCATION_ID = '5c1f0e2a-1111-4222-8333-944455556666';
const bin = {
  id: BIN_ID, location_id: LOCATION_ID, source_type: 'digital_bin', status: 'accepted',
  location: 'Home', created_at: '2026-11-04T09:54:00Z',
};

const scan = (code, onScanQR = jest.fn()) => {
  render(<RequestCard request={bin} navigationStarted onScanQR={onScanQR} />);
  fireEvent.click(screen.getByRole('button', { name: /Scan QR/ }));
  fireEvent.change(screen.getByLabelText('scanned code'), { target: { value: code } });
  return onScanQR;
};

describe('Scanning a digital bin from the Requests card', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  // Codes already shared use the old trashdrop.app domain: they must keep working
  it("accepts the household app's code: the request's own bin id", () => {
    const onScanQR = scan(`https://trashdrop.app/bin/${BIN_ID}`);
    expect(screen.getByText('Bin scanned!')).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(1500); });
    expect(onScanQR).toHaveBeenCalledWith(BIN_ID, [expect.objectContaining({ id: BIN_ID })]);
  });

  it('accepts the new link domain (app.trashdrops.com, TD58) the same way', () => {
    const onScanQR = scan(`https://app.trashdrops.com/bin/${BIN_ID}`);
    expect(screen.getByText('Bin scanned!')).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(1500); });
    expect(onScanQR).toHaveBeenCalledWith(BIN_ID, [expect.objectContaining({ id: BIN_ID })]);
  });

  it("rejects a code carrying the bin's location id, which other bookings share", () => {
    const onScanQR = scan(`https://trashdrop.app/bin/${LOCATION_ID}`);
    expect(screen.getByText('Wrong bin! Try again.')).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(3000); });
    expect(onScanQR).not.toHaveBeenCalled();
  });

  it("rejects another bin's code", () => {
    const onScanQR = scan('https://trashdrop.app/bin/00000000-0000-4000-8000-000000000000');
    expect(screen.getByText('Wrong bin! Try again.')).toBeInTheDocument();
    expect(onScanQR).not.toHaveBeenCalled();
  });
});
