import { useState, useEffect, useCallback, useRef } from 'react';
import ImageManager from '../utils/imageManager';
import { logger } from '../utils/logger';
import { authService } from '../services/supabase';

/**
 * Custom hook for managing photo capture state and operations
 * @param {string} requestId - The ID of the request/assignment
 * @returns {Object} Photo capture state and methods
 */
const usePhotoCapture = (requestId) => {
  const [photos, setPhotos] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
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
   * Uploads to Supabase Storage for web-accessible permanent URLs
   * @param {File} file - The image file to capture
   * @returns {Promise<Object>} The captured photo data with permanent URL
   */
  const capturePhoto = useCallback(async (file) => {
    if (!file) {
      throw new Error('No file provided');
    }

    try {
      if (!requestId) {
        throw new Error('No request ID provided');
      }

      setIsUploading(true);
      setError(null);

      // Create a temporary blob URL for immediate preview
      const tempUrl = URL.createObjectURL(file);
      const photoId = `photo_${Date.now()}`;
      
      // Create initial photo data with temp URL for instant feedback
      const tempPhotoData = {
        id: photoId,
        url: tempUrl,
        isUploading: true,
        timestamp: new Date().toISOString(),
        fileSize: file.size,
        type: file.type
      };

      // Add temp photo immediately for instant preview
      const tempPhotos = [...photos, tempPhotoData];
      setPhotos(tempPhotos);

      // Upload to Supabase Storage for permanent web URL
      logger.debug('📤 Uploading photo to cloud storage...');
      const uploadResult = await authService.uploadPhoto(file, `assignment_${requestId}`);
      
      if (!uploadResult.success) {
        // Upload failed - remove temp photo and show error
        setPhotos(photos); // Revert to original photos
        URL.revokeObjectURL(tempUrl);
        throw new Error(uploadResult.error || 'Failed to upload photo');
      }

      // Replace temp URL with permanent cloud URL
      const photoData = {
        id: photoId,
        url: uploadResult.url, // Permanent web-accessible URL
        cloudUrl: uploadResult.url,
        isUploading: false,
        timestamp: new Date().toISOString(),
        fileSize: file.size,
        type: file.type
      };

      // Revoke temp blob URL to free memory
      URL.revokeObjectURL(tempUrl);

      // Update photos with permanent URL
      const updatedPhotos = photos.map(p => p.id === photoId ? photoData : p);
      if (!updatedPhotos.find(p => p.id === photoId)) {
        updatedPhotos.push(photoData);
      }
      
      // Save to session storage with permanent URL
      await ImageManager.saveCapturedPhotos(requestId, updatedPhotos);
      
      // Update local state
      setPhotos(updatedPhotos);
      
      logger.info('✅ Photo uploaded successfully:', uploadResult.url);
      
      return photoData;
    } catch (err) {
      logger.error('Error capturing/uploading photo:', err);
      setError(err.message || 'Failed to capture photo');
      throw err;
    } finally {
      setIsUploading(false);
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
    isUploading,
    error,
    capturePhoto,
    removePhoto,
    clearPhotos,
    getPhotoCount,
    hasPhotos: photos.length > 0
  };
};

export default usePhotoCapture;
