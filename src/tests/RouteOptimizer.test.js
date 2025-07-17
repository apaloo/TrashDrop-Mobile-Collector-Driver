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
}));

// Mock the window.open function
const mockOpen = jest.fn();
window.open = mockOpen;

describe('RouteOptimizer Component', () => {
  // Sample test data
  const mockAssignments = [
    {
      id: '1',
      status: 'accepted',
      location: '123 Main St, City',
      customer_name: 'John Doe',
      latitude: 37.7749,
      longitude: -122.4194
    },
    {
      id: '2',
      status: 'accepted',
      location: '456 Oak Ave, City',
      customer_name: 'Jane Smith',
      latitude: 37.3382,
      longitude: -121.8863
    }
  ];
  
  const mockUserLocation = {
    latitude: 37.7749,
    longitude: -122.4194
  };
  
  test('renders loading state when no data is provided', () => {
    render(<RouteOptimizer assignments={[]} userLocation={null} />);
    
    // Should show no assignments message
    expect(screen.getByText(/No accepted assignments to optimize/i)).toBeInTheDocument();
  });
  
  test('renders route information when data is provided', () => {
    render(
      <RouteOptimizer 
        assignments={mockAssignments} 
        userLocation={mockUserLocation} 
      />
    );
    
    // Should show distance and time information
    expect(screen.getByText(/Total distance/i)).toBeInTheDocument();
    expect(screen.getByText(/Estimated time/i)).toBeInTheDocument();
    
    // Should render the map
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    
    // Should render the navigate button
    const navigateButton = screen.getByText(/Navigate Route/i);
    expect(navigateButton).toBeInTheDocument();
  });
  
  test('navigate button opens Google Maps with directions', () => {
    render(
      <RouteOptimizer 
        assignments={mockAssignments} 
        userLocation={mockUserLocation} 
      />
    );
    
    // Click the navigate button
    const navigateButton = screen.getByText(/Navigate Route/i);
    fireEvent.click(navigateButton);
    
    // Should call window.open with a Google Maps URL
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockOpen.mock.calls[0][0]).toContain('https://www.google.com/maps/dir/');
    expect(mockOpen.mock.calls[0][1]).toBe('_blank');
  });
  
  test('renders route details with correct number of stops', () => {
    render(
      <RouteOptimizer 
        assignments={mockAssignments} 
        userLocation={mockUserLocation} 
      />
    );
    
    // Should render the correct number of stops in the route details
    const listItems = screen.getAllByRole('listitem');
    expect(listItems.length).toBe(mockAssignments.length);
    
    // Should display customer names
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });
  
  test('handles empty assignments array', () => {
    render(<RouteOptimizer assignments={[]} userLocation={mockUserLocation} />);
    
    // Should show no assignments message
    expect(screen.getByText(/No accepted assignments to optimize/i)).toBeInTheDocument();
  });
  
  test('filters out non-accepted assignments', () => {
    const mixedAssignments = [
      ...mockAssignments,
      {
        id: '3',
        status: 'available',
        location: '789 Pine Rd, City',
        customer_name: 'Bob Johnson',
        latitude: 37.8715,
        longitude: -122.2730
      }
    ];
    
    render(
      <RouteOptimizer 
        assignments={mixedAssignments} 
        userLocation={mockUserLocation} 
      />
    );
    
    // Should only show accepted assignments
    const listItems = screen.getAllByRole('listitem');
    expect(listItems.length).toBe(2); // Only the 2 accepted assignments
    
    // Should not display the available assignment's customer name
    expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
  });
});
