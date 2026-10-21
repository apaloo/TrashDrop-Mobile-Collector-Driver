import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import SignOutSection from '../SignOutSection';

const logout = jest.fn(() => Promise.resolve({ success: true }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ logout: (...a) => global.__logout(...a) }) }));
jest.mock('../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

global.__logout = logout;
const Where = () => <div data-testid="where">{useLocation().pathname}</div>;
const renderProfile = () => render(
  <MemoryRouter initialEntries={['/profile']}>
    <Routes>
      <Route path="/profile" element={<SignOutSection />} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>
);

beforeEach(() => logout.mockClear());

describe('Sign out (Profile page)', () => {
  it('signs out only after confirming, then goes to the login page', async () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(logout).not.toHaveBeenCalled();
    expect(screen.getByText('Are you sure you want to sign out?')).toBeInTheDocument();

    const confirm = screen.getAllByRole('button', { name: /sign out/i }).find(b => b.closest('.fixed'));
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/login'));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('cancelling keeps the collector signed in', () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(logout).not.toHaveBeenCalled();
    expect(screen.queryByText('Are you sure you want to sign out?')).not.toBeInTheDocument();
  });
});
