// A collector signing in with their phone, in a real browser against the
// built app, and the jobs map they land on. Supabase is the fake in
// fakeSupabase.mjs: no real project, account or text message is involved.
import { test, expect } from '@playwright/test';
import { fakeSupabase, collector, collectPageErrors } from './fakeSupabase.mjs';

const account = collector({ phone: '233501234567' });
// A complete, active collector profile (the fields isProfileComplete needs)
const PROFILE = {
  id: 'cp-1', user_id: account.user.id, first_name: 'Kofi', last_name: 'Mensah', phone: '+233501234567',
  region: 'Greater Accra', vehicle_type: 'tricycle', license_plate: 'GR-1234-24',
  status: 'active', collector_type: 'professional', deactivated_at: null,
};
// What Supabase returns for a geography column: EWKB hex, made by PostGIS for
// POINT(-0.187 5.6037), Osu. Two readers that couldn't read it made new-job
// alerts ignore the radius and left jobs off the map (collector #119, #120).
const OSU_EWKB = '0101000020E6100000560E2DB29DEFC7BF7C613255306A1640';
const NEAR_OSU = { latitude: 5.61, longitude: -0.19, accuracy: 8 };

// The install screen comes first in a browser; "Open App" uses it there
async function openSignIn(page) {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'Open App' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
}

async function sendCode(page, number = '0501234567') {
  await page.getByRole('textbox', { name: '0501234567' }).fill(number);
  await page.getByRole('button', { name: /Send Code/ }).click();
}

async function enterCode(page, code) {
  await expect(page.getByRole('heading', { name: 'Enter your code' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Code number 1' }).click();
  await page.keyboard.type(code);
  await page.getByRole('button', { name: /Sign In/ }).click();
}

const sent = (calls, path) => calls.filter((c) => c.path === path);

test('a number with no collector account is told so, and no code is texted', async ({ page }) => {
  const errors = collectPageErrors(page);
  const calls = await fakeSupabase(page, { account, rpc: { collector_phone_registered: false } });
  await openSignIn(page);
  await sendCode(page);
  await expect(page.getByRole('alert')).toContainText('No account found for this number.');
  await expect(page.getByRole('alert').getByRole('button', { name: 'Sign up' })).toBeVisible();
  expect(sent(calls, '/rest/v1/rpc/collector_phone_registered')[0].body).toEqual({ p_phone: '+233501234567' });
  expect(sent(calls, '/auth/v1/otp')).toEqual([]);
  expect(errors).toEqual([]);
});

test('signing in texts a code that may not create an account, and a wrong code is refused', async ({ page }) => {
  const calls = await fakeSupabase(page, { account, rpc: { collector_phone_registered: true }, tables: { collector_profiles: [PROFILE] } });
  await openSignIn(page);
  await sendCode(page);
  await expect(page.getByText('Code sent to +233501234567')).toBeVisible();
  // Login must never create a new account for an unknown number
  expect(sent(calls, '/auth/v1/otp')[0].body).toMatchObject({ phone: '+233501234567', create_user: false, channel: 'sms' });

  await enterCode(page, '000000');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Enter your code' })).toBeVisible();
  expect(sent(calls, '/auth/v1/verify')[0].body).toMatchObject({ phone: '+233501234567', token: '000000', type: 'sms' });
});

test('the right code opens the jobs map, with the bottom bar', async ({ page }) => {
  const errors = collectPageErrors(page);
  await fakeSupabase(page, { account, rpc: { collector_phone_registered: true }, tables: { collector_profiles: [PROFILE] } });
  await openSignIn(page);
  await sendCode(page);
  await enterCode(page, '123456');

  await expect(page).toHaveURL(/\/map$/);
  await expect(page.getByRole('slider', { name: 'Search radius in kilometres' })).toBeVisible();
  for (const name of ['Map', 'Request', 'Assign', 'Routes']) {
    await expect(page.getByRole('link', { name, exact: true }).filter({ visible: true }).first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('a code that works but has no collector profile behind it is signed straight out', async ({ page }) => {
  const calls = await fakeSupabase(page, { account, rpc: { collector_phone_registered: true } });
  await openSignIn(page);
  await sendCode(page);
  await enterCode(page, '123456');
  await expect(page.getByRole('alert')).toContainText('No account found for this number.');
  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(() => sent(calls, '/auth/v1/logout').length).toBeGreaterThan(0);
});

test.describe('on the map, with the phone near Osu', () => {
  test.use({ geolocation: NEAR_OSU, permissions: ['geolocation'] });

  test('a pending pickup stored as EWKB hex 0.75 km away counts as within the radius', async ({ page }) => {
    await fakeSupabase(page, {
      account,
      rpc: { collector_phone_registered: true },
      tables: {
        collector_profiles: [PROFILE],
        pickup_requests: [
          { id: 'req-osu', status: 'pending', coordinates: OSU_EWKB, location: 'Osu, Accra', waste_type: 'general', bag_count: 2, fee: 20, collector_id: null, created_at: new Date().toISOString() },
          { id: 'req-taken', status: 'accepted', coordinates: OSU_EWKB, location: 'Osu, Accra', waste_type: 'general', bag_count: 1, fee: 15, collector_id: 'someone-else', created_at: new Date().toISOString() },
        ],
      },
    });
    await openSignIn(page);
    await sendCode(page);
    await enterCode(page, '123456');
    await expect(page).toHaveURL(/\/map$/);
    // only the pending one, and it is found by its distance
    await expect(page.getByText(/^1 requests? within your radius$/)).toBeVisible();
  });
});
