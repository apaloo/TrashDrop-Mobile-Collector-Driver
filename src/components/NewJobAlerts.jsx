import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFilters } from '../context/FilterContext';
import { realtimeNotificationService } from '../services/realtimeNotificationService';

/**
 * Keeps the "New job nearby!" alert listening on every page while the
 * collector is logged in, not only while the Map page is open. Renders
 * nothing.
 */
const NewJobAlerts = () => {
  const { user, isAuthenticated, hasLoggedOut } = useAuth();
  const { filters } = useFilters();
  const collectorId = isAuthenticated && !hasLoggedOut ? user?.id : null;
  const searchRadius = filters?.searchRadius;

  useEffect(() => {
    if (!collectorId) return undefined;

    realtimeNotificationService.initialize(collectorId, { searchRadius: searchRadius || 5 });

    // Distance filtering needs a current position; the Map page is no longer
    // guaranteed to be open to supply one.
    let watchId = null;
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => realtimeNotificationService.updateLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }),
        () => { /* keep the last known position */ },
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 }
      );
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      realtimeNotificationService.destroy();
    };
    // searchRadius is applied by the effect below without resubscribing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectorId]);

  useEffect(() => {
    if (searchRadius) realtimeNotificationService.updateSearchRadius(searchRadius);
  }, [searchRadius]);

  return null;
};

export default NewJobAlerts;
