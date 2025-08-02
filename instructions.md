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

supabase schema
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.alerts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text])),
  priority text NOT NULL DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])),
  related_to jsonb,
  user_id uuid,
  assigned_to uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  comments ARRAY,
  CONSTRAINT alerts_pkey PRIMARY KEY (id),
  CONSTRAINT alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT alerts_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id)
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
  CONSTRAINT bag_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT bag_orders_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id)
);
CREATE TABLE public.bags (
  bag_id text NOT NULL,
  batch_id text,
  type text NOT NULL CHECK (type = ANY (ARRAY['plastic'::text, 'paper'::text, 'metal'::text, 'glass'::text, 'organic'::text, 'general'::text, 'recycling'::text])),
  scanned boolean DEFAULT false,
  picked_up_at timestamp with time zone,
  requested_at timestamp with time zone DEFAULT now(),
  qr_code text UNIQUE,
  status text,
  created_at timestamp with time zone,
  picked_up_by uuid,
  CONSTRAINT bags_pkey PRIMARY KEY (bag_id),
  CONSTRAINT bags_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.pickup_requests(id..)
);
CREATE TABLE public.bags_mobile (
  bag_id uuid NOT NULL DEFAULT gen_random_uuid(),
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text,
  picked_up_at timestamp without time zone,
  picked_up_by uuid,
  CONSTRAINT bags_mobile_pkey PRIMARY KEY (bag_id),
  CONSTRAINT bags_mobile_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches(batch_id)
);
CREATE TABLE public.batches (
  batch_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  number_of_bags integer NOT NULL,
  trash_type text NOT NULL,
  bag_size text,
  batch_status text NOT NULL DEFAULT 'Active'::text,
  distributed integer DEFAULT 0,
  scanned integer DEFAULT 0,
  qr_prefix text,
  generation_date timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT batches_pkey PRIMARY KEY (batch_id),
  CONSTRAINT batches_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.collector_sessions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  collector_id uuid NOT NULL UNIQUE,
  filter_criteria jsonb,
  reserved_requests ARRAY DEFAULT ARRAY[]::uuid[],
  session_start timestamp with time zone DEFAULT now(),
  last_activity timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  CONSTRAINT collector_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT collector_sessions_collector_id_fkey FOREIGN KEY (collector_id) REFERENCES auth.users(id)
);
CREATE TABLE public.collectors (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  first_name text,
  last_name text,
  phone text,
  status text NOT NULL DEFAULT 'Active'::text,
  region text,
  rating numeric,
  total_collections integer DEFAULT 0,
  joined_date timestamp with time zone DEFAULT now(),
  last_active timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT collectors_pkey PRIMARY KEY (id),
  CONSTRAINT collectors_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.disposal_centers (
  id text NOT NULL,
  name text NOT NULL,
  coordinates USER-DEFINED NOT NULL,
  address text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT disposal_centers_pkey PRIMARY KEY (id)
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
  CONSTRAINT dumping_reports_pkey PRIMARY KEY (id),
  CONSTRAINT dumping_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.fee_points (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  points integer NOT NULL,
  request_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fee_points_pkey PRIMARY KEY (id),
  CONSTRAINT fee_points_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT fee_points_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.pickup_requests(id..)
);
CREATE TABLE public.illegal_dumping (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  reported_by uuid NOT NULL,
  location text NOT NULL,
  coordinates USER-DEFINED NOT NULL,
  waste_type text NOT NULL,
  size text NOT NULL,
  images ARRAY,
  status text NOT NULL DEFAULT 'Reported'::text CHECK (status = ANY (ARRAY['Reported'::text, 'Verified'::text, 'Cleanup Scheduled'::text, 'In Progress'::text, 'Cleaned Up'::text, 'Closed'::text])),
  reported_at timestamp with time zone DEFAULT now(),
  assigned_to uuid,
  cleanup_team text,
  cleanup_assigned boolean DEFAULT false,
  estimated_cleanup_date timestamp with time zone,
  cleaned_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  report_id uuid,
  original_report_id uuid,
  CONSTRAINT illegal_dumping_pkey PRIMARY KEY (id),
  CONSTRAINT illegal_dumping_original_report_id_fkey FOREIGN KEY (original_report_id) REFERENCES public.dumping_reports(id),
  CONSTRAINT illegal_dumping_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.dumping_reports(id),
  CONSTRAINT illegal_dumping_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id),
  CONSTRAINT illegal_dumping_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES auth.users(id)
);
CREATE TABLE public.illegal_dumping_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  report_id uuid NOT NULL,
  status text NOT NULL,
  changed_by uuid,
  changed_at timestamp with time zone DEFAULT now(),
  notes text,
  CONSTRAINT illegal_dumping_history_pkey PRIMARY KEY (id),
  CONSTRAINT illegal_dumping_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id),
  CONSTRAINT illegal_dumping_history_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.illegal_dumping(id)
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
  id.. text NOT NULL,
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
  id uuid,
  payment_method_id uuid,
  payment_type text CHECK (payment_type = ANY (ARRAY['prepaid'::text, 'postpaid'::text])),
  priority text,
  CONSTRAINT pickup_requests_pkey PRIMARY KEY (id..),
  CONSTRAINT pickup_requests_id_fkey FOREIGN KEY (id) REFERENCES public.rewards(id),
  CONSTRAINT pickup_requests_collector_id_fkey FOREIGN KEY (collector_id) REFERENCES auth.users(id),
  CONSTRAINT pickup_requests_payment_method_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id)
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
  CONSTRAINT reward_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT reward_redemptions_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.rewards(id)
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
  CONSTRAINT rewards_redemption_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT rewards_redemption_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.rewards(id)
);
CREATE TABLE public.scans (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  bag_id text NOT NULL,
  scanned_by uuid NOT NULL,
  scanned_at timestamp with time zone DEFAULT now(),
  location text,
  coordinates USER-DEFINED,
  status text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT scans_pkey PRIMARY KEY (id),
  CONSTRAINT scans_bag_id_fkey FOREIGN KEY (bag_id) REFERENCES public.bags(bag_id),
  CONSTRAINT scans_scanned_by_fkey FOREIGN KEY (scanned_by) REFERENCES auth.users(id)
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
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_stats_pkey PRIMARY KEY (id),
  CONSTRAINT user_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);