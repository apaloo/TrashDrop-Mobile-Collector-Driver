/**
 * TrashDrop Mobile Collector Driver App - Data Types
 * 
 * These types are based on the Supabase schema from the instructions.
 */

/**
 * Pickup Request Model
 */
export const PickupRequestStatus = {
  PENDING: 'pending',
  AVAILABLE: 'pending', // alias — DB schema uses 'pending' not 'available'
  ACCEPTED: 'accepted',
  EN_ROUTE: 'en_route',
  ARRIVED: 'arrived',
  COLLECTING: 'collecting',
  PICKED_UP: 'collecting', // alias — DB enum uses 'collecting' not 'picked_up'
  COMPLETED: 'completed',
  DISPOSED: 'disposed',
  CANCELLED: 'cancelled',
  CANCELED: 'cancelled', // alias — DB schema uses 'cancelled'
  EXPIRED: 'expired'
};

export const WasteType = {
  PLASTIC: 'plastic',
  PAPER: 'paper',
  METAL: 'metal',
  GLASS: 'glass',
  ORGANIC: 'organic',
  GENERAL: 'general',
  RECYCLING: 'recycling'
};

/**
 * Authority Assignment Model
 */
export const AssignmentStatus = {
  AVAILABLE: 'available',
  ACCEPTED: 'accepted',
  COMPLETED: 'completed',
  DISPOSED: 'disposed'
};

