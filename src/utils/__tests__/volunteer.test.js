import { getProfileState, PROFILE_STATE } from '../collectorProfile';
import {
  isVolunteerProfile, isVolunteerPath, validateVolunteerSignup, cleanupPhotoUrls, claimErrorMessage,
} from '../volunteer';
import { GHANA_REGIONS, districtsOf } from '../../config/ghanaRegions';

const group = {
  collector_type: 'volunteer', first_name: 'Bus Stop Boys', last_name: '', phone: '+233244000000',
  region: 'Greater Accra', vehicle_type: null, license_plate: null, status: 'active', deactivated_at: null,
};

describe('volunteer group profiles', () => {
  it('are complete without a vehicle, plate or last name', () => {
    expect(getProfileState(group)).toBe(PROFILE_STATE.READY);
    expect(isVolunteerProfile(group)).toBe(true);
  });

  it('still need the group name, phone and region', () => {
    expect(getProfileState({ ...group, first_name: ' ' })).toBe(PROFILE_STATE.INCOMPLETE);
    expect(getProfileState({ ...group, region: '' })).toBe(PROFILE_STATE.INCOMPLETE);
  });

  it('can be suspended like any collector', () => {
    expect(getProfileState({ ...group, status: 'suspended' })).toBe(PROFILE_STATE.BLOCKED);
  });

  it('a paid collector without a vehicle is still incomplete', () => {
    expect(getProfileState({ ...group, collector_type: 'collector', last_name: 'Mensah' })).toBe(PROFILE_STATE.INCOMPLETE);
    expect(isVolunteerProfile({ collector_type: 'collector' })).toBe(false);
    expect(isVolunteerProfile(null)).toBe(false);
  });

  it('only open Assign and Profile', () => {
    expect(isVolunteerPath('/assign')).toBe(true);
    expect(isVolunteerPath('/profile')).toBe(true);
    ['/map', '/request', '/request/1', '/earnings', '/route-optimization', '/assignments'].forEach(p =>
      expect(isVolunteerPath(p)).toBe(false));
  });
});

describe('volunteer group sign-up', () => {
  const madina = districtsOf('Greater Accra').find(d => /madina/i.test(d));

  it('uses the same 16 regions and 260 districts as the admin app and database', () => {
    expect(GHANA_REGIONS).toHaveLength(16);
    expect(GHANA_REGIONS.reduce((n, r) => n + r.districts.length, 0)).toBe(260);
  });

  it('needs group name, leader, region and a district in that region', () => {
    expect(Object.keys(validateVolunteerSignup({}).errors).sort()).toEqual(['district', 'group_name', 'leader_name', 'region']);
    expect(validateVolunteerSignup({ group_name: 'G', leader_name: 'L', region: 'Ashanti', district: madina }).errors)
      .toEqual({ district: 'Choose a district in this region' });
  });

  it('accepts a complete group and passes the leader and size on for approval', () => {
    const r = validateVolunteerSignup({ group_name: 'Bus Stop Boys', leader_name: ' Kojo Mensah ', region: 'Greater Accra', district: madina, members: '12' });
    expect(r.errors).toEqual({});
    expect(r.details).toEqual({ leaderName: 'Kojo Mensah', members: '12' });
    expect(validateVolunteerSignup({ group_name: 'G', leader_name: 'L', region: 'Greater Accra', district: madina, members: 'ten' }).errors)
      .toEqual({ members: 'Enter a whole number' });
  });
});

describe('cleanup photos and messages', () => {
  it('keeps only uploaded photo links', () => {
    expect(cleanupPhotoUrls([
      { cloudUrl: 'https://cdn/a.jpg' }, { url: 'blob:http://x/1' }, { url: 'https://cdn/b.jpg' }, null, 'https://cdn/c.jpg',
    ])).toEqual(['https://cdn/a.jpg', 'https://cdn/b.jpg', 'https://cdn/c.jpg']);
    expect(cleanupPhotoUrls(undefined)).toEqual([]);
  });

  it('turns database errors into plain messages', () => {
    expect(claimErrorMessage({ message: 'This report is outside your region' })).toBe('This report is outside your region');
    expect(claimErrorMessage({ message: 'Could not find the function public.claim_dumping_report' })).toMatch(/isn't switched on yet/);
    expect(claimErrorMessage({ message: 'Failed to fetch' })).toMatch(/internet/);
  });
});
