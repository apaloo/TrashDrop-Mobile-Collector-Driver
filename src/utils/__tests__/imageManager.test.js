import ImageManager from '../imageManager';

describe('ImageManager', () => {
  const mockRequestId = 'test-request-123';
  const mockPhotos = [
    { id: '1', url: 'blob:http://localhost/123' },
    { id: '2', url: 'blob:http://localhost/456' },
  ];

  beforeEach(() => {
    // Clear sessionStorage and reset mocks before each test
    sessionStorage.clear();
    jest.clearAllMocks();
    
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = jest.fn((blob) => `blob:${blob}`);
    global.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    // Clean up any remaining mocks or spies
    jest.restoreAllMocks();
  });

  describe('saveCapturedPhotos', () => {
    test('should save photos to sessionStorage', () => {
      ImageManager.saveCapturedPhotos(mockRequestId, mockPhotos);
      
      const savedData = JSON.parse(sessionStorage.getItem(`trashdrop_photos_${mockRequestId}`));
      
      // Check the structure matches what we expect
      expect(savedData).toMatchObject({
        requestId: mockRequestId,
        photos: expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            url: 'blob:http://localhost/123'
          }),
          expect.objectContaining({
            id: '2',
            url: 'blob:http://localhost/456'
          })
        ]),
        timestamp: expect.any(Number)
      });
      
      // Verify timestamps were added to each photo
      savedData.photos.forEach(photo => {
        expect(photo).toHaveProperty('timestamp', savedData.timestamp);
      });
    });

    test('should update existing photos for the same request', () => {
      const initialPhotos = [{ id: 'old', url: 'blob:http://localhost/old1' }];
      const initialTimestamp = Date.now() - 1000; // Ensure initial timestamp is in the past
      
      // Mock Date.now() to ensure our new timestamp is different
      const realDateNow = Date.now.bind(global.Date);
      global.Date.now = jest.fn(() => realDateNow() + 2000);
      
      sessionStorage.setItem(
        `trashdrop_photos_${mockRequestId}`, 
        JSON.stringify({
          requestId: mockRequestId,
          photos: initialPhotos,
          timestamp: initialTimestamp
        })
      );

      ImageManager.saveCapturedPhotos(mockRequestId, mockPhotos);
      
      const savedData = JSON.parse(sessionStorage.getItem(`trashdrop_photos_${mockRequestId}`));
      
      // Should have the new photos, not the old ones
      expect(savedData.photos).toHaveLength(2);
      expect(savedData.photos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: '1',
            url: 'blob:http://localhost/123'
          }),
          expect.objectContaining({
            id: '2',
            url: 'blob:http://localhost/456'
          })
        ])
      );
      
      // Timestamp should be updated and greater than the initial timestamp
      expect(savedData.timestamp).toBeGreaterThan(initialTimestamp);
      
      // Restore original Date.now
      global.Date.now = realDateNow;
    });
  });

  describe('getCapturedPhotos', () => {
    it('should return empty array if no photos exist', () => {
      const photos = ImageManager.getCapturedPhotos(mockRequestId);
      expect(photos).toEqual([]);
    });

    it('should return saved photos for the request', () => {
      sessionStorage.setItem(
        `trashdrop_photos_${mockRequestId}`, 
        JSON.stringify({
          requestId: mockRequestId,
          photos: mockPhotos,
          timestamp: Date.now()
        })
      );

      const photos = ImageManager.getCapturedPhotos(mockRequestId);
      expect(photos).toEqual(mockPhotos);
    });

    it('should return empty array for expired data', () => {
      const oneDayAgo = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      
      sessionStorage.setItem(
        `trashdrop_photos_${mockRequestId}`, 
        JSON.stringify({
          requestId: mockRequestId,
          photos: mockPhotos,
          timestamp: oneDayAgo
        })
      );

      const photos = ImageManager.getCapturedPhotos(mockRequestId);
      expect(photos).toEqual([]);
      // Should clean up expired data
      expect(sessionStorage.getItem(`trashdrop_photos_${mockRequestId}`)).toBeNull();
    });
  });

  describe('clearAllImages', () => {
    it('should clear all images for the request', () => {
      // Set up test data
      sessionStorage.setItem(
        `trashdrop_photos_${mockRequestId}`, 
        JSON.stringify({
          requestId: mockRequestId,
          photos: mockPhotos,
          timestamp: Date.now()
        })
      );

      ImageManager.clearAllImages(mockRequestId);
      
      // Should be removed from sessionStorage
      expect(sessionStorage.getItem(`trashdrop_photos_${mockRequestId}`)).toBeNull();
    });

    it('should not throw if no images exist', () => {
      expect(() => {
        ImageManager.clearAllImages('non-existent-request');
      }).not.toThrow();
    });
  });

  describe('revokeBlobURLs', () => {
    it('should revoke all blob URLs', () => {
      // Mock URL.revokeObjectURL
      const revokeSpy = jest.spyOn(URL, 'revokeObjectURL');
      
      ImageManager.revokeBlobURLs(mockPhotos);
      
      expect(revokeSpy).toHaveBeenCalledTimes(mockPhotos.length);
      mockPhotos.forEach(photo => {
        expect(revokeSpy).toHaveBeenCalledWith(photo.url);
      });
    });

    it('should handle empty array', () => {
      const revokeSpy = jest.spyOn(URL, 'revokeObjectURL');
      
      ImageManager.revokeBlobURLs([]);
      
      expect(revokeSpy).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should clean up expired entries', () => {
      const now = Date.now();
      const expiredTime = now - (25 * 60 * 60 * 1000); // 25 hours ago
      const validTime = now - (12 * 60 * 60 * 1000); // 12 hours ago
      
      // Set up test data
      const expiredKey = `trashdrop_photos_expired`;
      const validKey = `trashdrop_photos_valid`;
      
      sessionStorage.setItem(expiredKey, JSON.stringify({
        requestId: 'expired',
        photos: mockPhotos,
        timestamp: expiredTime
      }));
      
      sessionStorage.setItem(validKey, JSON.stringify({
        requestId: 'valid',
        photos: mockPhotos,
        timestamp: validTime
      }));

      // Mock sessionStorage.keys()
      Object.defineProperty(sessionStorage, 'key', {
        value: (index) => [expiredKey, validKey][index]
      });
      Object.defineProperty(sessionStorage, 'length', { value: 2 });

      // Spy on revokeBlobURLs
      const revokeSpy = jest.spyOn(ImageManager, 'revokeBlobURLs');
      
      // Call cleanup
      ImageManager.cleanup();
      
      // Should revoke URLs for expired entry
      expect(revokeSpy).toHaveBeenCalledWith(mockPhotos);
      
      // Expired entry should be removed
      expect(sessionStorage.getItem(expiredKey)).toBeNull();
      
      // Valid entry should remain
      expect(sessionStorage.getItem(validKey)).not.toBeNull();
    });
  });

  // Test the cleanup function directly instead of testing event listeners
  // This is more reliable than testing the event binding behavior
  describe('cleanup', () => {
    it('should clean up all expired entries', () => {
      // Create some test data with different timestamps
      const now = Date.now();
      const expiredTimestamp = now - (25 * 60 * 60 * 1000); // 25 hours ago
      const validTimestamp = now - (12 * 60 * 60 * 1000);    // 12 hours ago
      
      // Create test data
      const expiredData = {
        requestId: 'expired-request',
        photos: [{ id: '1', url: 'blob:expired1' }],
        timestamp: expiredTimestamp
      };
      
      const validData = {
        requestId: 'valid-request',
        photos: [{ id: '2', url: 'blob:valid1' }],
        timestamp: validTimestamp
      };
      
      // Save test data to sessionStorage
      sessionStorage.setItem(
        `trashdrop_photos_expired-request`,
        JSON.stringify(expiredData)
      );
      
      sessionStorage.setItem(
        `trashdrop_photos_valid-request`,
        JSON.stringify(validData)
      );
      
      // Mock URL.revokeObjectURL
      const revokeSpy = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      
      // Call cleanup
      const cleanedCount = ImageManager.cleanup();
      
      // Verify the expired entry was cleaned up
      expect(cleanedCount).toBe(1);
      expect(sessionStorage.getItem('trashdrop_photos_expired-request')).toBeNull();
      
      // Verify the valid entry still exists
      const remainingData = JSON.parse(sessionStorage.getItem('trashdrop_photos_valid-request'));
      expect(remainingData).toBeDefined();
      expect(remainingData.requestId).toBe('valid-request');
      
      // Verify URL.revokeObjectURL was called for the expired URL
      expect(revokeSpy).toHaveBeenCalledWith('blob:expired1');
      
      // Cleanup
      revokeSpy.mockRestore();
      sessionStorage.clear();
    });
    
    it('should handle errors during cleanup gracefully', () => {
      // Mock sessionStorage to throw an error
      const originalGetItem = sessionStorage.getItem;
      sessionStorage.getItem = jest.fn(() => {
        throw new Error('Storage error');
      });
      
      // This should not throw
      expect(() => ImageManager.cleanup()).not.toThrow();
      
      // Restore original
      sessionStorage.getItem = originalGetItem;
    });
  });
});
