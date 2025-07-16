/**
 * TrashDrop Mobile Collector Driver App - Data Types
 * 
 * These types are based on the Supabase schema from the instructions.
 */

/**
 * Pickup Request Model
 */
export const PickupRequestStatus = {
  AVAILABLE: 'available',
  ACCEPTED: 'accepted',
  PICKED_UP: 'picked_up',
  COMPLETED: 'completed',
  CANCELED: 'canceled'
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

export const PriorityLevel = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Authority Assignment Model
 */
export const AssignmentStatus = {
  AVAILABLE: 'available',
  ACCEPTED: 'accepted',
  COMPLETED: 'completed'
};

/**
 * Alert Status and Priority
 */
export const AlertStatus = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed'
};

/**
 * Bag Status
 */
export const BagStatus = {
  AVAILABLE: 'available',
  USED: 'used',
  DAMAGED: 'damaged'
};

/**
 * Bag Order Status
 */
export const BagOrderStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELED: 'canceled'
};

/**
 * Batch Status
 */
export const BatchStatus = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  DEPLETED: 'Depleted'
};

/**
 * Collector Status
 */
export const CollectorStatus = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended',
  PENDING_APPROVAL: 'Pending_Approval'
};

/**
 * Dumping Report Status
 */
export const DumpingReportStatus = {
  REPORTED: 'reported',
  VERIFIED: 'verified',
  SCHEDULED: 'scheduled',
  CLEANED: 'cleaned'
};
