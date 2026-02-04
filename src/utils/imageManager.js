import { logger } from './logger';

const STORAGE_PREFIX = 'trashdrop_photos_';
const EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

const IMAGE_KEYS = {
  CAPTURED_PHOTOS: 'capturedPhotos',
  ASSIGNMENT_ID: 'currentAssignmentId'
};

class ImageManager {
  /**
   * Clears all image-related data for a specific request
   * @param {string} requestId - The ID of the request to clear images for
   */
  static clearAllImages(requestId) {
    if (!requestId) {
      logger.warn('No requestId provided to clearAllImages');
      return;
    }
    
    const storageKey = `${STORAGE_PREFIX}${requestId}`;
    const data = sessionStorage.getItem(storageKey);
    
    if (data) {
      try {
        const parsed = JSON.parse(data);
        this.revokeBlobURLs(parsed.photos || []);
      } catch (error) {
        logger.error('Error revoking blob URLs during cleanup:', error);
      }
      
      sessionStorage.removeItem(storageKey);
      
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`ℹ️ Cleared image data for request ${requestId}`);
      }
    }
  }
  
  /**
   * Clears all image data for all requests
   */
  static clearAll() {
    // Clear all entries with the storage prefix
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        try {
          const data = JSON.parse(sessionStorage.getItem(key));
          if (data?.photos) {
            this.revokeBlobURLs(data.photos);
          }
        } catch (error) {
          logger.error(`Error cleaning up ${key}:`, error);
        }
        sessionStorage.removeItem(key);
      }
    });
    
    // Clear legacy storage
    sessionStorage.removeItem(IMAGE_KEYS.CAPTURED_PHOTOS);
    sessionStorage.removeItem(IMAGE_KEYS.ASSIGNMENT_ID);
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug('ℹ️ Cleared all image data from session storage');
    }
  }

  /**
   * Revokes blob URLs to prevent memory leaks
   * @param {Array} photos - Array of photo objects with URL property
   */
  static revokeBlobURLs(photos = []) {
    photos.forEach(photo => {
      if (photo?.url?.startsWith?.('blob:')) {
        try {
          URL.revokeObjectURL(photo.url);
          if (process.env.NODE_ENV === 'development') {
            logger.debug('ℹ️ Revoked blob URL:', photo.url.substring(0, 25) + '...');
          }
        } catch (error) {
          logger.warn('Failed to revoke blob URL:', error);
        }
      }
    });
  }

  /**
   * Sets the current assignment context
   * @param {string} assignmentId - Unique identifier for the current assignment
   */
  static setCurrentAssignment(assignmentId) {
    if (!assignmentId) return;
    
    const currentAssignment = sessionStorage.getItem(IMAGE_KEYS.ASSIGNMENT_ID);
    
    // Clear previous assignment's images if starting a new assignment
    if (currentAssignment && currentAssignment !== assignmentId) {
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`🔄 New assignment detected (${assignmentId}), clearing previous assignment data`);
      }
      this.clearAllImages();
    }
    
    sessionStorage.setItem(IMAGE_KEYS.ASSIGNMENT_ID, assignmentId);
  }

  /**
   * Gets all captured photos for a specific request
   * Filters out invalid blob URLs that may have become stale after page refresh
   * @param {string} requestId - The ID of the request to get photos for
   * @returns {Array} Array of captured photos with valid URLs
   */
  static getCapturedPhotos(requestId) {
    if (!requestId) {
      logger.warn('No requestId provided to getCapturedPhotos');
      return [];
    }
    
    const storageKey = `${STORAGE_PREFIX}${requestId}`;
    const data = sessionStorage.getItem(storageKey);
    
    if (!data) return [];
    
    try {
      const parsed = JSON.parse(data);
      // Check if data is expired (older than 24 hours)
      if (Date.now() - parsed.timestamp > EXPIRATION_MS) {
        sessionStorage.removeItem(storageKey);
        return [];
      }
      
      const photos = parsed.photos || [];
      
      // Filter out photos with blob URLs - these become invalid after page refresh
      // Blob URLs are created with URL.createObjectURL() and are tied to the current
      // browser session. After a page refresh, they no longer point to valid data.
      const validPhotos = photos.filter(photo => {
        // If URL starts with 'blob:', it's invalid after page refresh
        if (photo?.url?.startsWith?.('blob:')) {
          logger.debug(`🗑️ Filtering out stale blob URL for photo ${photo.id}`);
          return false;
        }
        // Keep photos with valid URLs (base64, http/https, or other valid sources)
        return photo?.url;
      });
      
      // If we filtered out any photos, update storage to remove the stale entries
      if (validPhotos.length !== photos.length) {
        if (validPhotos.length > 0) {
          this.saveCapturedPhotos(requestId, validPhotos);
        } else {
          // No valid photos left, remove the storage entry entirely
          sessionStorage.removeItem(storageKey);
        }
        logger.debug(`🧹 Cleaned up ${photos.length - validPhotos.length} stale blob URLs for request ${requestId}`);
      }
      
      return validPhotos;
    } catch (error) {
      logger.error('Error parsing captured photos:', error);
      return [];
    }
  }

  /**
   * Gets all captured photos from all requests (for cleanup purposes)
   * @returns {Array} Array of all photo objects across all requests
   */
  static getAllCapturedPhotos() {
    const allPhotos = [];
    
    // Iterate through all sessionStorage keys to find photo data
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        try {
          const data = sessionStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            if (parsed.photos && Array.isArray(parsed.photos)) {
              allPhotos.push(...parsed.photos);
            }
          }
        } catch (error) {
          logger.warn(`Error parsing photo data for key ${key}:`, error);
        }
      }
    }
    
    return allPhotos;
  }

  /**
   * Saves captured photos to session storage for a specific request
   * @param {string} requestId - The ID of the request these photos belong to
   * @param {Array} photos - Array of photo objects to save
   * @param {string} photos[].id - Unique identifier for the photo
   * @param {string} photos[].url - Blob URL of the photo
   */
  static saveCapturedPhotos(requestId, photos) {
    if (!requestId || !Array.isArray(photos)) {
      logger.warn('Invalid parameters provided to saveCapturedPhotos');
      return;
    }

    const storageKey = `${STORAGE_PREFIX}${requestId}`;
    const timestamp = Date.now();
    
    try {
      const data = {
        requestId,
        photos: photos.map(photo => ({
          id: photo.id || Date.now().toString(),
          url: photo.url,
          timestamp: photo.timestamp || timestamp
        })),
        timestamp
      };
      
      sessionStorage.setItem(storageKey, JSON.stringify(data));
      
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`💾 Saved ${photos.length} photos for request ${requestId}`);
      }
    } catch (error) {
      logger.error('Failed to save photos to session storage:', error);
      if (error.name === 'QuotaExceededError') {
        logger.warn('Storage quota exceeded, cleaning up old entries');
        this.cleanup();
        // Try again after cleanup
        this.saveCapturedPhotos(requestId, photos);
      }
    }
  }
  
  /**
   * Saves a single captured photo to session storage
   * @param {Object} photoData - Photo data to save
   * @param {string} photoData.url - Blob URL of the photo
   * @param {string} [photoData.id] - Unique identifier for the photo
   * @param {string} [photoData.timestamp] - When the photo was taken
   */
  static saveCapturedPhoto(photoData) {
    logger.warn('saveCapturedPhoto is deprecated. Use saveCapturedPhotos instead.');
    if (!photoData?.url) {
      logger.warn('Invalid photo data provided');
      return;
    }
    
    const currentAssignment = sessionStorage.getItem(IMAGE_KEYS.ASSIGNMENT_ID);
    if (!currentAssignment) {
      logger.warn('No current assignment set. Call setCurrentAssignment first.');
      return;
    }
    
    const photos = this.getCapturedPhotos(currentAssignment);
    photos.push({
      id: photoData.id || Date.now().toString(),
      url: photoData.url,
      timestamp: photoData.timestamp || new Date().toISOString(),
      ...photoData
    });
    
    this.saveCapturedPhotos(currentAssignment, photos);
  }

  /**
   * Removes a specific photo by ID
   * @param {string} photoId - ID of the photo to remove
   */
  static removePhoto(photoId) {
    const currentAssignment = sessionStorage.getItem(IMAGE_KEYS.ASSIGNMENT_ID);
    if (!currentAssignment) {
      logger.warn('No current assignment set. Call setCurrentAssignment first.');
      return;
    }
    
    const photos = this.getCapturedPhotos(currentAssignment);
    const photoIndex = photos.findIndex(p => p.id === photoId);
    
    if (photoIndex !== -1) {
      const [removedPhoto] = photos.splice(photoIndex, 1);
      this.revokeBlobURLs([removedPhoto]);
      
      // Update the photos in storage
      this.saveCapturedPhotos(currentAssignment, photos);
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`🗑️ Removed photo ${photoId}`);
      }
    }
  }

  /**
   * Cleans up expired resources
   */
  static cleanup() {
    const now = Date.now();
    let cleanedCount = 0;
    
    // Check all storage keys
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        try {
          const data = JSON.parse(sessionStorage.getItem(key));
          // Check if data is expired (older than 24 hours)
          if (now - data.timestamp > EXPIRATION_MS) {
            // Revoke blob URLs before removing
            this.revokeBlobURLs(data.photos || []);
            sessionStorage.removeItem(key);
            cleanedCount++;
          }
        } catch (error) {
          logger.error(`Error cleaning up ${key}:`, error);
          // If we can't parse it, remove it anyway
          sessionStorage.removeItem(key);
          cleanedCount++;
        }
      }
    });
    
    if (process.env.NODE_ENV === 'development' && cleanedCount > 0) {
      logger.debug(`🧹 Cleaned up ${cleanedCount} expired image entries`);
    }
    
    return cleanedCount;
  }
}

// Set up cleanup on page unload and visibility change
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    ImageManager.cleanup();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      ImageManager.cleanup();
    }
  });
}

export default ImageManager;
