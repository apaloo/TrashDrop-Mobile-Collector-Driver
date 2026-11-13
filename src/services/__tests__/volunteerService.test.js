// Volunteer clean-up groups (collector app): asking for Volunteer access,
// the reports a group can claim, claiming and giving one back. The database
// decides who may do what (request_account_role, volunteer_claimable_reports,
// claim_dumping_report, release_dumping_claim); these pin what the app asks
// and that a refusal reaches the volunteer instead of a silent nothing.
import { fetchMyAccess, requestVolunteerAccess, listClaimableReports, claimReport, releaseClaim } from '../volunteerService';
import { supabase } from '../supabase';

jest.mock('../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../supabase', () => ({ supabase: { rpc: jest.fn() } }));

const answer = (data, error = null) => supabase.rpc.mockResolvedValueOnce({ data, error });
beforeEach(() => supabase.rpc.mockReset());

describe('volunteerService', () => {
  it("fetchMyAccess: the group's access from the database, or null", async () => {
    answer({ role: 'volunteer', status: 'approved', region: 'Greater Accra' });
    await expect(fetchMyAccess()).resolves.toEqual({ role: 'volunteer', status: 'approved', region: 'Greater Accra' });
    expect(supabase.rpc).toHaveBeenCalledWith('my_access');
    answer(null);
    await expect(fetchMyAccess()).resolves.toBeNull();
    answer(null, { message: 'JWT expired' });
    await expect(fetchMyAccess()).rejects.toEqual({ message: 'JWT expired' });
  });

  it('requestVolunteerAccess asks for the volunteer_group type, with nulls for what was left out', async () => {
    answer(null);
    await requestVolunteerAccess({ groupName: 'Clean Abokobi', region: 'Greater Accra', district: 'Ga East', details: { members: 12 } });
    expect(supabase.rpc).toHaveBeenCalledWith('request_account_role', {
      p_company_type: 'volunteer_group', p_org_name: 'Clean Abokobi', p_region: 'Greater Accra', p_district: 'Ga East', p_details: { members: 12 },
    });
    answer(null);
    await requestVolunteerAccess({ groupName: 'G' });
    expect(supabase.rpc).toHaveBeenLastCalledWith('request_account_role', {
      p_company_type: 'volunteer_group', p_org_name: 'G', p_region: null, p_district: null, p_details: {},
    });
  });

  it('a refused access request reaches the volunteer', async () => {
    answer(null, { message: 'Region and district are set by an admin' });
    await expect(requestVolunteerAccess({ groupName: 'G' })).rejects.toEqual({ message: 'Region and district are set by an admin' });
  });

  it('claimable reports: a list, or empty for anything else; a refusal throws', async () => {
    answer([{ id: 'r1' }]);
    await expect(listClaimableReports()).resolves.toEqual([{ id: 'r1' }]);
    answer(null);
    await expect(listClaimableReports()).resolves.toEqual([]);
    answer({ id: 'not a list' });
    await expect(listClaimableReports()).resolves.toEqual([]);
    answer(null, { message: 'Only approved volunteer groups' });
    await expect(listClaimableReports()).rejects.toEqual({ message: 'Only approved volunteer groups' });
  });

  it('claiming and giving back a report go through the database, which can refuse', async () => {
    answer({ id: 'r1', assigned_to: 'me' });
    await expect(claimReport('r1')).resolves.toEqual({ id: 'r1', assigned_to: 'me' });
    expect(supabase.rpc).toHaveBeenLastCalledWith('claim_dumping_report', { p_report_id: 'r1' });
    answer(null, { message: 'Already claimed by another group' });
    await expect(claimReport('r1')).rejects.toEqual({ message: 'Already claimed by another group' });
    answer(true);
    await expect(releaseClaim('r1')).resolves.toBe(true);
    expect(supabase.rpc).toHaveBeenLastCalledWith('release_dumping_claim', { p_report_id: 'r1' });
    answer(null, { message: 'Not your claim' });
    await expect(releaseClaim('r1')).rejects.toEqual({ message: 'Not your claim' });
  });
});
