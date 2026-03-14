/**
 * Centralized Geofence Configuration
 * 
 * All geofence radius values used across the app are defined here.
 * DO NOT hardcode geofence values anywhere else in the codebase.
 * 
 * IMPORTANT CONTEXT:
 * - Typical smartphone GPS accuracy in urban areas: 10-20m
 * - In dense Accra neighborhoods near buildings: 10-30m
 * - False arrivals from fallback coordinates are separately guarded
 *   by isFallback checks in NavigationQRModal and AssignmentNavigationModal.
 * 
 * RADIUS DESIGN RATIONALE:
 * - Auto-arrival (25m): Reliably triggers when collector is physically present.
 *   With 10-15m GPS error, requires ~10-15m actual distance. Prevents false
 *   positives from across the street while avoiding stuck-at-location issues.
 * - Manual arrival (40m): "I'm Here" button for when GPS keeps oscillating
 *   outside auto-arrival radius. Requires manual tap = no false auto-completions.
 * - Assignment completion (50m): Broader radius for assignments (verified by
 *   navigation modal arrival or manual geofence check on Assign page).
 * - Disposal site (50m): For verifying collector is at the disposal/dumping site.
 * - Nav step advance (20m): For advancing voice navigation instructions.
 */

// --- Pickup Request & Digital Bin Geofences ---

/** Auto-arrival radius for pickup requests and digital bins (in km).
 *  When the collector is within this distance, arrival is auto-detected. */
export const PICKUP_ARRIVAL_RADIUS_KM = 0.025; // 25 meters

/** Manual arrival radius for pickup requests and digital bins (in km).
 *  When between auto-arrival and this radius, show "I'm Here" button
 *  so the collector can manually confirm arrival. */
export const PICKUP_MANUAL_ARRIVAL_RADIUS_KM = 0.040; // 40 meters

// --- Assignment Geofences ---

/** Auto-arrival radius for authority assignments (in km).
 *  Used in AssignmentNavigationModal for arrival detection. */
export const ASSIGNMENT_ARRIVAL_RADIUS_KM = 0.025; // 25 meters

/** Manual arrival radius for authority assignments (in km). */
export const ASSIGNMENT_MANUAL_ARRIVAL_RADIUS_KM = 0.040; // 40 meters

/** Geofence radius for assignment completion check on Assign page (in km).
 *  This is the radius used when the collector taps "Complete" on an assignment. */
export const ASSIGNMENT_COMPLETION_RADIUS_KM = 0.050; // 50 meters

// --- Disposal Site Geofences ---

/** Radius for verifying collector is at a disposal/dumping site (in km). */
export const DISPOSAL_SITE_RADIUS_KM = 0.050; // 50 meters

// --- Navigation Step Advancement ---

/** Radius for advancing to next voice navigation instruction (in km). */
export const NAV_STEP_ADVANCE_RADIUS_KM = 0.020; // 20 meters

// --- Helper: Convert km to meters for display ---
export const kmToMeters = (km) => Math.round(km * 1000);

// --- Human-readable descriptions for UI messages ---
export const GEOFENCE_DESCRIPTIONS = {
  pickupArrival: `${kmToMeters(PICKUP_ARRIVAL_RADIUS_KM)}m`,
  pickupManual: `${kmToMeters(PICKUP_MANUAL_ARRIVAL_RADIUS_KM)}m`,
  assignmentArrival: `${kmToMeters(ASSIGNMENT_ARRIVAL_RADIUS_KM)}m`,
  assignmentManual: `${kmToMeters(ASSIGNMENT_MANUAL_ARRIVAL_RADIUS_KM)}m`,
  assignmentCompletion: `${kmToMeters(ASSIGNMENT_COMPLETION_RADIUS_KM)}m`,
  disposalSite: `${kmToMeters(DISPOSAL_SITE_RADIUS_KM)}m`,
};
