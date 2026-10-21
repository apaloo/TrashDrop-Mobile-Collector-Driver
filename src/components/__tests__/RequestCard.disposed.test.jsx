import { render, screen } from '@testing-library/react';
import RequestCard from '../RequestCard';

jest.mock('../QRCodeScanner', () => () => null);
jest.mock('../../context/CurrencyContext', () => ({ useCurrency: () => ({ currency: 'GHS' }) }));
jest.mock('../../utils/geoUtils', () => ({ formatLocationAsync: jest.fn(() => Promise.resolve('Pokuase')) }));
jest.mock('../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const base = { id: 'r1', location: 'Pokuase', created_at: '2026-10-21T10:00:00Z' };

describe('RequestCard after disposal', () => {
  it('shows "Bags Disposed" for a disposed pickup request, with no broken View Report button', () => {
    render(<RequestCard request={{ ...base, source_type: 'pickup_request', status: 'disposed' }} />);
    expect(screen.getByText('Bags Disposed')).toBeInTheDocument();
    expect(screen.queryByText('View Report')).not.toBeInTheDocument();
  });

  it('shows "Bin Disposed" for a disposed digital bin', () => {
    render(<RequestCard request={{ ...base, source_type: 'digital_bin', status: 'disposed' }} />);
    expect(screen.getByText('Bin Disposed')).toBeInTheDocument();
  });

  it('a picked-up bag still shows the disposal steps', () => {
    render(<RequestCard request={{ ...base, source_type: 'pickup_request', status: 'collecting' }} />);
    expect(screen.queryByText('Bags Disposed')).not.toBeInTheDocument();
  });
});
