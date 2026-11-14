import { render, screen } from '@testing-library/react';
import RequestCard from '../RequestCard';

// What a collector reads on a job card before accepting it: the number of
// bags is the request's own, and points appear only when there are real ones.
jest.mock('../QRCodeScanner', () => () => null);
jest.mock('../../services/bagPricing', () => ({ scanPickupBag: jest.fn() }));
jest.mock('../../context/CurrencyContext', () => ({ useCurrency: () => ({ currency: 'GHS' }) }));
jest.mock('../../utils/geoUtils', () => ({ formatLocationAsync: jest.fn(() => Promise.resolve('Osu')) }));
jest.mock('../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const base = { id: 'r1', location: 'Osu', created_at: '2026-11-14T07:00:00Z', source_type: 'pickup_request', status: 'pending', fee: 300 };

describe('RequestCard bag count and points', () => {
  it('30 bags reads "30 bags"', () => {
    render(<RequestCard request={{ ...base, bags: 30 }} />);
    expect(screen.getByText('30 bags')).toBeInTheDocument();
  });

  it('no points on the request: no points chip (it used to say 100 or a random number)', () => {
    render(<RequestCard request={{ ...base, bags: 2, points: null }} />);
    expect(screen.queryByText(/points$/)).not.toBeInTheDocument();
  });

  it('real points are shown', () => {
    render(<RequestCard request={{ ...base, bags: 2, points: 40 }} />);
    expect(screen.getByText('40 points')).toBeInTheDocument();
  });
});
