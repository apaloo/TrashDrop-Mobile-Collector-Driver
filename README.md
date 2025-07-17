# TrashDrop Mobile Collector Driver App

## Overview

The TrashDrop Mobile Collector Driver app is a mobile-first web application designed for waste collection drivers to manage pickup assignments, track disposal activities, and optimize collection routes. The app provides real-time location validation, offline support, and an intuitive user interface to streamline the waste collection process.

## Features

### Core Functionality

- **Assignment Management**: View, accept, and complete waste collection assignments
- **Location Validation**: Ensure drivers are within 50 meters of pickup/disposal locations
- **Photo Evidence**: Capture photos (min 3 required) as proof of collection
- **Disposal Tracking**: Record waste disposal at authorized dumping sites
- **Route Optimization**: Plan efficient routes for multiple pickups

### User Experience

- **Interactive Maps**: Real-time location visualization with Leaflet
- **Offline Support**: Queue actions when offline and sync when back online
- **Pull-to-Refresh**: Mobile-friendly data refreshing
- **Loading Indicators**: Visual feedback during operations
- **Animations**: Smooth transitions and visual feedback

### Technical Features

- **Responsive Design**: Works on mobile and desktop devices
- **Performance Optimizations**: Lazy loading, code splitting
- **Error Handling**: Graceful error recovery with user feedback
- **Location Services**: GPS integration for real-time positioning
- **Camera Integration**: Direct camera access for photo evidence

## Installation

```bash
# Clone the repository
git clone [repository-url]

# Navigate to project directory
cd TrashDrop_Mobile_Collector_Driver

# Install dependencies
npm install

# Start development server
npm run dev
```

## Project Structure

```
src/
├── components/         # Reusable UI components
├── contexts/           # React context providers
├── pages/              # Page components
├── utils/              # Utility functions
├── tests/              # Test files
├── assets/             # Static assets
├── App.jsx             # Main application component
└── main.jsx            # Application entry point
```

## Key Components

### Assignment Flow

- **AssignmentCard**: Displays assignment information and action buttons
- **AssignmentDetailsModal**: Shows detailed information about an assignment
- **CompletionModal**: Interface for completing an assignment with photo capture and location verification

### Location Features

- **Location Validation**: Ensures users are within 50 meters of target locations
- **Interactive Maps**: Displays user location, assignment locations, and proximity circles
- **Route Optimization**: Calculates efficient routes between multiple assignments

### Offline Support

- **OfflineContext**: Manages online/offline state and synchronization
- **OfflineIndicator**: Shows current connection status and sync progress
- **Action Queue**: Stores actions performed while offline for later synchronization

## Route Optimization

The route optimization feature helps drivers plan the most efficient route for their accepted assignments:

- **Nearest Neighbor Algorithm**: Calculates the shortest path between assignments
- **Distance and Time Estimation**: Provides estimates for total distance and completion time
- **Google Maps Integration**: One-click navigation to optimized routes
- **Fuel and CO2 Savings**: Estimates environmental impact of optimized routes

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/tests/routeOptimizationUtils.test.js
```

## Development Guidelines

### Code Style

- Follow ESLint configuration for consistent code style
- Use functional components with React Hooks
- Implement proper error handling and loading states
- Write meaningful comments for complex logic

### Adding New Features

1. Create necessary utility functions in the appropriate utils file
2. Implement React components in the components directory
3. Add page components if needed
4. Update navigation in App.jsx and BottomNavBar.jsx
5. Write tests for new functionality

## License

[License information]

## Contact

[Contact information]
