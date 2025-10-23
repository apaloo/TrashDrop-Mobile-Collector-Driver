# User Notification & Real-Time Tracking Implementation

## Overview
This document describes the user notification and real-time location tracking features implemented in the TrashDrop Mobile Collector Driver app.

## ✅ Features Implemented

### 1. **User Notifications on Request Acceptance**

When a collector accepts a pickup request, the system now:

#### **Collector App Actions:**
- ✅ Creates an in-app notification in the `notifications` table
- ✅ Includes collector's name and details
- ✅ Notifies user that their request has been accepted
- ✅ Informs user they can track progress

#### **Database Changes:**
```sql
INSERT INTO public.notifications (user_id, title, message, type, read)
VALUES (
  [user_id_from_pickup_request],
  'Pickup Request Accepted! 🎉',
  '[Collector Name] has accepted your [waste_type] pickup request and will arrive soon. Track their progress in the app.',
  'pickup_accepted',
  false
);
```

#### **Implementation Details:**
- **File**: `/src/services/requestManagement.js`
- **Method**: `notifyUserOfAcceptance(acceptedRequest)`
- **Trigger**: Automatically called after successful request acceptance
- **Error Handling**: Notification failures don't block request acceptance

---

### 2. **Real-Time Location Tracking**

When a collector starts navigation, the system now:

#### **Collector App Actions:**
- ✅ Broadcasts GPS location every 10 seconds
- ✅ Updates `collectors.current_location` in database
- ✅ Includes request ID to link location to specific pickup
- ✅ Notifies user when collector is en route
- ✅ Stops broadcasting when navigation ends

#### **Location Data Structure:**
```json
{
  "lat": 5.6037,
  "lng": -0.1870,
  "accuracy": 15.5,
  "timestamp": "2025-10-23T07:30:00.000Z",
  "active_request_id": "550e8400-e29b-41d4-a716-446655440000",
  "heading": 180.5,
  "speed": 12.3
}
```

#### **Implementation Details:**
- **File**: `/src/services/locationBroadcast.js`
- **Service**: `LocationBroadcastService`
- **Update Interval**: 10 seconds (configurable)
- **Database Table**: `collectors` (updates `current_location` column)

#### **Notifications Sent:**
1. **En Route Notification**: Sent once when navigation starts
   ```
   Title: "Collector En Route 🚗"
   Message: "[Collector Name] is on the way to collect your [waste_type]. 
            You can track their location in real-time."
   ```

2. **ETA Updates** (Optional): Can be called to update estimated arrival time
   ```
   Title: "Updated ETA ⏰"
   Message: "Your collector will arrive in approximately [X] minutes."
   ```

---

## 📱 User-Facing App Requirements

The **TrashDrop_Mobile_User_Domestic** app needs to implement the following to leverage these features:

### **1. Notification Listener**

Listen for new notifications in the user app:

```javascript
// Subscribe to notifications for the current user
const notificationSubscription = supabase
  .channel('user_notifications')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${currentUserId}`
    },
    (payload) => {
      const notification = payload.new;
      
      // Show in-app notification banner
      showNotificationBanner(notification.title, notification.message);
      
      // Send push notification if app is in background
      if (notification.type === 'pickup_accepted') {
        sendLocalPushNotification(notification);
      }
      
      // Update notification badge count
      updateNotificationBadge();
    }
  )
  .subscribe();
```

### **2. Real-Time Collector Location Tracking**

Track collector's location during active pickups:

```javascript
// Get the collector ID from the accepted pickup request
const { data: activeRequest } = await supabase
  .from('pickup_requests')
  .select('id, collector_id, status')
  .eq('user_id', currentUserId)
  .eq('status', 'accepted')
  .single();

if (activeRequest?.collector_id) {
  // Subscribe to collector location updates
  const locationSubscription = supabase
    .channel('collector_location')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'collectors',
        filter: `id=eq.${activeRequest.collector_id}`
      },
      (payload) => {
        const collectorData = payload.new;
        const location = collectorData.current_location;
        
        // Verify this location update is for the user's active request
        if (location?.active_request_id === activeRequest.id) {
          // Update map marker with collector's current position
          updateCollectorMarker({
            lat: location.lat,
            lng: location.lng,
            heading: location.heading,
            timestamp: location.timestamp
          });
          
          // Calculate and display ETA
          const eta = calculateETA(userLocation, location);
          displayETA(eta);
          
          // Show route from collector to user
          updateRoute(location, userLocation);
        }
      }
    )
    .subscribe();
}
```

### **3. Notification Center UI**

Display all notifications for the user:

```javascript
// Fetch unread notifications
const { data: notifications } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', currentUserId)
  .order('created_at', { ascending: false })
  .limit(50);

// Render notification list
notifications.forEach(notification => {
  renderNotification({
    icon: getNotificationIcon(notification.type),
    title: notification.title,
    message: notification.message,
    timestamp: notification.created_at,
    isRead: notification.read,
    onTap: () => handleNotificationTap(notification)
  });
});

