import { useState, useEffect, useCallback, useRef } from 'react';
import ImageManager from '../utils/imageManager';
import { logger } from '../utils/logger';

/**
 * Custom hook for managing photo capture state and operations
 * @param {string} requestId - The ID of the request/assignment
 * @returns {Object} Photo capture state and methods
 */
const usePhotoCapture = (requestId) => {
  const [photos, setPhotos] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const isMounted = useRef(true);

  // Load saved photos for this request
  useEffect(() => {
    if (!requestId) return;
    
    const loadPhotos = async () => {
      try {
        const savedPhotos = await ImageManager.getCapturedPhotos(requestId);
        if (isMounted.current) {
          setPhotos(savedPhotos);
          setIsInitialized(true);
          
          if (process.env.NODE_ENV === 'development') {
            logger.debug(`📸 Loaded ${savedPhotos.length} saved photos for request ${requestId}`);
          }
        }
      } catch (err) {
        logger.error('Error loading photos:', err);
        if (isMounted.current) {
          setError('Failed to load saved photos');
        }
      }
    };
    
    loadPhotos();
    
    return () => {
      isMounted.current = false;
    };
  }, [requestId]);

  /**
   * Captures a photo from a file input or camera
   * @param {File} file - The image file to capture
   * @returns {Promise<Object>} The captured photo data
   */
  const capturePhoto = useCallback(async (file) => {
    if (!file) {
      throw new Error('No file provided');
    }

    try {
      if (!requestId) {
        throw new Error('No request ID provided');
      }

      // Create a blob URL for the image
      const url = URL.createObjectURL(file);
      
      const photoData = {
        id: `photo_${Date.now()}`,
        url,
        file,
        timestamp: new Date().toISOString(),
        fileSize: file.size,
        type: file.type
      };

      // Save to session storage
      const updatedPhotos = [...photos, photoData];
      await ImageManager.saveCapturedPhotos(requestId, updatedPhotos);
      
      // Update local state
      setPhotos(updatedPhotos);
      
      if (process.env.NODE_ENV === 'development') {
        logger.debug('📸 Captured photo:', { id: photoData.id, requestId });
      }
      
      return photoData;
    } catch (err) {
      logger.error('Error capturing photo:', err);
      setError('Failed to capture photo');
      throw err;
    }
  }, [photos, requestId]);

  /**
   * Removes a photo by ID
   * @param {string} photoId - ID of the photo to remove
   */
  const removePhoto = useCallback(async (photoId) => {
    try {
      if (!requestId) {
        throw new Error('No request ID provided');
      }

      const updatedPhotos = photos.filter(photo => photo.id !== photoId);
      await ImageManager.saveCapturedPhotos(requestId, updatedPhotos);
      
      // Revoke the blob URL to free memory
      const photoToRemove = photos.find(p => p.id === photoId);
      if (photoToRemove && photoToRemove.url) {
        URL.revokeObjectURL(photoToRemove.url);
      }
      
      setPhotos(updatedPhotos);
      
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`🗑️ Removed photo ${photoId} from request ${requestId}`);
      }
    } catch (err) {
      logger.error('Error removing photo:', err);
      setError('Failed to remove photo');
      throw err;
    }
  }, [photos, requestId]);

  /**
   * Clears all captured photos for the current request
   */
  const clearPhotos = useCallback(async () => {
    try {
      if (!requestId) return;
      
      // Revoke all blob URLs
      photos.forEach(photo => {
        if (photo.url) {
          URL.revokeObjectURL(photo.url);
        }
      });
      
      // Clear from storage
      await ImageManager.clearAllImages(requestId);
      
      // Update local state
      setPhotos([]);
      setError(null);
      
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`🧹 Cleared all photos for request ${requestId}`);
      }
    } catch (err) {
      logger.error('Error clearing photos:', err);
      setError('Failed to clear photos');
      throw err;
    }
  }, [photos, requestId]);

  /**
   * Gets the current photo count
   * @returns {number} Number of photos captured
   */
  const getPhotoCount = useCallback(() => photos.length, [photos.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      
      // Note: We don't clear photos here to maintain them during navigation
      // The ImageManager will handle cleanup when the session ends or explicitly cleared
    };
  }, []);

  return {
    photos,
    isInitialized,
    error,
    capturePhoto,
    removePhoto,
    clearPhotos,
    getPhotoCount,
    hasPhotos: photos.length > 0
  };
};

export default usePhotoCapture;
