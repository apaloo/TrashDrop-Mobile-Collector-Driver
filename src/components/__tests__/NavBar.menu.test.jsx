import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { TopNavBar } from '../NavBar';

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ profile: { first_name: 'Jack', last_name: 'Bhone' }, logout: jest.fn() }),
}));

jest.mock('../../utils/logger', () => ({ logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;
const onPageButton = jest.fn();

const renderAt = () => render(
  <MemoryRouter initialEntries={['/map']}>
      <TopNavBar user={{ id: 'u1' }} />
      {/* stands in for the Map's On-/Off-Duty button under the menu */}
      <button type="button" onClick={onPageButton}>Off-Duty</button>
      <Routes><Route path="*" element={<Where />} /></Routes>
  </MemoryRouter>
);

const openMenu = () => fireEvent.click(screen.getByText('JB').closest('button'));

beforeEach(() => onPageButton.mockClear());

describe('Header menu', () => {
  it('Earnings goes to the Earnings page', () => {
    renderAt();
    openMenu();
    fireEvent.click(screen.getByText('Earnings'));
    expect(screen.getByTestId('where')).toHaveTextContent('/earnings');
  });

  it('a touch outside the menu does not close it early (the tap\'s click must not fall through)', () => {
    renderAt();
    openMenu();
    fireEvent.touchStart(document.body);
    fireEvent.mouseDown(document.body);
    expect(screen.getByText('Earnings')).toBeInTheDocument();
  });

  it('a tap outside lands on the backdrop and only closes the menu', () => {
    renderAt();
    openMenu();
    fireEvent.click(screen.getByTestId('nav-menu-backdrop'));
    expect(screen.queryByText('Earnings')).not.toBeInTheDocument();
    expect(onPageButton).not.toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent('/map');
  });

  it('Escape closes the menu', () => {
    renderAt();
    openMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Earnings')).not.toBeInTheDocument();
  });

  it('no backdrop while the menu is closed', () => {
    renderAt();
    expect(screen.queryByTestId('nav-menu-backdrop')).not.toBeInTheDocument();
  });
});