// Mark notification as read
const markAsRead = async (notificationId) => {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);
};
```

### **4. Live Tracking Map Component**

Create a map view to show collector's real-time location:

```javascript
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';

const LiveTrackingMap = ({ requestId, userId }) => {
  const [collectorLocation, setCollectorLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [route, setRoute] = useState([]);
  
  useEffect(() => {
    // Get active request
    const fetchActiveRequest = async () => {
      const { data } = await supabase
        .from('pickup_requests')
        .select('*, collectors(current_location, first_name, last_name)')
        .eq('id', requestId)
        .single();
        
      if (data?.collectors?.current_location) {
        setCollectorLocation(data.collectors.current_location);
      }
    };
    
    fetchActiveRequest();
    
    // Subscribe to updates
    const subscription = supabase
      .channel('live_tracking')
      .on('postgres_changes', { ... })
      .subscribe();
      
    return () => subscription.unsubscribe();
  }, [requestId]);
  
  return (
    <MapContainer center={[5.6037, -0.1870]} zoom={13}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      
      {/* User's location */}
      <Marker position={userLocation} icon={homeIcon} />
      
      {/* Collector's current location */}
      {collectorLocation && (
        <Marker 
          position={[collectorLocation.lat, collectorLocation.lng]} 
          icon={truckIcon}
        />
      )}
      
      {/* Route line */}
      {route.length > 0 && (
        <Polyline positions={route} color="blue" />
      )}
    </MapContainer>
  );
};
```

---

## 🔧 Configuration

### **Location Broadcast Settings**

Edit `/src/services/locationBroadcast.js` to customize:

```javascript
constructor() {
  this.BROADCAST_INTERVAL = 10000; // 10 seconds (adjustable)
}
```

**Recommended Values:**
- **High Accuracy**: 5000ms (5 seconds) - higher battery drain
- **Balanced**: 10000ms (10 seconds) - recommended default
- **Battery Saver**: 30000ms (30 seconds) - lower accuracy

---

## 🔒 Security & Privacy

### **Location Data Privacy:**
- ✅ Location only broadcast during active pickups
- ✅ Tracking stops immediately when navigation ends
- ✅ Only users with active requests can access collector location
- ✅ Historical location data not stored

### **Row-Level Security (RLS):**

Ensure proper RLS policies are in place:

```sql
-- Users can only view their own notifications
CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can only view collector location for their active requests
CREATE POLICY "Users view collector location for active requests"
  ON public.collectors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pickup_requests
      WHERE collector_id = collectors.id
        AND user_id = auth.uid()
        AND status = 'accepted'
    )
  );
```

---

## 📊 Database Schema Updates

### **Required Columns (Already Present):**
- ✅ `pickup_requests.user_id` → References user who created the request
- ✅ `collectors.current_location` → JSONB field for real-time GPS
- ✅ `notifications` table → Stores all user notifications

### **Indexes for Performance:**
```sql
-- Optimize notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created 
  ON public.notifications(user_id, created_at DESC);

-- Optimize collector location lookups
CREATE INDEX IF NOT EXISTS idx_collectors_current_location 
  ON public.collectors USING GIN (current_location);
```

---

## 🧪 Testing

### **Test User Notifications:**
1. Create a test pickup request with a valid `user_id`
2. Accept the request using the collector app
3. Check the `notifications` table:
   ```sql
   SELECT * FROM public.notifications 
   WHERE user_id = '[test_user_id]' 
   ORDER BY created_at DESC LIMIT 1;
   ```
4. Verify notification appears in user app

### **Test Location Tracking:**
1. Accept a request and start navigation
2. Monitor collector location updates:
   ```sql
   SELECT id, current_location, last_active 
   FROM public.collectors 
   WHERE id = '[collector_id]';
   ```
3. Verify `current_location` updates every 10 seconds
4. Confirm `active_request_id` matches the current request

---

## 🚀 Future Enhancements

### **Push Notifications:**
Integrate with:
- **Firebase Cloud Messaging (FCM)** for Android
- **Apple Push Notification Service (APNS)** for iOS
- **OneSignal** for cross-platform support

### **Advanced Features:**
- ✅ ETA calculations based on real-time traffic
- ✅ Route optimization alerts
- ✅ Notification when collector is 5 minutes away
- ✅ SMS fallback for users without app access
- ✅ In-app chat between user and collector

---

## 📞 Support

For questions or issues:
- **Documentation**: `/docs`
- **Issue Tracker**: GitHub Issues
- **Email**: support@trashdrop.com

---

## ✅ Implementation Checklist

### **Collector App (COMPLETED):**
- [x] User notification on request acceptance
- [x] Real-time location broadcasting during navigation
- [x] Stop tracking when navigation ends
- [x] Error handling for notification failures
- [x] Probabilistic logging to reduce console spam

### **User App (PENDING):**
- [ ] Notification listener with Supabase Realtime
- [ ] Live tracking map component
- [ ] ETA calculation and display
- [ ] Notification center UI
- [ ] Push notification integration
- [ ] Mark notifications as read functionality

---

**Last Updated:** October 23, 2025  
**Version:** 1.0.0  
**Status:** ✅ Ready for User App Integration
