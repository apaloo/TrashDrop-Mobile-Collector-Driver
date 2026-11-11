import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import OfflineIndicator from '../OfflineIndicator';
import { OfflineContext } from '../../contexts/OfflineContext';

const renderWith = (value) =>
  render(
    <OfflineContext.Provider value={value}>
      <OfflineIndicator />
    </OfflineContext.Provider>
  );

describe('OfflineIndicator', () => {
  it('shows nothing when online with nothing to sync', () => {
    const { container } = renderWith({ online: true, offlineQueue: [], syncing: false, syncOfflineActions: jest.fn() });
    expect(container).toBeEmptyDOMElement();
  });

  it('Sync Now starts the sync (it used to call the hook inside the click handler and throw)', () => {
    const syncOfflineActions = jest.fn();
    renderWith({ online: true, offlineQueue: [{ id: 1 }, { id: 2 }], syncing: false, syncOfflineActions });

    expect(screen.getByText('2 pending actions to sync')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sync Now' }));
    expect(syncOfflineActions).toHaveBeenCalledTimes(1);
  });
});
