Below are the detailed instructions for developing the TrashDrop Progressive Web App (PWA) using React, Supabase (with an existing schema), Leaflet for mapping, and deployment on Netlify. These instructions cover the setup, authentication, UI, trash collection workflow, supporting features, account management, onboarding, and deployment.

---

### 1. Project Setup and Configuration

- **Initialize React Project**:
  - Use `npx create-react-app trashdrop --template cra-template-pwa` to create a React app with built-in PWA support (service worker included).
  - Install dependencies: `npm install react-router-dom @supabase/supabase-js leaflet react-leaflet tailwindcss`.
  - Set up Tailwind CSS by running `npx tailwindcss init` and configuring it for mobile-first design.

- **Project Structure**:
  - `src/components/`: Reusable components (e.g., `NavBar.js`, `Modal.js`).
  - `src/pages/`: Page components (e.g., `Login.js`, `Map.js`, `Request.js`).
  - `src/services/`: Supabase integration (e.g., `supabase.js`).
  - `src/context/`: State management (e.g., `AuthContext.js`, `ThemeContext.js`).
  - `src/utils/`: Helper functions (e.g., `app-config.js`).

- **Supabase Integration**:
  - In `src/services/supabase.js`, initialize Supabase with your project URL and API key from the existing schema.
  - Use `.env` files to store keys (e.g., `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_KEY`).

- **PWA Configuration**:
  - Update `public/manifest.json` with app metadata (name: "TrashDrop", icons, theme colors).
  - Modify `src/serviceWorker.js` to cache assets (HTML, CSS, JS) for offline functionality.

---

### 2. Authentication System

- **Components and Routes**:
  - Create `Login.js`, `Signup.js`, and `OTPVerification.js` in `src/pages/`.
  - Use React Router in `src/App.js` to define routes: `/login`, `/signup`, `/`.

- **Supabase Authentication**:
  - Implement phone number-based OTP authentication using Supabase’s auth API.
  - Store the JWT token in local storage and refresh it silently with a `useEffect` hook.

- **Auth State Management**:
  - Create `src/context/AuthContext.js` to manage `isAuthenticated` and `user` state.
  - Use a `PrivateRoute.js` component to protect authenticated routes.

---

### 3. UI Framework and Navigation

- **Responsive Design**:
  - Use Tailwind CSS for styling, ensuring a mobile-first approach.
  - Build reusable components like `Card.js` for request cards and `Grid.js` for layouts.

- **Navigation**:
  - In `src/components/NavBar.js`, create a top navbar with the "TrashDrop" logo on the left and a user profile dropdown on the right.
  - Implement a bottom navigation bar with tabs: Map, Request, Assign, Earnings (Map as default).

- **Dark Mode**:
  - Define CSS variables in `src/index.css` and toggle themes via `src/context/ThemeContext.js`, persisting the choice in local storage.

- **Modal Component**:
  - Create `Modal.js` using React portals for accessible popups.

---

### 4. Main Application Interface

- **Home Dashboard (Map View)**:
  - Create `Map.js` in `src/pages/` using `react-leaflet`.
  - Display the user’s location (📍), nearby trash requests as markers (color-coded by type), and a collection radius circle.
  - Default to Accra, Ghana if location access is denied.

- **Navigation Menu**:
  - Top navbar: Logo and profile dropdown (profile, settings, logout).
  - Bottom navbar: Map, Request, Assign, Earnings tabs with React Router navigation.

---

### 5. Trash Collection Workflow

- **Request Management**:
  - Create `Request.js` with tabs: "Available," "Accepted," "Picked Up."
  - Each request card shows distance, earnings, type, address, timestamp, and actions (Accept, View Details).

- **Workflow**:
  - **Acceptance**: Move requests from "Available" to "Accepted" upon clicking "Accept."
  - **Pickup**: Provide directions and QR scanning (via a modal) to move requests to "Picked Up."
  - **Disposal**: Show disposal sites and confirm disposal, updating the request status.

- **Assignment Management**:
  - Create `Assign.js` with tabs: "Available," "Accepted," "Completed."
  - Include actions: Accept, Navigate, Complete (with photo capture and QR scanning).

---

### 6. Supporting Features

