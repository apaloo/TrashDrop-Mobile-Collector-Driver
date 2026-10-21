import { render, screen } from '@testing-library/react';
import MapControls from '../MapControls';

const base = { lastUpdated: new Date(), isRefreshing: false, refreshData: jest.fn() };

describe('MapControls request count', () => {
  it('counts requests within the radius when On-Duty', () => {
    render(<MapControls {...base} requestCount={3} isOnDuty />);
    expect(screen.getByText('3 requests within your radius')).toBeInTheDocument();
  });

  it('says Off-Duty instead of a count', () => {
    render(<MapControls {...base} requestCount={10} isOnDuty={false} />);
    expect(screen.getByText('Off-Duty: go On-Duty to see requests')).toBeInTheDocument();
    expect(screen.queryByText(/10/)).not.toBeInTheDocument();
  });
});
