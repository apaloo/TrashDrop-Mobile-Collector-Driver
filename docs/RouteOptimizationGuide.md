# Route Optimization Developer Guide

## Overview

The route optimization feature in the TrashDrop Mobile Collector Driver app helps drivers plan efficient routes for waste collection assignments. This guide provides technical details about the implementation, algorithms used, and how to extend or modify the feature.

## Architecture

The route optimization feature consists of the following components:

1. **Utility Functions** (`routeOptimizationUtils.js`):
   - Core algorithms for route calculation
   - Distance and time estimation
   - URL generation for navigation

2. **UI Components**:
   - `RouteOptimizer.jsx`: Main component for displaying optimized routes
   - `RouteStatistics.jsx`: Component for showing route metrics
   - `AssignmentList.jsx`: Component for displaying assignments in route order

3. **Page Component**:
   - `RouteOptimization.jsx`: Page that integrates all route optimization components

## Algorithms

### Nearest Neighbor Algorithm

The route optimization uses the Nearest Neighbor algorithm, which is a greedy approach to solving the Traveling Salesman Problem (TSP). While not guaranteed to find the absolute optimal route, it provides a good approximation with reasonable performance for the typical number of assignments a driver handles.

#### How it works:

1. Start from the current position (driver's location)
2. Find the nearest unvisited assignment
3. Add it to the route
4. Update current position to the selected assignment
5. Repeat steps 2-4 until all assignments are visited

#### Performance characteristics:

- **Time complexity**: O(n²) where n is the number of assignments
- **Space complexity**: O(n)
- **Pros**: Simple, fast for small datasets, easy to understand
- **Cons**: Can miss optimal solutions, especially for larger datasets

### Distance Calculation

Distances are calculated using the Haversine formula, which accounts for the Earth's curvature when calculating distances between geographic coordinates.

## Extending the Feature

### Adding a New Route Optimization Algorithm

To implement a different route optimization algorithm:

1. Add a new function to `routeOptimizationUtils.js`:

```javascript
/**
 * Calculate route using [Algorithm Name]
 * 
 * @param {Array} assignments - Array of assignment objects with lat/lng coordinates
 * @param {Object} startPosition - Starting position with lat/lng coordinates
 * @returns {Array} - Ordered array of assignments in optimized route order
 */
export const calculateCustomRoute = (assignments, startPosition) => {
  // Your algorithm implementation here
  
  return optimizedRoute;
};
```

2. Update the `RouteOptimizer` component to use your new algorithm:

```javascript
import { calculateCustomRoute } from '../utils/routeOptimizationUtils';

// Inside useEffect:
const route = calculateCustomRoute(acceptedAssignments, startPosition);
```

### Adding Route Optimization Settings

To allow users to customize route optimization settings:

1. Add state variables to the `RouteOptimization` page:

```javascript
const [optimizationSettings, setOptimizationSettings] = useState({
  algorithm: 'nearestNeighbor',
  includeTraffic: true,
  avoidTolls: false,
  preferHighways: true
});
```

2. Create a settings component:

```javascript
const RouteSettings = ({ settings, onSettingsChange }) => {
  // Settings UI implementation
};
```

3. Pass settings to the route optimization components:

```javascript
<RouteOptimizer 
  assignments={assignments} 
  userLocation={userLocation}
  settings={optimizationSettings}
/>
```

### Implementing Advanced Features

#### Traffic-Aware Routing

To incorporate real-time traffic data:

1. Integrate with a traffic API (e.g., Google Maps, Mapbox)
2. Modify the distance calculation to account for traffic conditions
3. Update the time estimation to include traffic delays

#### Multiple Vehicle Routing

To support route optimization for multiple vehicles:

1. Implement a clustering algorithm to assign assignments to vehicles
2. Calculate optimal routes for each vehicle separately
3. Create a UI to display and manage multiple routes

## Testing

The route optimization feature includes comprehensive tests:

- Unit tests for utility functions (`routeOptimizationUtils.test.js`)
- Component tests for UI components (`RouteOptimizer.test.js`)

To run the tests:

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/tests/routeOptimizationUtils.test.js
```

## Performance Considerations

- **Large Datasets**: The Nearest Neighbor algorithm may become slow for very large datasets (>100 assignments). Consider implementing more efficient algorithms for such cases.
- **Map Rendering**: Leaflet maps can be performance-intensive. Use markers clustering for large numbers of markers.
- **Mobile Performance**: Optimize calculations and rendering for mobile devices with limited resources.

## Future Improvements

- Implement more sophisticated algorithms (e.g., 2-opt, genetic algorithms)
- Add support for time windows (assignments that must be completed within specific time ranges)
- Incorporate vehicle capacity constraints
- Implement multi-day route planning
- Add support for different vehicle types with varying speeds and capabilities
