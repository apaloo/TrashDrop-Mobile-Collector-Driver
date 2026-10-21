import { render, screen } from '@testing-library/react';
import ItemList from '../ItemList';
import RouteStatistics from '../RouteStatistics';

jest.mock('../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

// Collector in Pokuase; one job ~1.1 km away, one in Tamale (~417 km)
const here = { latitude: 5.6725, longitude: -0.2809 };
const near = { id: 'near', status: 'en_route', location: 'Near home', latitude: 5.6825, longitude: -0.2809 };
const tamale = { id: 'far', status: 'en_route', location: 'Tamale', latitude: 9.3848, longitude: -0.8103 };

describe('Route page', () => {
  it('ItemList shows real kilometres (not metres labelled km)', () => {
    render(<ItemList assignments={[near, tamale]} requests={[]} userLocation={here} />);
    expect(screen.getByText('1.1 km')).toBeInTheDocument();
    expect(screen.getByText(/^41\d\.\d km$/)).toBeInTheDocument();
    expect(screen.queryByText(/\d{5,}\.\d km/)).not.toBeInTheDocument();
  });

  it('Route Statistics counts jobs that are on the way, not only "accepted"', () => {
    render(<RouteStatistics assignments={[near]} userLocation={here} analyticsService={null} />);
    expect(screen.queryByText('Nothing to show yet')).not.toBeInTheDocument();
  });
});
