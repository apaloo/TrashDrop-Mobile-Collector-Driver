import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PROFILE_STATE, signupPathFor } from '../utils/collectorProfile';

const FullScreen = ({ children }) => (
  <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
    <div className="w-full max-w-sm text-center">{children}</div>
  </div>
);

/**
 * Wraps every collector route. A session alone is not enough: the user must
 * also have a complete, active collector profile. The profile is loaded once
 * in AuthContext and reused here.
 */
const RequireCollectorProfile = ({ children }) => {
  const { isAuthenticated, hasLoggedOut, user, profile, profileState, refreshProfile, logout } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || hasLoggedOut) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (profileState === PROFILE_STATE.LOADING || profileState === PROFILE_STATE.IDLE) {
    return (
      <FullScreen>
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" role="status" />
        <p className="mt-4 text-gray-700 font-medium">Checking your account...</p>
      </FullScreen>
    );
  }

  if (profileState === PROFILE_STATE.MISSING) {
    return <Navigate to={signupPathFor(user?.phone)} replace />;
  }

  if (profileState === PROFILE_STATE.ERROR) {
    return (
      <FullScreen>
        <p className="text-lg font-bold text-gray-900 mb-2">We couldn't load your account</p>
        <p className="text-gray-600 mb-6">Check your internet connection and try again.</p>
        <button type="button" className="w-full py-3 bg-primary text-white font-bold rounded-xl" onClick={refreshProfile}>
          Try again
        </button>
      </FullScreen>
    );
  }

  if (profileState === PROFILE_STATE.INCOMPLETE || profileState === PROFILE_STATE.BLOCKED) {
    const blocked = profileState === PROFILE_STATE.BLOCKED;
    return (
      <FullScreen>
        <div className="text-5xl mb-4">{blocked ? '⏸️' : '📝'}</div>
        <p className="text-xl font-bold text-gray-900 mb-2">
          {blocked ? 'Your account is on hold' : 'Your sign-up isn\'t finished'}
        </p>
        <p className="text-gray-600 mb-6">
          {blocked
            ? 'You can\'t take jobs or cash out right now. Please contact TrashDrop support.'
            : 'Add your details and vehicle to start taking jobs.'}
        </p>
        {!blocked && (
          <a href={signupPathFor(profile?.phone || user?.phone)} className="block w-full py-3 mb-3 bg-primary text-white font-bold rounded-xl">
            Finish sign-up
          </a>
        )}
        <button type="button" className="w-full py-3 bg-gray-200 text-gray-800 font-bold rounded-xl" onClick={logout}>
          Sign out
        </button>
      </FullScreen>
    );
  }

  return children;
};

export default RequireCollectorProfile;
