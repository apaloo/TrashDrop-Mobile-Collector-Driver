// The route screen loads its data through the analytics service, which reads
// this collector's work only (analyticsService.routeData.test.js). It used to
// run its own "diagnostic" query on every load: all in-progress pickups, with
// collector ids and locations, logged one by one. It must not query the
// database itself.
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import RouteOptimizationPage from '../RouteOptimization';
import { supabase } from '../../services/supabase';

jest.mock('../../services/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));
// One user object for every render: the page re-runs effects when the user changes
const mockAuth = { user: { id: 'c1' } };
jest.mock('../../context/AuthContext', () => ({ useAuth: () => mockAuth }));
const mockOffline = { online: true };
jest.mock('../../contexts/OfflineContext', () => ({ useOffline: () => mockOffline }));
jest.mock('../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../../components/LoadingIndicator', () => ({ SectionLoading: () => null }));
jest.mock('../../components/PullToRefresh', () => ({ children }) => children);
jest.mock('../../components/Notification', () => () => null);
jest.mock('../../components/RouteOptimizer', () => () => null);
jest.mock('../../components/RouteStatistics', () => () => null);
jest.mock('../../components/ItemList', () => () => null);

const mockGetCurrentRouteData = jest.fn();
jest.mock('../../services/analyticsService', () => ({
  createAnalyticsService: () => ({
    getCurrentRouteData: (...args) => mockGetCurrentRouteData(...args),
    logRouteOptimization: async () => {},
  }),
}));

beforeEach(() => {
  mockGetCurrentRouteData.mockResolvedValue({ success: true, data: { assignments: [], requests: [] } });
  Object.defineProperty(global.navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok) => ok({ coords: { latitude: 5.6, longitude: -0.19, accuracy: 10 } }), watchPosition: () => 1, clearWatch: () => {} },
  });
});

it('loads route data through the analytics service and never queries the database itself', async () => {
  const { unmount } = render(<RouteOptimizationPage />);
  await waitFor(() => expect(mockGetCurrentRouteData).toHaveBeenCalled());
  expect(supabase.from).not.toHaveBeenCalled();
  unmount();
});
