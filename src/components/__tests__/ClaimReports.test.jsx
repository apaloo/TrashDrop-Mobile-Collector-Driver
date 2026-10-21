import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import ClaimReports from '../ClaimReports';
import RequireCollectorProfile from '../RequireCollectorProfile';
import { fetchMyAccess, listClaimableReports, claimReport } from '../../services/volunteerService';
import { useAuth } from '../../context/AuthContext';
import { PROFILE_STATE } from '../../utils/collectorProfile';

jest.mock('../../services/volunteerService', () => ({
  fetchMyAccess: jest.fn(), listClaimableReports: jest.fn(), claimReport: jest.fn(), requestVolunteerAccess: jest.fn(),
}));
jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../utils/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() } }));

const approved = { role: 'volunteer', status: 'approved', region: 'Greater Accra' };
const reports = [
  { id: 'r1', location: 'Madina market', district: 'La-Nkwantanang-Madina', region: 'Greater Accra', severity: 'high', waste_type: 'plastic', created_at: '2026-10-01' },
  { id: 'r2', location: 'Kaneshie', district: 'Ablekuma Central Municipal', region: 'Greater Accra', severity: 'low', created_at: '2026-10-02' },
];

beforeEach(() => jest.clearAllMocks());

describe('Claim tab', () => {
  it('tells a group waiting for approval, without listing reports', async () => {
    fetchMyAccess.mockResolvedValue({ role: 'user', status: 'pending' });
    render(<ClaimReports showToast={jest.fn()} />);
    expect(await screen.findByTestId('claim-pending')).toBeInTheDocument();
    expect(listClaimableReports).not.toHaveBeenCalled();
  });

  it('shows the rejection reason', async () => {
    fetchMyAccess.mockResolvedValue({ role: 'user', status: 'rejected', review_note: 'Could not reach the leader' });
    render(<ClaimReports showToast={jest.fn()} />);
    expect(await screen.findByTestId('claim-rejected')).toHaveTextContent('Could not reach the leader');
  });

  it('lets a group whose sign-up request was lost send it again', async () => {
    const { requestVolunteerAccess } = jest.requireMock('../../services/volunteerService');
    fetchMyAccess.mockResolvedValue({ role: 'user', status: 'approved', requested_role: 'user' });
    requestVolunteerAccess.mockResolvedValue();
    const showToast = jest.fn();
    render(<ClaimReports showToast={showToast} profile={{ first_name: 'Bus Stop Boys', region: 'Greater Accra' }} />);
    fireEvent.click(await screen.findByTestId('send-volunteer-request'));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Request sent to TrashDrop'));
    expect(requestVolunteerAccess).toHaveBeenCalledWith(expect.objectContaining({ groupName: 'Bus Stop Boys', region: 'Greater Accra' }));
  });

  it('lists the region and filters by district', async () => {
    fetchMyAccess.mockResolvedValue(approved);
    listClaimableReports.mockResolvedValue(reports);
    render(<ClaimReports showToast={jest.fn()} />);
    expect(await screen.findAllByTestId('claim-card')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('District'), { target: { value: 'La-Nkwantanang-Madina' } });
    expect(screen.getAllByTestId('claim-card')).toHaveLength(1);
    expect(screen.getByText('Madina market')).toBeInTheDocument();
  });

  it('shows report photos in the gallery and opens the full-screen viewer', async () => {
    fetchMyAccess.mockResolvedValue(approved);
    listClaimableReports.mockResolvedValue([
      { ...reports[0], photos: ['p1.jpg', 'p2.jpg', 'p3.jpg', 'p4.jpg'] },
      reports[1],
    ]);
    render(<ClaimReports showToast={jest.fn()} />);

    const [withPhotos, withoutPhotos] = await screen.findAllByTestId('claim-card');
    expect(withPhotos.querySelectorAll('button[aria-label^="Open photo"]')).toHaveLength(2);
    expect(withPhotos).toHaveTextContent('+1');
    expect(withoutPhotos.querySelector('img')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open photo 2 of 4' }));
    expect(screen.getByRole('dialog', { name: 'Photo 2 of 4' })).toHaveTextContent('2 / 4');
  });

  it('claims after a confirmation, then hands over to the Claimed list', async () => {
    fetchMyAccess.mockResolvedValue(approved);
    listClaimableReports.mockResolvedValue(reports);
    claimReport.mockResolvedValue({ id: 'r1' });
    const showToast = jest.fn();
    const onClaimed = jest.fn();
    render(<ClaimReports showToast={showToast} onClaimed={onClaimed} />);
    fireEvent.click((await screen.findAllByText('Claim this clean-up'))[0]);
    expect(claimReport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Yes, claim it'));
    await waitFor(() => expect(onClaimed).toHaveBeenCalled());
    expect(claimReport).toHaveBeenCalledWith('r1');
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/within 24 hours/));
  });

  it('shows the database reason when a claim is refused', async () => {
    fetchMyAccess.mockResolvedValue(approved);
    listClaimableReports.mockResolvedValue(reports);
    claimReport.mockRejectedValue({ message: 'Someone has already taken this report' });
    const showToast = jest.fn();
    render(<ClaimReports showToast={showToast} onClaimed={jest.fn()} />);
    fireEvent.click((await screen.findAllByText('Claim this clean-up'))[0]);
    fireEvent.click(screen.getByText('Yes, claim it'));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Someone has already taken this report', 'error'));
  });
});

describe('volunteer groups in the app', () => {
  const ShowLocation = () => <div data-testid="location">{useLocation().pathname}</div>;
  const renderAt = (path, profile) => {
    useAuth.mockReturnValue({
      isAuthenticated: true, hasLoggedOut: false, user: { id: 'u1' }, profile,
      profileState: PROFILE_STATE.READY, refreshProfile: jest.fn(), logout: jest.fn(),
    });
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {['/map', '/request', '/earnings', '/route-optimization', '/assign'].map(p => (
            <Route key={p} path={p} element={<RequireCollectorProfile><ShowLocation /></RequireCollectorProfile>} />
          ))}
        </Routes>
      </MemoryRouter>
    );
  };

  it.each(['/map', '/request', '/earnings', '/route-optimization'])('are sent from %s to /assign', (path) => {
    renderAt(path, { collector_type: 'volunteer' });
    expect(screen.getByTestId('location')).toHaveTextContent('/assign');
  });

  it('paid collectors stay where they are', () => {
    renderAt('/request', { collector_type: 'collector' });
    expect(screen.getByTestId('location')).toHaveTextContent('/request');
  });
});
