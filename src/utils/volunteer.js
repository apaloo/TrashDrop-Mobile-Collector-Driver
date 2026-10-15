/**
 * Volunteer clean-up groups.
 *
 * A group (one shared login) signs up here like a collector but without a
 * vehicle, and asks TrashDrop for Volunteer access. Once approved it claims
 * verified illegal-dumping reports in its region and cleans them up through
 * the normal Assign flow. Groups are not paid and don't take pickup requests.
 * The rules are enforced in the database (supabase migration
 * 20261028_volunteer_claims.sql in the admin app repository).
 */
import { districtsOf, isKnownDistrict } from '../config/ghanaRegions';

export const COLLECTOR_TYPE = { COLLECTOR: 'collector', VOLUNTEER: 'volunteer' };

export const isVolunteerProfile = (profile) => profile?.collector_type === COLLECTOR_TYPE.VOLUNTEER;

// Pages a volunteer group can open; everything else is for paid collectors
export const VOLUNTEER_PATHS = ['/assign', '/profile'];
export const isVolunteerPath = (pathname = '') =>
  VOLUNTEER_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));

export const MAX_OPEN_CLAIMS = 3;
export const ACCEPT_WITHIN_HOURS = 24;
export const FINISH_WITHIN_HOURS = 72;

const PHONE = /^\+?[0-9 ()-]{9,20}$/;

/** Sign-up details for a group: { errors, details } (details go to the access request) */
export const validateVolunteerSignup = ({ group_name, leader_name, region, district, members }) => {
  const errors = {};
  if (!group_name?.trim()) errors.group_name = 'Enter your group\'s name';
  if (!leader_name?.trim()) errors.leader_name = 'Enter the group leader\'s name';
  if (!region) errors.region = 'Choose your region';
  if (!district) errors.district = 'Choose your district';
  else if (region && !isKnownDistrict(region, district)) errors.district = 'Choose a district in this region';
  const m = String(members ?? '').trim();
  if (m && !/^\d{1,5}$/.test(m)) errors.members = 'Enter a whole number';
  return {
    errors,
    details: { leaderName: leader_name?.trim() || '', ...(m ? { members: m } : {}) },
  };
};

export { districtsOf };

/** Permanent links of the photos taken in the completion step (no temporary blob: links) */
export const cleanupPhotoUrls = (photos) =>
  (Array.isArray(photos) ? photos : [])
    .map(p => (typeof p === 'string' ? p : p?.cloudUrl || p?.url))
    .filter(u => typeof u === 'string' && /^https?:\/\//.test(u));

/** Plain-language message for a claim / release error from the database */
export const claimErrorMessage = (error) => {
  const msg = error?.message || '';
  if (/could not find the function|does not exist/i.test(msg)) return 'Claiming isn\'t switched on yet. Please try again later.';
  if (/failed to fetch|network/i.test(msg)) return 'No internet connection. Please try again.';
  return msg || 'Something went wrong. Please try again.';
};
