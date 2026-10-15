/**
 * Database calls for volunteer clean-up groups. See src/utils/volunteer.js.
 */
import { supabase } from './supabase';
import { logger } from '../utils/logger';

/** The group's access: { role, status: 'pending' | 'approved' | 'rejected', region, district, review_note } */
export const fetchMyAccess = async () => {
  const { data, error } = await supabase.rpc('my_access');
  if (error) throw error;
  return data || null;
};

/** Ask TrashDrop for Volunteer access (an admin approves it in the admin app) */
export const requestVolunteerAccess = async ({ groupName, region, district, details }) => {
  const { error } = await supabase.rpc('request_account_role', {
    p_company_type: 'volunteer_group',
    p_org_name: groupName,
    p_region: region || null,
    p_district: district || null,
    p_details: details || {},
  });
  if (error) {
    logger.warn('Volunteer access request not saved:', error.message);
    throw error;
  }
};

/** Verified reports nobody has taken yet, in the group's region */
export const listClaimableReports = async () => {
  const { data, error } = await supabase.rpc('volunteer_claimable_reports');
  if (error) throw error;
  return Array.isArray(data) ? data : [];
};

/** Take a report; it then shows under Available like an assignment */
export const claimReport = async (reportId) => {
  const { data, error } = await supabase.rpc('claim_dumping_report', { p_report_id: reportId });
  if (error) throw error;
  return data;
};

/** Give a claimed report back to the pool */
export const releaseClaim = async (reportId) => {
  const { data, error } = await supabase.rpc('release_dumping_claim', { p_report_id: reportId });
  if (error) throw error;
  return data;
};
