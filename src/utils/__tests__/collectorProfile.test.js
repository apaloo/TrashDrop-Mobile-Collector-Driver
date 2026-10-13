import { getProfileState, PROFILE_STATE, toLocalPhone } from '../collectorProfile';

const complete = {
  first_name: 'Jack', last_name: 'Bhone', phone: '+233245724489', region: 'Greater Accra',
  vehicle_type: 'cart', license_plate: 'GR-9234-24', status: 'active', deactivated_at: null
};

describe('getProfileState', () => {
  it('is MISSING with no profile', () => {
    expect(getProfileState(null)).toBe(PROFILE_STATE.MISSING);
  });

  it('is READY for a complete, active profile', () => {
    expect(getProfileState(complete)).toBe(PROFILE_STATE.READY);
  });

  it('accepts vehicle_plate in place of license_plate', () => {
    expect(getProfileState({ ...complete, license_plate: null, vehicle_plate: 'GR-1' })).toBe(PROFILE_STATE.READY);
  });

  it('is INCOMPLETE when a required field is blank', () => {
    expect(getProfileState({ ...complete, vehicle_type: '' })).toBe(PROFILE_STATE.INCOMPLETE);
    expect(getProfileState({ ...complete, license_plate: '  ' })).toBe(PROFILE_STATE.INCOMPLETE);
  });

  it('is BLOCKED when suspended or deactivated', () => {
    expect(getProfileState({ ...complete, status: 'suspended' })).toBe(PROFILE_STATE.BLOCKED);
    expect(getProfileState({ ...complete, deactivated_at: '2026-10-01' })).toBe(PROFILE_STATE.BLOCKED);
  });

  it('treats presence statuses (inactive / on_break) as allowed', () => {
    expect(getProfileState({ ...complete, status: 'inactive' })).toBe(PROFILE_STATE.READY);
  });
});

describe('toLocalPhone', () => {
  it('turns +233 numbers into local format', () => {
    expect(toLocalPhone('+233209338885')).toBe('0209338885');
    expect(toLocalPhone('233209338885')).toBe('0209338885');
  });
});
