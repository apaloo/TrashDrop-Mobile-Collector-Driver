import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logger } from '../utils/logger';
import { LogoutConfirmationModal } from './LogoutConfirmationModal';

/**
 * Sign out, shown at the bottom of the Profile page behind a confirmation.
 * It used to be in the header menu, where collectors could tap it by mistake.
 */
const SignOutSection = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleConfirm = async () => {
    setIsLoggingOut(true);
    try {
      const { success } = await logout();
      if (success) navigate('/login');
    } catch (err) {
      logger.error('Logout failed:', err);
    } finally {
      setIsLoggingOut(false);
      setIsModalOpen(false);
    }
  };

  return (
    <div className="mt-8 mb-4 border-t border-td-border pt-6">
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="w-full py-3 rounded-lg border-2 border-red-300 text-red-600 font-semibold bg-white hover:bg-red-50"
      >
        Sign out
      </button>
      <p className="mt-2 text-xs text-td-sage text-center">You'll need a code sent to your phone to sign back in.</p>

      <LogoutConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirm}
        isLoading={isLoggingOut}
      />
    </div>
  );
};

export default SignOutSection;