- **Location Services**:
  - Request browser location access with a fallback to Accra, Ghana.
  
- **Offline Capabilities**:
  - Cache assets in the service worker and store pending actions in local storage for syncing when online.

- **Real-time Updates**:
  - Use WebSockets (via Supabase real-time) for live request/assignment updates and push notifications.

---

### 7. Account Management

- **User Profile**:
  - Create `Profile.js` to display and edit personal info, earnings history, and collection stats.

- **Session Management**:
  - Persist login state with token refresh and add a logout option in the profile dropdown.

---

### 8. Onboarding Flow

- **Onboarding Process**:
  - Create `Onboarding.js` with a multi-step form for personal, company, and vehicle details.
  - Store data in Supabase and restrict request/assignment acceptance until account confirmation.

---

### 9. Deployment on Netlify

- **Build and Deploy**:
  - Run `npm run build` and connect your GitHub repo to Netlify.
  - Set environment variables in Netlify for Supabase keys.

---

### Example Code: Main App File

Below is an example `index.html` file with React, Supabase, Leaflet, and Tailwind CSS integrated.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TrashDrop</title>
  <link rel="manifest" href="/manifest.json">
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com leaflet@1.9.4/dist/leaflet.css" />
</head>
<body>
  <div id="root"></div>

  <script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.development.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7.22.9/babel.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="https://unpkg.com/react-leaflet@4.0.0/dist/react-leaflet.umd.js"></script>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/react-router-dom@6.16.0/dist/umd/react-router-dom.min.js"></script>

  <script type="text/babel">
    const { createClient } = Supabase;
    const { BrowserRouter, Routes, Route, NavLink } = ReactRouterDOM;
    const { MapContainer, TileLayer, Marker, Circle } = ReactLeaflet;

    const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_KEY');

    const AuthContext = React.createContext();

    const NavBar = () => (
      <nav className="fixed bottom-0 w-full bg-gray-800 text-white flex justify-around py-2">
        <NavLink to="/" className="p-2">Map</NavLink>
        <NavLink to="/request" className="p-2">Request</NavLink>
        <NavLink to="/assign" className="p-2">Assign</NavLink>
        <NavLink to="/earnings" className="p-2">Earnings</NavLink>
      </nav>
    );

    const MapPage = () => {
      const [position, setPosition] = React.useState([5.6037, -0.1870]); // Accra, Ghana
      React.useEffect(() => {
        navigator.geolocation.getCurrentPosition(
          (pos) => setPosition([pos.coords.latitude, pos.coords.longitude]),
          () => console.log('Location denied')
        );
      }, []);
      return (
        <MapContainer center={position} zoom={13} style={{ height: '80vh' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={position} />
          <Circle center={position} radius={1000} />
        </MapContainer>
      );
    };

    const LoginPage = () => {
      const [phone, setPhone] = React.useState('');
      const handleLogin = async () => {
        const { error } = await supabase.auth.signInWithOtp({ phone });
        if (error) console.error(error);
      };
      return (
        <div className="p-4">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="border p-2 w-full"
            placeholder="Phone Number"
          />
          <button onClick={handleLogin} className="bg-blue-500 text-white p-2 mt-2">Send Code</button>
        </div>
      );
    };

    const App = () => {
      const [user, setUser] = React.useState(null);
      return (
        <AuthContext.Provider value={{ user, setUser }}>
          <BrowserRouter>
            <div className="min-h-screen">
              <Routes>
                <Route path="/" element={<MapPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/request" element={<div>Request Page</div>} />
                <Route path="/assign" element={<div>Assign Page</div>} />
                <Route path="/earnings" element={<div>Earnings Page</div>} />
              </Routes>
              <NavBar />
            </div>
          </BrowserRouter>
        </AuthContext.Provider>
      );
    };

    ReactDOM.render(<App />, document.getElementById('root'));
  </script>
</body>
</html>
```

---

### 10. Additional Notes

- **QR Code Security**: Use Supabase to generate encrypted, single-use, time-based QR codes with location verification.
- **Testing**: Test offline capabilities, real-time updates, and all workflows thoroughly before deployment.

Follow these instructions to build and deploy the TrashDrop PWA efficiently!

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text DEFAULT 'info'::text,
  severity text DEFAULT 'medium'::text,
  entity_type text,
  entity_id uuid,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  creator uuid,
  CONSTRAINT alerts_pkey PRIMARY KEY (id),
  CONSTRAINT alerts_creator_fkey FOREIGN KEY (creator) REFERENCES auth.users(id),
  CONSTRAINT alerts_created_by_profiles_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT alerts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.assignment_photos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  assignment_id text,
  photo_url text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT assignment_photos_pkey PRIMARY KEY (id),
  CONSTRAINT assignment_photos_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.authority_assignments(id)
);
CREATE TABLE public.authority_assignments (
  id text NOT NULL,
  location text NOT NULL,
  coordinates USER-DEFINED NOT NULL,
  type text NOT NULL,
  priority text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])),
  payment text NOT NULL,
  estimated_time text,
  distance text,
  authority text,
  status text NOT NULL CHECK (status = ANY (ARRAY['available'::text, 'accepted'::text, 'completed'::text])),
  collector_id uuid,
  accepted_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  cleanup_notes text,
  CONSTRAINT authority_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT authority_assignments_collector_id_fkey FOREIGN KEY (collector_id) REFERENCES auth.users(id)
);
CREATE TABLE public.bag_count (
  count bigint
);
CREATE TABLE public.bag_inventory (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  batch_code text NOT NULL,
  bag_type text NOT NULL,
  status text NOT NULL DEFAULT 'available'::text,
  scan_date timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  batch_id uuid,
  CONSTRAINT bag_inventory_pkey PRIMARY KEY (id),
  CONSTRAINT bag_inventory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT bag_inventory_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.bag_orders(id)
);
CREATE TABLE public.bag_orders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  location_id uuid NOT NULL,
  bag_type text NOT NULL,
  quantity integer NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  delivery_date timestamp with time zone,
  points_used integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  batch_qr_code text NOT NULL UNIQUE,
  CONSTRAINT bag_orders_pkey PRIMARY KEY (id),
  CONSTRAINT bag_orders_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id),
  CONSTRAINT bag_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.bag_types (
  plastic bigint,
  paper bigint,
  metal bigint,
  glass bigint,
  organic bigint,
  general bigint,
  recycling bigint
);
CREATE TABLE public.bags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  batch_id uuid,
  qr_code text NOT NULL,
  status text DEFAULT 'active'::text,
  scanned boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT bags_pkey PRIMARY KEY (id),
  CONSTRAINT bags_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(id)
);
CREATE TABLE public.bags_mobile (
  bag_id uuid NOT NULL DEFAULT gen_random_uuid(),
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text,
  picked_up_at timestamp without time zone,
  picked_up_by uuid,
  CONSTRAINT bags_mobile_pkey PRIMARY KEY (bag_id)
);
CREATE TABLE public.batch_count (
  count bigint
);
CREATE TABLE public.batches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  batch_number text,
  bag_count integer NOT NULL DEFAULT 0,
  status text DEFAULT 'active'::text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  batch_name text,
  CONSTRAINT batches_pkey PRIMARY KEY (id),
  CONSTRAINT batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.bin_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  location_name text NOT NULL,
  address text NOT NULL,
  coordinates USER-DEFINED NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT bin_locations_pkey PRIMARY KEY (id),
  CONSTRAINT bin_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.bin_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  digital_bin_id uuid NOT NULL,
  collector_id uuid NOT NULL,
  bags_collected integer NOT NULL CHECK (bags_collected >= 0),
  total_bill numeric NOT NULL CHECK (total_bill >= 0::numeric),
  payment_mode text NOT NULL CHECK (payment_mode = ANY (ARRAY['momo'::text, 'e_cash'::text, 'cash'::text])),
  client_momo text,
  status text NOT NULL CHECK (status = ANY (ARRAY['pending'::text, 'initiated'::text, 'success'::text, 'failed'::text])),
  gateway_reference text UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  type text NOT NULL DEFAULT 'collection'::text CHECK (type = ANY (ARRAY['collection'::text, 'disbursement'::text])),
  collector_share numeric CHECK (collector_share >= 0::numeric),
  platform_share numeric CHECK (platform_share >= 0::numeric),
  client_rswitch text,
  currency text DEFAULT 'GHS'::text,
  collector_account_number text,
  collector_account_name text,
  sender_name text DEFAULT 'TrashDrop'::text,
  raw_gateway_response jsonb,
  CONSTRAINT bin_payments_pkey PRIMARY KEY (id),
  CONSTRAINT bin_payments_digital_bin_id_fkey FOREIGN KEY (digital_bin_id) REFERENCES public.digital_bins(id),
  CONSTRAINT bin_payments_collector_id_fkey FOREIGN KEY (collector_id) REFERENCES public.collector_profiles(id)
);
CREATE TABLE public.collector_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  status text NOT NULL DEFAULT 'inactive'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text, 'on_break'::text])),
  vehicle_type text CHECK (vehicle_type = ANY (ARRAY['truck'::text, 'van'::text, 'motorcycle'::text, 'bicycle'::text, 'cart'::text, 'other'::text])),
  vehicle_plate text,
  vehicle_capacity integer,
  current_latitude numeric,
  current_longitude numeric,
  assigned_region text,
  service_area_id uuid,
  rating numeric DEFAULT 0.00 CHECK (rating >= 0::numeric AND rating <= 5::numeric),
  total_collections integer DEFAULT 0,
  completed_today integer DEFAULT 0,
  active_requests integer DEFAULT 0,
  is_online boolean DEFAULT false,
  last_active_at timestamp with time zone,
  session_start_at timestamp with time zone,
  profile_image_url text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  company_name character varying,
  company_id character varying,
  id_back_photo_url character varying,
  id_front_photo_url character varying,
  id_type text,
  license_plate character varying,
  region text,
  role text,
  vehicle_color text,
  vehicle_photo_url character varying,
  email character varying,
  current_location USER-DEFINED,
  location_updated_at timestamp with time zone,
  last_active timestamp with time zone DEFAULT now(),
  CONSTRAINT collector_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT collector_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT collector_profiles_service_area_id_fkey FOREIGN KEY (service_area_id) REFERENCES public.service_areas(id)
);
CREATE TABLE public.collector_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  collector_id uuid NOT NULL,
  filter_criteria jsonb,
  reserved_requests ARRAY DEFAULT ARRAY[]::uuid[],
  session_start timestamp with time zone DEFAULT now(),
  last_activity timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval),
  status text DEFAULT 'offline'::text,
  status_reason text,
  last_status_change timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT collector_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT collector_sessions_collector_id_fkey FOREIGN KEY (collector_id) REFERENCES public.collector_profiles(id)
);
CREATE TABLE public.contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  email text,
  phone text,
  contact_type text DEFAULT 'personal'::text,
  relationship text,
  primary_contact boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT contacts_pkey PRIMARY KEY (id),
  CONSTRAINT contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.digital_bins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  location_id uuid NOT NULL,
  qr_code_url text NOT NULL,
  frequency character varying NOT NULL DEFAULT 'weekly'::character varying CHECK (frequency::text = ANY (ARRAY['one-time'::character varying, 'weekly'::character varying, 'biweekly'::character varying, 'monthly'::character varying]::text[])),
  waste_type character varying NOT NULL DEFAULT 'general'::character varying CHECK (waste_type::text = ANY (ARRAY['general'::character varying, 'recycling'::character varying, 'organic'::character varying]::text[])),
  bag_count integer NOT NULL DEFAULT 1 CHECK (bag_count >= 1 AND bag_count <= 10),
  details text,
  is_active boolean DEFAULT true,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  collected_at timestamp with time zone,
  collector_id uuid,
  status text DEFAULT 'available'::text CHECK (status = ANY (ARRAY['available'::text, 'accepted'::text, 'picked_up'::text, 'disposed'::text])),
  bin_size_liters integer NOT NULL DEFAULT 120 CHECK (bin_size_liters = ANY (ARRAY[60, 80, 90, 100, 120, 240, 340, 360, 660, 1100])),
  is_urgent boolean NOT NULL DEFAULT false,
  fee numeric DEFAULT 0,
  collector_core_payout numeric DEFAULT 0,
  collector_urgent_payout numeric DEFAULT 0,
  collector_distance_payout numeric DEFAULT 0,
  collector_surge_payout numeric DEFAULT 0,
  collector_tips numeric DEFAULT 0,
  collector_recyclables_payout numeric DEFAULT 0,
  collector_loyalty_cashback numeric DEFAULT 0,
  collector_total_payout numeric DEFAULT 0,
  surge_multiplier numeric DEFAULT 1.0,
  deadhead_km numeric DEFAULT 0,
  disposed_at timestamp with time zone,
  disposal_site_id text,
  CONSTRAINT digital_bins_pkey PRIMARY KEY (id),
  CONSTRAINT digital_bins_disposal_site_id_fkey FOREIGN KEY (disposal_site_id) REFERENCES public.disposal_centers(id),
  CONSTRAINT digital_bins_collector_id_fkey FOREIGN KEY (collector_id) REFERENCES auth.users(id),
  CONSTRAINT digital_bins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT digital_bins_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.bin_locations(id)
);
CREATE TABLE public.disposal_centers (
  id text NOT NULL,
  name text NOT NULL,
  coordinates USER-DEFINED NOT NULL,
  address text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  waste_type text,
  latitude USER-DEFINED,
  longitude USER-DEFINED,
  center_type text,
  CONSTRAINT disposal_centers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.dumping_count (
  count bigint
);
CREATE TABLE public.dumping_reports (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  address text,
  waste_type text NOT NULL CHECK (waste_type = ANY (ARRAY['plastic'::text, 'paper'::text, 'metal'::text, 'glass'::text, 'organic'::text, 'general'::text, 'recycling'::text])),
  approximate_size text NOT NULL,
  images ARRAY,
  status text NOT NULL DEFAULT 'reported'::text,
  is_anonymous boolean DEFAULT false,
  points_earned integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  location_address text,
  CONSTRAINT dumping_reports_pkey PRIMARY KEY (id),
  CONSTRAINT dumping_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.dumping_reports_mobile (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  dumping_id uuid NOT NULL,
  estimated_volume text,
  hazardous_materials boolean DEFAULT false,
  accessibility_notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT dumping_reports_mobile_pkey PRIMARY KEY (id),
  CONSTRAINT dumping_reports_mobile_dumping_id_fkey FOREIGN KEY (dumping_id) REFERENCES public.illegal_dumping_mobile(id)
);
CREATE TABLE public.fee_points (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  points integer NOT NULL,
  request_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fee_points_pkey PRIMARY KEY (id),
  CONSTRAINT fee_points_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.illegal_dumping (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reported_by uuid,
  assigned_to uuid,
  location USER-DEFINED,
  address text,
  description text,
  waste_type text,
  severity text DEFAULT 'medium'::text,
  status text DEFAULT 'Reported'::text,
  images ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  estimated_volume numeric,
  latitude numeric,
  longitude numeric,
  location_address text,
  CONSTRAINT illegal_dumping_pkey PRIMARY KEY (id),
  CONSTRAINT illegal_dumping_assigned_to_profiles_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id),
  CONSTRAINT illegal_dumping_reported_by_profiles_fkey FOREIGN KEY (reported_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.illegal_dumping_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  report_id uuid,
  previous_status text,
  new_status text,
  changed_by uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT illegal_dumping_history_pkey PRIMARY KEY (id),
  CONSTRAINT illegal_dumping_history_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.illegal_dumping(id),
  CONSTRAINT illegal_dumping_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id)
);
CREATE TABLE public.illegal_dumping_history_mobile (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  dumping_id uuid NOT NULL,
  status text NOT NULL,
  notes text,
  updated_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT illegal_dumping_history_mobile_pkey PRIMARY KEY (id),
  CONSTRAINT illegal_dumping_history_mobile_dumping_id_fkey FOREIGN KEY (dumping_id) REFERENCES public.illegal_dumping_mobile(id),
  CONSTRAINT illegal_dumping_history_mobile_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.illegal_dumping_mobile (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  reported_by uuid NOT NULL,
  location text NOT NULL,
  coordinates USER-DEFINED NOT NULL,
  waste_type text NOT NULL DEFAULT 'mixed'::text,
  severity text NOT NULL DEFAULT 'medium'::text CHECK (severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])),
  size text NOT NULL DEFAULT 'medium'::text CHECK (size = ANY (ARRAY['small'::text, 'medium'::text, 'large'::text])),
  photos ARRAY DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'verified'::text, 'in_progress'::text, 'completed'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  latitude numeric,
  longitude numeric,
  CONSTRAINT illegal_dumping_mobile_pkey PRIMARY KEY (id)
);
CREATE TABLE public.locations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  location_name text NOT NULL,
  address text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  is_default boolean DEFAULT false,
  location_type text DEFAULT 'home'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT locations_pkey PRIMARY KEY (id),
  CONSTRAINT locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.log_count (
  count bigint
);
CREATE TABLE public.logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  level character varying NOT NULL DEFAULT 'info'::character varying CHECK (level::text = ANY (ARRAY['debug'::character varying, 'info'::character varying, 'warn'::character varying, 'error'::character varying, 'critical'::character varying]::text[])),
  source character varying,
  message text NOT NULL,
  data jsonb,
  user_id uuid,
  session_id character varying,
  ip_address inet,
  user_agent text,
  request_id character varying,
  module character varying,
  function_name character varying,
  line_number integer,
  stack_trace text,
  execution_time numeric,
  memory_usage bigint,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT logs_pkey PRIMARY KEY (id),
  CONSTRAINT logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.message_count (
  count bigint
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id uuid,
  recipient_id uuid,
  subject text,
  content text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id),
  CONSTRAINT messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id)
);
CREATE TABLE public.notification_count (
  count bigint
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  title text NOT NULL,
  message text,
  type text DEFAULT 'info'::text,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.payment_methods (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['credit_card'::text, 'bank_account'::text, 'mobile_money'::text])),
  provider text NOT NULL,
  is_default boolean DEFAULT false,
  details jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_methods_pkey PRIMARY KEY (id),
  CONSTRAINT payment_methods_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.pickup_requests (
  id text NOT NULL,
  location text NOT NULL,
  coordinates USER-DEFINED NOT NULL,
  fee integer NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['available'::text, 'accepted'::text, 'picked_up'::text, 'disposed'::text])),
  collector_id uuid,
  accepted_at timestamp with time zone,
  picked_up_at timestamp with time zone,
  disposed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  waste_type text,
  bag_count bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  special_instructions text,
  scheduled_date timestamp with time zone,
  preferred_time text,
  points_earned integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  payment_method_id uuid,
  payment_type text CHECK (payment_type = ANY (ARRAY['prepaid'::text, 'postpaid'::text])),
  priority text,
  reserved_by uuid,
  reserved_at timestamp with time zone,
  reserved_until timestamp with time zone,
  exclusion_until timestamp with time zone,
  assignment_expires_at timestamp with time zone,
  filter_criteria jsonb,
  last_pool_entry timestamp with time zone DEFAULT now(),
  reservation_expires_at timestamp with time zone,
  estimated_volume numeric,
  assigned_to uuid,
  service_area_id uuid,
  user_id uuid,
  CONSTRAINT pickup_requests_pkey PRIMARY KEY (id),
  CONSTRAINT pickup_requests_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.collector_profiles(id),
  CONSTRAINT pickup_requests_payment_method_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id),
  CONSTRAINT pickup_requests_reserved_by_fkey FOREIGN KEY (reserved_by) REFERENCES auth.users(id),
  CONSTRAINT pickup_requests_assigned_to_profiles_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id),
  CONSTRAINT pickup_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  first_name text,
  last_name text,
  phone text,
  address text,
  avatar_url text,
  dark_mode boolean DEFAULT false,
  language text DEFAULT 'en'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  points integer DEFAULT 0,
  level text DEFAULT 'Eco Starter'::text,
  phone_verified boolean DEFAULT false,
  notification_preferences jsonb DEFAULT '{"push": true, "email": true}'::jsonb,
  role text DEFAULT 'user'::text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.reward_redemptions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  reward_id uuid NOT NULL,
  points_used integer NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  redemption_date timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reward_redemptions_pkey PRIMARY KEY (id),
  CONSTRAINT reward_redemptions_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.rewards(id),
  CONSTRAINT reward_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.rewards (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text NOT NULL,
  points_cost integer NOT NULL,
  category text NOT NULL,
  image_url text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rewards_pkey PRIMARY KEY (id)
);
CREATE TABLE public.rewards_redemption (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  reward_id uuid NOT NULL,
  points_spent integer NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  fulfilled_at timestamp with time zone,
  CONSTRAINT rewards_redemption_pkey PRIMARY KEY (id),
  CONSTRAINT rewards_redemption_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.rewards(id),
  CONSTRAINT rewards_redemption_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.scan_count (
  count bigint
);
CREATE TABLE public.scans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bag_id uuid,
  collector_id uuid,
  location USER-DEFINED,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT scans_pkey PRIMARY KEY (id),
  CONSTRAINT scans_collector_id_fkey FOREIGN KEY (collector_id) REFERENCES public.collector_profiles(id),
  CONSTRAINT scans_bag_id_fkey FOREIGN KEY (bag_id) REFERENCES public.bags(id)
);
CREATE TABLE public.scheduled_pickups (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  location_id uuid NOT NULL,
  schedule_type text NOT NULL,
  waste_type text NOT NULL,
  bag_count integer NOT NULL,
  pickup_date timestamp with time zone NOT NULL,
  preferred_time text NOT NULL,
  special_instructions text,
  status text NOT NULL DEFAULT 'scheduled'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  frequency text NOT NULL DEFAULT 'weekly'::text CHECK (frequency = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'monthly'::text])),
  address text,
  CONSTRAINT scheduled_pickups_pkey PRIMARY KEY (id),
  CONSTRAINT scheduled_pickups_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id),
  CONSTRAINT scheduled_pickups_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.service_area_count (
  count bigint
);
CREATE TABLE public.service_areas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color character varying DEFAULT '#3B82F6'::character varying,
  coordinates jsonb,
  bounds jsonb,
  active_collectors integer DEFAULT 0,
  total_collectors integer DEFAULT 0,
  total_requests integer DEFAULT 0,
  pending_requests integer DEFAULT 0,
  completion_rate numeric DEFAULT 0.00,
  coverage_area numeric,
  population integer,
  region character varying,
  district character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT service_areas_pkey PRIMARY KEY (id)
);
CREATE TABLE public.spatial_ref_sys (
  srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
  auth_name character varying,
  auth_srid integer,
  srtext character varying,
  proj4text character varying,
  CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);
CREATE TABLE public.user_activity (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  activity_type text NOT NULL,
  description text NOT NULL,
  related_id uuid,
  points_impact integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_activity_pkey PRIMARY KEY (id),
  CONSTRAINT user_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_levels (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  points_threshold integer NOT NULL,
  benefits ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_levels_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_stats (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  total_bags integer CHECK (total_bags >= 0),
  total_bags_scanned integer DEFAULT 0,
  available_bags integer DEFAULT 0,
  total_batches integer,
  CONSTRAINT user_stats_pkey PRIMARY KEY (id),
  CONSTRAINT user_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.waste_item_count (
  count bigint
);
CREATE TABLE public.waste_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['plastic'::character varying, 'paper'::character varying, 'glass'::character varying, 'metal'::character varying, 'organic'::character varying, 'electronic'::character varying, 'hazardous'::character varying, 'mixed'::character varying, 'recyclable'::character varying, 'general'::character varying]::text[])),
  weight numeric,
  volume numeric,
  unit character varying DEFAULT 'kg'::character varying CHECK (unit::text = ANY (ARRAY['kg'::character varying, 'lbs'::character varying, 'tons'::character varying, 'liters'::character varying, 'm3'::character varying]::text[])),
  pickup_request_id text,
  batch_id uuid,
  collector_id uuid,
  location text,
  coordinates jsonb,
  status character varying DEFAULT 'collected'::character varying CHECK (status::text = ANY (ARRAY['collected'::character varying, 'sorted'::character varying, 'disposed'::character varying, 'recycled'::character varying, 'processed'::character varying]::text[])),
  notes text,
  photos jsonb,
  environmental_impact_score integer CHECK (environmental_impact_score >= 0 AND environmental_impact_score <= 100),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT waste_items_pkey PRIMARY KEY (id)
);