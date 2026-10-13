import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import LoginPage from '../Login';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../services/supabase', () => ({
  formatPhoneNumber: (p) => (p.startsWith('+') ? p : `+233${p.replace(/\D/g, '').replace(/^0+/, '')}`)
}));
jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));
jest.mock('../../assets/logo.svg', () => 'logo.svg');

const ShowLocation = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
};

const renderLogin = (auth) => {
  useAuth.mockReturnValue(auth);
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<ShowLocation />} />
        <Route path="/map" element={<ShowLocation />} />
      </Routes>
    </MemoryRouter>
  );
};

const enterPhoneAndSend = (phone) => {
  fireEvent.change(screen.getByPlaceholderText('0501234567'), { target: { value: phone } });
  fireEvent.click(screen.getByText('📨 Send Code'));
};

describe('Login: unregistered number', () => {
  it('shows "No account found" with a Sign up button and does not move to the code step', async () => {
    const sendLoginOtp = jest.fn().mockResolvedValue({ success: false, noAccount: true, error: 'No account found for this number.' });
    renderLogin({ sendLoginOtp, login: jest.fn() });

    enterPhoneAndSend('0209338885');

    expect(await screen.findByText('No account found for this number.')).toBeInTheDocument();
    expect(sendLoginOtp).toHaveBeenCalledWith('+233209338885');
    expect(screen.queryByText('Enter your code')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/signup?phone=0209338885');
  });

  it('returns to the phone step with "No account found" if the code is right but there is no profile', async () => {
    const sendLoginOtp = jest.fn().mockResolvedValue({ success: true });
    const login = jest.fn().mockResolvedValue({ success: false, noAccount: true, error: 'No account found for this number.' });
    renderLogin({ sendLoginOtp, login });

    enterPhoneAndSend('0209338885');
    await screen.findByText('Enter your code');

    const boxes = screen.getAllByRole('textbox');
    '123456'.split('').forEach((d, i) => fireEvent.change(boxes[i], { target: { value: d } }));
    fireEvent.click(screen.getByText('✅ Sign In'));

    expect(await screen.findByText('No account found for this number.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
  });
});

describe('Login: registered number', () => {
  it('sends the code and signs in to the map', async () => {
    const sendLoginOtp = jest.fn().mockResolvedValue({ success: true });
    const login = jest.fn().mockResolvedValue({ success: true, user: { id: 'jack' } });
    renderLogin({ sendLoginOtp, login });

    enterPhoneAndSend('0245724489');
    await screen.findByText('Enter your code');

    const boxes = screen.getAllByRole('textbox');
    '123456'.split('').forEach((d, i) => fireEvent.change(boxes[i], { target: { value: d } }));
    fireEvent.click(screen.getByText('✅ Sign In'));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/map'));
    expect(login).toHaveBeenCalledWith('+233245724489', '123456');
  });
});
