/**
 * Collector profile access rules.
 *
 * A Supabase session alone is not enough to use the collector app: the user
 * must also have a row in collector_profiles that is complete and not blocked.
 * The same rules are enforced server-side by public.is_active_collector().
 */

export const PROFILE_STATE = {
  // No session, or profile not requested yet
  IDLE: 'idle',
  LOADING: 'loading',
  // Session exists but there is no collector_profiles row (unfinished sign-up)
  MISSING: 'missing',
  // Row exists but required sign-up fields are empty
  INCOMPLETE: 'incomplete',
  // Suspended or deactivated by an admin
  BLOCKED: 'blocked',
  // Complete and allowed to work
  READY: 'ready',
  // Network / database error while loading
  ERROR: 'error'
};

const REQUIRED_FIELDS = ['first_name', 'last_name', 'phone', 'region', 'vehicle_type'];
// Volunteer clean-up groups have no vehicle; first_name holds the group name
const VOLUNTEER_REQUIRED_FIELDS = ['first_name', 'phone', 'region'];

const isFilled = (value) => typeof value === 'string' ? value.trim() !== '' : value != null;

export const isProfileComplete = (profile) => {
  if (!profile) return false;
  if (profile.collector_type === 'volunteer') {
    return VOLUNTEER_REQUIRED_FIELDS.every((field) => isFilled(profile[field]));
  }
  const hasPlate = isFilled(profile.license_plate) || isFilled(profile.vehicle_plate);
  return hasPlate && REQUIRED_FIELDS.every((field) => isFilled(profile[field]));
};

export const isProfileBlocked = (profile) =>
  !!profile && (profile.status === 'suspended' || profile.deactivated_at != null);

export const getProfileState = (profile) => {
  if (!profile) return PROFILE_STATE.MISSING;
  if (isProfileBlocked(profile)) return PROFILE_STATE.BLOCKED;
  if (!isProfileComplete(profile)) return PROFILE_STATE.INCOMPLETE;
  return PROFILE_STATE.READY;
};

// Strip the +233 prefix so the phone can pre-fill the local-number input
export const toLocalPhone = (phone = '') => {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('233') ? `0${digits.slice(3)}` : digits;
};

// Sign-up link with the phone pre-filled
export const signupPathFor = (phone) =>
  phone ? `/signup?phone=${encodeURIComponent(toLocalPhone(phone))}` : '/signup';

export const NO_ACCOUNT_MESSAGE = 'No account found for this number.';
