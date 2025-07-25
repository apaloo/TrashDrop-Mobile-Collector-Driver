import { supabase } from './supabase';
import { requestManager } from './requestManagement';

/**
 * Service for handling assignment-related operations
 */
export class AssignmentService {
  /**
   * Complete an assignment with photos and location verification
   * @param {string} assignmentId - The ID of the assignment to complete
   * @param {Array} photos - Array of photo data URLs
   * @param {Object} location - Object containing latitude and longitude
   * @param {string} notes - Optional notes about the completion
   * @returns {Promise<Object>} - The completed assignment data or error
   */
  static async completeAssignment(assignmentId, photos, location, notes = '') {
    try {
      // 1. First, verify the assignment exists and is assigned to the current user
      const { data: assignment, error: fetchError } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();

      if (fetchError) throw new Error('Assignment not found');
      if (assignment.status !== 'accepted') {
        throw new Error('This assignment is not in an acceptable state for completion');
      }

      // 2. Upload photos to storage
      const photoUrls = await this.uploadPhotos(assignmentId, photos);

      // 3. Update the assignment status to completed
      const { data: updatedAssignment, error: updateError } = await supabase
        .from('assignments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completion_photos: photoUrls,
          completion_location: `POINT(${location.lng} ${location.lat})`,
          notes: notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId)
        .select()
        .single();

      if (updateError) throw updateError;

      // 4. Release the request if it's still reserved
      if (assignment.request_id) {
        await requestManager.releaseRequest(assignment.request_id);
      }

      return { data: updatedAssignment };
    } catch (error) {
      console.error('Error completing assignment:', error);
      return { error: error.message || 'Failed to complete assignment' };
    }
  }

  /**
   * Upload photos to storage
   * @private
   */
  static async uploadPhotos(assignmentId, photos) {
    const uploadedUrls = [];
    
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const fileExt = photo.split(';')[0].split('/')[1] || 'jpg';
      const fileName = `${assignmentId}_${Date.now()}_${i}.${fileExt}`;
      const filePath = `assignment_photos/${fileName}`;

      // Convert base64 to blob
      const base64Data = photo.split(',')[1];
      const response = await fetch(photo);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('assignments')
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading photo:', uploadError);
        continue; // Skip this photo but continue with others
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('assignments')
        .getPublicUrl(filePath);

      uploadedUrls.push(publicUrl);
    }

    return uploadedUrls;
  }

  /**
   * Get assignment details by ID
   * @param {string} assignmentId - The ID of the assignment
   * @returns {Promise<Object>} - The assignment data or error
   */
  static async getAssignment(assignmentId) {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();

      if (error) throw error;
      return { data };
    } catch (error) {
      console.error('Error fetching assignment:', error);
      return { error: error.message || 'Failed to fetch assignment' };
    }
  }
}

export const assignmentService = new AssignmentService();
