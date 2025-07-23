import { renderHook, act, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import usePhotoCapture from '../usePhotoCapture';
import ImageManager from '../../utils/imageManager';

// Mock the File constructor
class MockFile extends File {
  constructor(parts, name, properties) {
    super(parts, name, properties);
    this.preview = URL.createObjectURL(this);
  }
}

// Mock URL.createObjectURL and URL.revokeObjectURL
const createObjectURL = jest.fn().mockImplementation(() => 'blob:test-url');
const revokeObjectURL = jest.fn();

global.URL.createObjectURL = createObjectURL;
global.URL.revokeObjectURL = revokeObjectURL;
global.File = MockFile;

// Mock the ImageManager
jest.mock('../../utils/imageManager', () => ({
  getCapturedPhotos: jest.fn(),
  saveCapturedPhotos: jest.fn(),
  clearAllImages: jest.fn()
}));

// Mock the useRef hook
jest.mock('react', () => {
  const original = jest.requireActual('react');
  return {
    ...original,
    useRef: jest.fn(original.useRef)
  };
});

describe('usePhotoCapture', () => {
  const requestId = 'test-request-123';
  let mockPhoto;
  
  // Setup before all tests
  beforeAll(() => {
    // Mock the File object
    mockPhoto = {
      id: 'photo-123',
      url: 'blob:test-url',
      file: new File(['test'], 'test.jpg', { type: 'image/jpeg' }),
      timestamp: new Date().toISOString(),
    };
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Reset URL mocks
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    
    // Mock the ImageManager methods
    ImageManager.getCapturedPhotos.mockResolvedValue([]);
    ImageManager.saveCapturedPhotos.mockResolvedValue(true);
    ImageManager.clearAllImages.mockResolvedValue(true);
    
    // Mock useRef for file input
    useRef.mockImplementation(() => ({
      current: {
        click: jest.fn(),
        value: '',
      },
    }));
  });

  it('should initialize with empty photos array', async () => {
    // Mock empty photos from storage
    ImageManager.getCapturedPhotos.mockResolvedValueOnce([]);
    
    const { result } = renderHook(() => usePhotoCapture(requestId));
    
    // Initial state before async operations
    expect(result.current.photos).toEqual([]);
    expect(result.current.isInitialized).toBe(false);
    
    // Wait for the hook to initialize and verify the expected state
    await waitFor(() => {
      expect(ImageManager.getCapturedPhotos).toHaveBeenCalledWith(requestId);
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.photos).toEqual([]);
    });
  });

  it('should capture a photo', async () => {
    // Mock empty photos from storage initially
    ImageManager.getCapturedPhotos.mockResolvedValueOnce([]);
    
    const { result } = renderHook(() => usePhotoCapture(requestId));
    
    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });
    
    // Mock successful save
    ImageManager.saveCapturedPhotos.mockResolvedValueOnce(true);
    
    // Capture photo
    await act(async () => {
      await result.current.capturePhoto(mockPhoto.file);
    });
    
    // Verify the photo was saved with the correct data
    await waitFor(() => {
      expect(ImageManager.saveCapturedPhotos).toHaveBeenCalledWith(
        requestId,
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            url: expect.any(String),
            file: mockPhoto.file,
            timestamp: expect.any(String),
          })
        ])
      );
      
      // Verify the photo was added to the state
      expect(result.current.photos.length).toBe(1);
      expect(result.current.photos[0].file).toBe(mockPhoto.file);
      expect(createObjectURL).toHaveBeenCalledWith(mockPhoto.file);
    });
  });

  it('should remove a photo', async () => {
    // Mock initial photos from storage
    ImageManager.getCapturedPhotos.mockResolvedValueOnce([mockPhoto]);
    
    const { result } = renderHook(() => usePhotoCapture(requestId));
    
    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.photos.length).toBe(1);
    });
    
    // Mock successful save after removal
    ImageManager.saveCapturedPhotos.mockResolvedValueOnce(true);
    
    // Remove the photo
    await act(async () => {
      await result.current.removePhoto(mockPhoto.id);
    });
    
    // Wait for the photo to be removed
    await waitFor(() => {
      // Verify the photo was removed from storage
      expect(ImageManager.saveCapturedPhotos).toHaveBeenCalledWith(requestId, []);
      
      // Verify the photo was removed from state
      expect(result.current.photos.length).toBe(0);
      
      // Verify the blob URL was revoked
      expect(revokeObjectURL).toHaveBeenCalledWith(mockPhoto.url);
    });
  });

  it('should clear all photos', async () => {
    // Mock initial photos from storage
    ImageManager.getCapturedPhotos.mockResolvedValueOnce([mockPhoto]);
    
    const { result } = renderHook(() => usePhotoCapture(requestId));
    
    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.photos.length).toBe(1);
    });
    
    // Mock successful clear
    ImageManager.clearAllImages.mockResolvedValueOnce(true);
    
    // Clear all photos
    await act(async () => {
      await result.current.clearPhotos();
    });
    
    // Wait for the photos to be cleared
    await waitFor(() => {
      // Verify all photos were cleared from storage
      expect(ImageManager.clearAllImages).toHaveBeenCalledWith(requestId);
      
      // Verify the state was updated
      expect(result.current.photos.length).toBe(0);
      
      // Verify the blob URL was revoked
      expect(revokeObjectURL).toHaveBeenCalledWith(mockPhoto.url);
    });
  });

  it('should handle errors when capturing photos', async () => {
    // Mock empty photos from storage initially
    ImageManager.getCapturedPhotos.mockResolvedValueOnce([]);
    
    const { result } = renderHook(() => usePhotoCapture(requestId));
    
    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });
    
    // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock a failure when saving
    const error = new Error('Failed to save photos');
    ImageManager.saveCapturedPhotos.mockRejectedValueOnce(error);
    
    // Try to capture a photo - this should throw an error
    let captureError;
    await act(async () => {
      try {
        await result.current.capturePhoto(mockPhoto.file);
      } catch (err) {
        captureError = err;
      }
    });
    
    // Verify the error was thrown
    expect(captureError).toBeDefined();
    expect(captureError.message).toBe('Failed to save photos');
    
    // Wait for the error to be logged
    await waitFor(() => {
      // Verify the error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error capturing photo:', error);
      
      // The photo should not be added to the state on error
      expect(result.current.photos.length).toBe(0);
    });
    
    // Clean up the spy
    consoleErrorSpy.mockRestore();
  });

  it('should revoke object URLs when removing photos', async () => {
    // Mock initial photos from storage
    ImageManager.getCapturedPhotos.mockResolvedValueOnce([mockPhoto]);
    
    // Clear any previous mock calls
    revokeObjectURL.mockClear();
    
    const { result } = renderHook(() => usePhotoCapture(requestId));
    
    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.photos.length).toBe(1);
    });
    
    // Mock successful save after removal
    ImageManager.saveCapturedPhotos.mockResolvedValueOnce(true);
    
    // Remove the photo
    await act(async () => {
      await result.current.removePhoto(mockPhoto.id);
    });
    
    // Wait for the photo to be removed
    await waitFor(() => {
      // Verify the blob URL was revoked
      expect(revokeObjectURL).toHaveBeenCalledWith(mockPhoto.url);
      
      // Verify the photo was removed from state
      expect(result.current.photos.length).toBe(0);
    });
  });

  it('should handle cleanup on unmount', async () => {
    // Mock empty photos from storage initially
    ImageManager.getCapturedPhotos.mockResolvedValueOnce([]);
    
    const { result, unmount } = renderHook(() => usePhotoCapture(requestId));
    
    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });
    
    // Mock successful save
    ImageManager.saveCapturedPhotos.mockResolvedValueOnce(true);
    
    // Capture a photo
    await act(async () => {
      await result.current.capturePhoto(mockPhoto.file);
    });
    
    // Wait for the photo to be captured
    await waitFor(() => {
      // Verify we have one photo
      expect(result.current.photos.length).toBe(1);
    });
    
    // Clear any previous mock calls
    ImageManager.clearAllImages.mockClear();
    revokeObjectURL.mockClear();
    
    // Unmount the component
    unmount();
    
    // The photos should still be in the state (they'll be cleaned up by the page unload handler)
    expect(ImageManager.clearAllImages).not.toHaveBeenCalled();
    
    // The blob URLs should not be revoked yet (they'll be cleaned up by the page unload handler)
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('should handle multiple requests independently', async () => {
    const requestId1 = 'request-1';
    const requestId2 = 'request-2';
    
    // Mock different initial states for each request
    ImageManager.getCapturedPhotos.mockImplementation((id) => {
      return id === requestId1 
        ? Promise.resolve([{ ...mockPhoto, id: 'photo-1' }])
        : Promise.resolve([]);
    });
    
    // Render first hook with requestId1
    const { result: result1 } = renderHook(() => usePhotoCapture(requestId1));
    
    // Wait for first hook to initialize
    await waitFor(() => {
      expect(result1.current.isInitialized).toBe(true);
      expect(result1.current.photos.length).toBe(1);
      expect(result1.current.photos[0].id).toBe('photo-1');
    });
    
    // Render second hook with requestId2
    const { result: result2 } = renderHook(() => usePhotoCapture(requestId2));
    
    // Wait for second hook to initialize
    await waitFor(() => {
      expect(result2.current.isInitialized).toBe(true);
      expect(result2.current.photos.length).toBe(0);
    });
    
    // Capture a new photo for the second request
    const newPhoto = new File(['test2'], 'test2.jpg', { type: 'image/jpeg' });
    
    // Mock the save operation for the second request
    ImageManager.saveCapturedPhotos.mockResolvedValueOnce(true);
    
    // Capture photo in the second hook
    await act(async () => {
      await result2.current.capturePhoto(newPhoto);
    });
    
    // Wait for the photo to be captured in the second hook
    await waitFor(() => {
      // Verify each request maintains its own state
      expect(result1.current.photos.length).toBe(1);
      expect(result2.current.photos.length).toBe(1);
      
      // Verify the correct request ID was used for saving
      expect(ImageManager.saveCapturedPhotos).toHaveBeenLastCalledWith(
        requestId2,
        expect.arrayContaining([
          expect.objectContaining({
            file: newPhoto,
          })
        ])
      );
    });
    
    // Clear photos for the first request
    ImageManager.clearAllImages.mockResolvedValueOnce(true);
    await act(async () => {
      await result1.current.clearPhotos();
    });
    
    // Wait for the first request's photos to be cleared
    await waitFor(() => {
      // Verify only the first request's photos were cleared
      expect(ImageManager.clearAllImages).toHaveBeenCalledWith(requestId1);
      expect(result1.current.photos.length).toBe(0);
      
      // Second request's photos should remain unchanged
      expect(result2.current.photos.length).toBe(1);
    });
    
    // Clean up second request
    ImageManager.clearAllImages.mockResolvedValueOnce(true);
    await act(async () => {
      await result2.current.clearPhotos();
    });
    
    // Verify both requests are now empty
    await waitFor(() => {
      expect(result1.current.photos.length).toBe(0);
      expect(result2.current.photos.length).toBe(0);
    });
  });
});
