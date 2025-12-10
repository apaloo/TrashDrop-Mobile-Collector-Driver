import { useState, useEffect } from 'react';
import { TopNavBar } from '../components/NavBar';
import BottomNavBar from '../components/BottomNavBar';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/supabase';
import { logger } from '../utils/logger';

const ProfilePage = () => {
  const { user: authUser } = useAuth();
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
          rating: 0.0, // New users start with 0 rating
          total_collections: 0, // New users start with 0 collections
          joined_date: profile.created_at || new Date().toISOString(),
          last_active: new Date().toISOString(),
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
          },
          stats: {
            today_collections: 0,
            today_earnings: 0,
            week_collections: 0,
            week_earnings: 0,
            month_collections: 0,
            month_earnings: 0
          }
        };
        
        setUser(userData);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setUser(editForm);
    setIsEditing(false);
    // In real app: update user info in Supabase
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <TopNavBar user={null} />
        <div className="flex-grow mt-14 mb-16 px-4 py-3 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading profile...</p>
          </div>
        </div>
        <BottomNavBar />
      </div>
    );
  }

  // Show error state
  if (error || !user) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <TopNavBar user={null} />
        <div className="flex-grow mt-14 mb-16 px-4 py-3 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error || 'Profile not found'}</p>
            <p className="text-gray-600 dark:text-gray-400">Please try logging in again.</p>
          </div>
        </div>
        <BottomNavBar />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopNavBar user={user} />
      
      <div className="flex-grow mt-14 mb-16 px-4 py-3">
        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 bg-gray-300 rounded-full mb-3 flex items-center justify-center text-4xl text-gray-700">
            {user.first_name[0]}{user.last_name[0]}
          </div>
          <h1 className="text-2xl font-bold">{user.first_name} {user.last_name}</h1>
          <div className="flex items-center mt-1">
            <span className="text-yellow-500 mr-1">★</span>
            <span>{user.rating}</span>
            <span className="mx-2">•</span>
            <span>{user.total_collections} Collections</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">Member since {new Date(user.joined_date).toLocaleDateString()}</p>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b mb-4">
          <button
            className={`px-4 py-2 ${activeTab === 'personal' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}
            onClick={() => setActiveTab('personal')}
          >
            Personal Info
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'stats' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}
            onClick={() => setActiveTab('stats')}
          >
            Stats
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'vehicle' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}
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
        
        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            <div className="card">
              <h3 className="text-lg font-bold mb-3">Today's Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Collections</p>
                  <p className="text-2xl font-bold">{user.stats.today_collections}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Earnings</p>
                  <p className="text-2xl font-bold text-primary">₵{user.stats.today_earnings}</p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <h3 className="text-lg font-bold mb-3">This Week</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Collections</p>
                  <p className="text-2xl font-bold">{user.stats.week_collections}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Earnings</p>
                  <p className="text-2xl font-bold text-primary">₵{user.stats.week_earnings}</p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <h3 className="text-lg font-bold mb-3">This Month</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Collections</p>
                  <p className="text-2xl font-bold">{user.stats.month_collections}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Earnings</p>
                  <p className="text-2xl font-bold text-primary">₵{user.stats.month_earnings}</p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <h3 className="text-lg font-bold mb-3">All Time</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Total Collections</p>
                  <p className="text-2xl font-bold">{user.total_collections}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Rating</p>
                  <div className="flex items-center">
                    <span className="text-2xl font-bold mr-1">{user.rating}</span>
                    <span className="text-yellow-500">★</span>
                  </div>
                </div>
              </div>
            </div>
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
