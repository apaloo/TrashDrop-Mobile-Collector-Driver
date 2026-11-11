/**
 * Tests for RouteOptimizer component
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RouteOptimizer from '../components/RouteOptimizer';

// Mock the react-leaflet components
jest.mock('react-leaflet', () => ({
  MapContainer: jest.fn(({ children }) => (
    <div data-testid="map-container">{children}</div>
  )),
  TileLayer: jest.fn(() => <div data-testid="tile-layer" />),
  Marker: jest.fn(({ children }) => (
    <div data-testid="map-marker">{children}</div>
  )),
  Popup: jest.fn(({ children }) => <div data-testid="map-popup">{children}</div>),
  Polyline: jest.fn(() => <div data-testid="map-polyline" />),
  useMap: () => ({
    on: () => {}, off: () => {}, addLayer: () => {}, removeLayer: () => {}, hasLayer: () => false,
    fitBounds: () => {}, setView: () => {}, invalidateSize: () => {}, getZoom: () => 13,
  }),
}));

// Offline tiles and map tuning need a real Leaflet map
jest.mock('../utils/mapUtils', () => ({
  initOfflineMapStorage: () => Promise.resolve(),
  createOfflineTileLayer: () => null,
  optimizeMapPerformance: () => {},
}));
jest.mock('leaflet.offline', () => ({}));

// In-app navigation (Google Maps) is its own component: record what it is given
jest.mock('../components/GoogleMapsNavigation', () => (props) => (
  <div data-testid="in-app-navigation" data-destination={`${props.destination.lat},${props.destination.lng}`} data-waypoints={props.waypoints.length} />
));


const job = (id, status, name, latitude, longitude) => ({
  id, status, customer_name: name, location: `${name}'s address`, latitude, longitude,
});

describe('RouteOptimizer', () => {
  const userLocation = { latitude: 5.6037, longitude: -0.187 }; // Accra
  const accepted = [
    job('1', 'accepted', 'Ama Owusu', 5.6145, -0.2057),
    job('2', 'accepted', 'Kofi Mensah', 5.5560, -0.1969),
  ];

  beforeEach(() => {
    window.open = jest.fn();
  });

  test('with no jobs it tells the collector to accept some first', async () => {
    render(<RouteOptimizer assignments={[]} userLocation={userLocation} />);
    expect(await screen.findByText('No jobs on your route')).toBeInTheDocument();
    expect(screen.queryByText('Navigate Route')).not.toBeInTheDocument();
  });

  test('shows distance, time, the map and a Navigate button for accepted jobs', async () => {
    render(<RouteOptimizer assignments={accepted} userLocation={userLocation} />);

    expect(await screen.findByText(/Total distance/i)).toBeInTheDocument();
    expect(screen.getByText(/Estimated time/i)).toBeInTheDocument();
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByText('Navigate Route')).toBeInTheDocument();
    expect(screen.getByText('Ama Owusu')).toBeInTheDocument();
    expect(screen.getByText('Kofi Mensah')).toBeInTheDocument();
  });

  test('Navigate opens in-app navigation through every stop', async () => {
    render(<RouteOptimizer assignments={accepted} userLocation={userLocation} />);
    fireEvent.click(await screen.findByText('Navigate Route'));

    const nav = await screen.findByTestId('in-app-navigation');
    // Two stops: one waypoint, then the final stop as the destination
    expect(nav).toHaveAttribute('data-waypoints', '1');
    expect(['5.6145,-0.2057', '5.556,-0.1969']).toContain(nav.getAttribute('data-destination'));
    expect(window.open).not.toHaveBeenCalled();
  });

  test('only active jobs (accepted, en route, arrived) are on the route', async () => {
    const mixed = [
      ...accepted,
      job('3', 'en_route', 'Yaw Boateng', 5.5900, -0.2200),
      job('4', 'available', 'Not Mine', 5.6000, -0.1800),
      job('5', 'completed', 'Already Done', 5.6100, -0.1700),
    ];
    render(<RouteOptimizer assignments={mixed} userLocation={userLocation} />);

    expect(await screen.findByText('Yaw Boateng')).toBeInTheDocument();
    expect(screen.getByText('Ama Owusu')).toBeInTheDocument();
    expect(screen.queryByText('Not Mine')).not.toBeInTheDocument();
    expect(screen.queryByText('Already Done')).not.toBeInTheDocument();
  });

  test('jobs without usable coordinates are left off the route', async () => {
    render(
      <RouteOptimizer
        assignments={[job('6', 'accepted', 'No Location', 0, 0), job('7', 'accepted', 'Bad Location', NaN, NaN)]}
        userLocation={userLocation}
      />
    );
    expect(await screen.findByText('No jobs on your route')).toBeInTheDocument();
  });
});
