import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import RequireCollectorProfile from '../RequireCollectorProfile';
import { useAuth } from '../../context/AuthContext';
import { PROFILE_STATE } from '../../utils/collectorProfile';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));

const ShowLocation = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
};

const renderAt = (path, auth) => {
  useAuth.mockReturnValue({
    isAuthenticated: false,
    hasLoggedOut: false,
    user: null,
    profile: null,
    profileState: PROFILE_STATE.IDLE,
    refreshProfile: jest.fn(),
    logout: jest.fn(),
    ...auth
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {['/map', '/request', '/assign', '/route-optimization', '/earnings', '/profile'].map((p) => (
          <Route key={p} path={p} element={<RequireCollectorProfile><div>collector screen</div></RequireCollectorProfile>} />
        ))}
        <Route path="/login" element={<ShowLocation />} />
        <Route path="/signup" element={<ShowLocation />} />
      </Routes>
    </MemoryRouter>
  );
};

const signedIn = { isAuthenticated: true, user: { id: 'u1', phone: '233209338885' } };

describe('RequireCollectorProfile', () => {
  it.each(['/map', '/request', '/assign', '/route-optimization', '/earnings', '/profile'])(
    'sends a signed-out visitor from %s to /login',
    (path) => {
      renderAt(path, {});
      expect(screen.getByTestId('location')).toHaveTextContent('/login');
      expect(screen.queryByText('collector screen')).not.toBeInTheDocument();
    }
  );

  it('sends a user who logged out to /login even if a session lingers', () => {
    renderAt('/map', { ...signedIn, hasLoggedOut: true, profileState: PROFILE_STATE.READY });
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });

  it('shows a loading state, not the screen, while the profile loads', () => {
    renderAt('/map', { ...signedIn, profileState: PROFILE_STATE.LOADING });
    expect(screen.getByText('Checking your account...')).toBeInTheDocument();
    expect(screen.queryByText('collector screen')).not.toBeInTheDocument();
  });

  it('sends a session with no collector profile to sign-up with the phone pre-filled', () => {
    renderAt('/earnings', { ...signedIn, profileState: PROFILE_STATE.MISSING });
    expect(screen.getByTestId('location')).toHaveTextContent('/signup?phone=0209338885');
  });

  it('blocks an incomplete profile with a finish sign-up screen', () => {
    renderAt('/request', { ...signedIn, profileState: PROFILE_STATE.INCOMPLETE, profile: { phone: '+233209338885' } });
    expect(screen.getByText("Your sign-up isn't finished")).toBeInTheDocument();
    expect(screen.getByText('Finish sign-up').closest('a')).toHaveAttribute('href', '/signup?phone=0209338885');
    expect(screen.queryByText('collector screen')).not.toBeInTheDocument();
  });

  it('blocks a suspended collector', () => {
    renderAt('/earnings', { ...signedIn, profileState: PROFILE_STATE.BLOCKED });
    expect(screen.getByText('Your account is on hold')).toBeInTheDocument();
    expect(screen.queryByText('collector screen')).not.toBeInTheDocument();
  });

  it('shows the screen for a complete, active collector', () => {
    renderAt('/map', { ...signedIn, profileState: PROFILE_STATE.READY });
    expect(screen.getByText('collector screen')).toBeInTheDocument();
  });
});
