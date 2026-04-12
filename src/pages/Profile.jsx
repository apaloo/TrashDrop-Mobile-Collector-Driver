import { useState, useEffect } from 'react';
import { TopNavBar } from '../components/NavBar';
import BottomNavBar from '../components/BottomNavBar';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { authService } from '../services/supabase';
import { logger } from '../utils/logger';
import { SUPPORTED_LANGUAGES } from '../config/languageConfig';

const ProfilePage = () => {
  const { user: authUser } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Real user profile data from Supabase
  const [user, setUser] = useState(null);
  
  // Fetch user profile from Supabase
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!authUser?.id) {
        logger.warn('⚠️ No authenticated user, cannot load profile');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        logger.debug('📥 Fetching profile for user:', authUser.id);
        
        const { success, profile, error: profileError } = await authService.getUserProfile(authUser.id);
        
        if (!success || !profile) {
          throw new Error(profileError || 'Failed to load profile');
        }
        
        // Transform profile data to match UI expectations
        const userData = {
          id: profile.user_id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          region: profile.region,
          id_type: profile.id_type,
          joined_date: profile.created_at || new Date().toISOString(),
          last_active: new Date().toISOString(),
          preferred_language: profile.preferred_language || language,
          vehicle: {
            type: profile.vehicle_type,
            license_plate: profile.license_plate,
            color: profile.vehicle_color,
            photo_url: profile.vehicle_photo_url
          },
          company: {
            name: profile.company_name,
            id: profile.company_id,
            role: profile.role
          }
        };
        
        setUser(userData);
        
        // Sync stored language preference into LanguageContext
        if (profile.preferred_language && profile.preferred_language !== language) {
          setLanguage(profile.preferred_language);
        }
        
        logger.debug('✅ Profile loaded successfully:', userData);
      } catch (err) {
        logger.error('❌ Error loading profile:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserProfile();
  }, [authUser]);

  // Form handling
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  
  // Update editForm when user data is loaded
  useEffect(() => {
    if (user) {
      setEditForm({ ...user });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Handle nested objects
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setEditForm({
        ...editForm,
        [parent]: {
          ...editForm[parent],
          [child]: value
        }
      });
    } else {
      setEditForm({
        ...editForm,
        [name]: value
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUser(editForm);
    setIsEditing(false);
    
    // Sync language preference to context + localStorage
    if (editForm.preferred_language) {
      setLanguage(editForm.preferred_language);
    }
    
    // Persist to Supabase
    if (authUser?.id) {
      try {
        const updateData = {
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          phone: editForm.phone,
          region: editForm.region,
          preferred_language: editForm.preferred_language
        };
        const result = await authService.updateUserProfile(authUser.id, updateData);
        
        // If preferred_language column doesn't exist yet, retry without it
        if (!result.success && result.error?.includes('preferred_language')) {
          logger.warn('⚠️ preferred_language column not found, saving without it');
          const { preferred_language, ...dataWithoutLang } = updateData;
          await authService.updateUserProfile(authUser.id, dataWithoutLang);
        }
        
        logger.info('✅ Profile updated in Supabase');
      } catch (err) {
        logger.error('❌ Failed to update profile:', err);
      }
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <TopNavBar user={null} />
        <div className="flex-grow mt-14 mb-16 px-4 py-3 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
        <BottomNavBar />
      </div>
    );
  }

  // Show error state
  if (error || !user) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <TopNavBar user={null} />
        <div className="flex-grow mt-14 mb-16 px-4 py-3 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error || 'Profile not found'}</p>
            <p className="text-gray-600">Please try logging in again.</p>
          </div>
        </div>
        <BottomNavBar />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <TopNavBar user={user} />
      
      <div className="flex-grow mt-14 mb-16 px-4 py-3">
        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 bg-gray-300 rounded-full mb-3 flex items-center justify-center text-4xl text-gray-700">
            {user.first_name[0]}{user.last_name[0]}
          </div>
          <h1 className="text-2xl font-bold">{user.first_name} {user.last_name}</h1>
          <p className="text-sm text-gray-500 mt-1">Member since {new Date(user.joined_date).toLocaleDateString()}</p>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b mb-4 overflow-x-auto">
          <button
            className={`flex-1 px-4 py-2 text-sm sm:text-base whitespace-nowrap ${activeTab === 'personal' ? 'border-b-2 border-primary text-primary font-semibold' : 'text-gray-500'}`}
            onClick={() => setActiveTab('personal')}
          >
            Personal Info
          </button>
          <button
            className={`flex-1 px-4 py-2 text-sm sm:text-base whitespace-nowrap ${activeTab === 'vehicle' ? 'border-b-2 border-primary text-primary font-semibold' : 'text-gray-500'}`}
            onClick={() => setActiveTab('vehicle')}
          >
            Vehicle
          </button>
        </div>
        
        {/* Personal Info Tab */}
        {activeTab === 'personal' && (
          <div className="card">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold">Personal Information</h2>
              {!isEditing && (
                <button 
                  className="text-primary text-sm"
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </button>
              )}
            </div>
            
            {isEditing ? (
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">First Name</label>
                  <input
                    type="text"
                    name="first_name"
                    value={editForm.first_name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
                
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    value={editForm.last_name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
                
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={editForm.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
                
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Region</label>
                  <input
                    type="text"
                    name="region"
                    value={editForm.region}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
                
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">🗣️ Voice Navigation Language</label>
                  <p className="text-xs text-gray-500 mb-2">Choose the language you hear during navigation</p>
                  <div className="space-y-1.5">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <label
                        key={lang.code}
                        className={`flex items-center p-2.5 rounded-lg border-2 cursor-pointer transition-colors ${
                          editForm.preferred_language === lang.code
                            ? 'border-primary bg-primary/10'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="preferred_language"
                          value={lang.code}
                          checked={editForm.preferred_language === lang.code}
                          onChange={handleChange}
                          className="sr-only"
                        />
                        <span className="text-xl mr-2">{lang.flag}</span>
                        <div className="flex-1">
                          <span className="font-semibold text-sm">{lang.nativeLabel}</span>
                          <span className="text-xs text-gray-500 ml-1">({lang.label})</span>
                        </div>
                        {editForm.preferred_language === lang.code && (
                          <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="flex space-x-2 mt-4">
                  <button 
                    type="submit"
                    className="btn btn-primary"
                  >
                    Save Changes
                  </button>
                  <button 
                    type="button"
                    className="btn bg-gray-300 text-gray-800"
                    onClick={() => {
                      setEditForm({ ...user });
                      setIsEditing(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p>{user.phone}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Region</p>
                  <p>{user.region}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">🗣️ Voice Navigation Language</p>
                  <p>
                    {(() => {
                      const lang = SUPPORTED_LANGUAGES.find(l => l.code === user.preferred_language);
                      return lang ? `${lang.flag} ${lang.nativeLabel} (${lang.label})` : 'English';
                    })()}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Company</p>
                  <p>{user.company.name} ({user.company.id})</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500">Role</p>
                  <p>{user.company.role}</p>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Vehicle Tab */}
        {activeTab === 'vehicle' && (
          <div className="card">
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold">Vehicle Information</h2>
            </div>
            
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Vehicle Type</p>
                <p>{user.vehicle.type}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">License Plate</p>
                <p>{user.vehicle.license_plate}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Color</p>
                <p>{user.vehicle.color}</p>
              </div>
            </div>
            
            <button className="btn btn-secondary mt-4">
              Update Vehicle Info
            </button>
          </div>
        )}
      </div>

      {/* Developer Tools Section */}
      {import.meta.env.DEV && (
        <div className="card bg-orange-50 border-2 border-orange-200 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-orange-900">🛠️ Developer Tools</h2>
            <span className="text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded">DEV MODE</span>
          </div>
          <p className="text-sm text-orange-700 mb-4">Testing utilities for development</p>
          <a 
            href="/payment-test" 
            className="btn btn-primary w-full"
          >
            💳 Payment Testing Interface
          </a>
        </div>
      )}
      
      <BottomNavBar />
    </div>
  );
};

export default ProfilePage;
