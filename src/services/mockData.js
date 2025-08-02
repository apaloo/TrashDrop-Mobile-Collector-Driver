// Mock data for development mode
export let mockPickupRequests = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    waste_type: 'recyclables',
    coordinates: [5.6037, -0.1870],
    location: 'Test Location 1',
    fee: 100,
    status: 'available',
    priority: 'medium',
    bag_count: 2,
    special_instructions: 'Test instructions',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    waste_type: 'general',
    coordinates: [5.6137, -0.1770],
    location: 'Test Location 2',
    fee: 150,
    status: 'available',
    priority: 'high',
    bag_count: 3,
    special_instructions: 'Test instructions 2',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    waste_type: 'organic',
    coordinates: [5.6237, -0.1670],
    location: 'Test Location 3',
    fee: 200,
    status: 'accepted',
    priority: 'medium',
    bag_count: 4,
    special_instructions: 'Test instructions 3',
    collector_id: '6fba1031-839f-4985-a180-9ae0a04b7812',
    accepted_at: new Date().toISOString(),
    assignment_expires_at: new Date(Date.now() + 36000000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    waste_type: 'recyclables',
    coordinates: [5.6337, -0.1570],
    location: 'Test Location 4',
    fee: 120,
    status: 'picked_up',
    priority: 'low',
    bag_count: 1,
    special_instructions: 'Test instructions 4',
    collector_id: '6fba1031-839f-4985-a180-9ae0a04b7812',
    accepted_at: new Date(Date.now() - 86400000).toISOString(),
    picked_up_at: new Date().toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date().toISOString()
  }
];

export let mockCollectorSession = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  collector_id: '6fba1031-839f-4985-a180-9ae0a04b7812',
  filter_criteria: JSON.stringify({
    waste_types: ['recyclables', 'general', 'organic'],
    radius: 5,
    min_fee: 0,
    max_fee: 1000
  }),
  last_pool_entry: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

export const mockNotifications = [
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    request_id: '550e8400-e29b-41d4-a716-446655440000',
    collector_id: '6fba1031-839f-4985-a180-9ae0a04b7812',
    type: 'request_available',
    message: 'New request available in your area',
    created_at: new Date().toISOString()
  }
];
