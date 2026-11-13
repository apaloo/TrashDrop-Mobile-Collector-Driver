// Protected payout display (owner-approved 2026-11-13): a standard digital
// bin's card shows what the collector earns (the database's formula), not
// the client's fee and not the booked payout ceiling stored on the bin.
import { render, screen, fireEvent } from '@testing-library/react';
import RequestCard from '../RequestCard';

jest.mock('../QRCodeScanner', () => () => null);
jest.mock('../../services/bagPricing', () => ({ scanPickupBag: jest.fn() }));
jest.mock('../../context/CurrencyContext', () => ({ useCurrency: () => ({ currency: 'GHS' }) }));
jest.mock('../../utils/geoUtils', () => ({ formatLocationAsync: jest.fn(() => Promise.resolve('Pokuase')) }));
jest.mock('../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

// A bin as accepted jobs carry it: the raw row, booked ceiling in the payout columns
const accepted = {
  id: 'b1', location: 'Pokuase', created_at: '2026-11-10T10:00:00Z', source_type: 'digital_bin', status: 'accepted',
  fee: 19, is_promotional: false, is_urgent: false, deadhead_km: null,
  collector_core_payout: 18, collector_total_payout: 18,
};

const text = () => document.body.textContent.replace(/\s+/g, ' ');

it('shows the collector\'s earning, not the booked ceiling or the client\'s fee', () => {
  render(<RequestCard request={accepted} />);
  fireEvent.click(screen.getByText('View More'));
  expect(screen.getByText('What you earn')).toBeInTheDocument();
  expect(text()).toMatch(/87% of the base \(distance unknown\)/);
  expect(text()).toMatch(/You earn\s*GHS\s*15\.66|You earn\s*GH₵\s*15\.66|You earn.*15\.66/);
  expect(screen.queryByText('Your Payout Breakdown')).not.toBeInTheDocument();
  expect(screen.queryByText(/Potential Bonuses|Loyalty Cashback/)).not.toBeInTheDocument();
});

it('uses the distance recorded at accept', () => {
  render(<RequestCard request={{ ...accepted, fee: 26, collector_total_payout: 25, deadhead_km: 1.5 }} />);
  fireEvent.click(screen.getByText('View More'));
  expect(text()).toMatch(/85% of the base \(1\.5 km away\)/);
  expect(text()).toMatch(/21\.25/);
  expect(text()).toMatch(/at the distance recorded when you accepted/);
});
