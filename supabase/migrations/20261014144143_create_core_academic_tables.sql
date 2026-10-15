/*
# Core Academic Structure Tables

Creates the foundational tables for the university attendance tracking system:
- users: System users with RBAC roles (OWNER, COLLEGE_MONITOR, DEPARTMENT_MONITOR, FACULTY)
- colleges: University colleges
- departments: Academic departments within colleges
- buildings: Campus buildings
- rooms: Rooms within buildings
- academic_years: Academic year definitions
- semesters: Semesters within academic years

Security:
- RLS enabled on all tables
- Policies scoped to authenticated users
- Users table: users can read their own profile
- Academic structure: all authenticated users can read
*/

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  uid text UNIQUE,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  employee_id text,
  role text NOT NULL CHECK (role IN ('OWNER', 'COLLEGE_MONITOR', 'DEPARTMENT_MONITOR', 'FACULTY')),
  role_title_ar text,
  assigned_college_id text,
  assigned_department_id text,
  assigned_faculty_id text,
  avatar text,
  must_change_password boolean DEFAULT false,
  status text DEFAULT 'active',
  token_version integer DEFAULT 0,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own" ON users FOR SELECT
  TO authenticated USING (auth.uid()::text = id OR auth.jwt() ->> 'email' = email);

-- Colleges
CREATE TABLE IF NOT EXISTS colleges (
  id text PRIMARY KEY,
  code text,
  name_ar text NOT NULL,
  name_en text,
  dean_name text,
  monitor_name text,
  monitor_user_id text,
  phone text,
  email text,
  status text DEFAULT 'active',
  logo_path text,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "colleges_select_authenticated" ON colleges;
CREATE POLICY "colleges_select_authenticated" ON colleges FOR SELECT
  TO authenticated USING (is_deleted = false);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id text PRIMARY KEY,
  college_id text NOT NULL,
  code text,
  name_ar text NOT NULL,
  name_en text,
  head_name text,
  monitor_name text,
  monitor_user_id text,
  status text DEFAULT 'active',
  logo_path text,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "departments_select_authenticated" ON departments;
CREATE POLICY "departments_select_authenticated" ON departments FOR SELECT
  TO authenticated USING (is_deleted = false);

-- Buildings
CREATE TABLE IF NOT EXISTS buildings (
  id text PRIMARY KEY,
  code text,
  name_ar text NOT NULL,
  name_en text,
  floors_count integer,
  latitude double precision,
  longitude double precision,
  location_description text,
  status text DEFAULT 'active',
  photo_path text,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buildings_select_authenticated" ON buildings;
CREATE POLICY "buildings_select_authenticated" ON buildings FOR SELECT
  TO authenticated USING (is_deleted = false);

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id text PRIMARY KEY,
  building_id text NOT NULL,
  college_id text NOT NULL,
  department_id text,
  code text,
  name_ar text NOT NULL,
  name_en text,
  capacity integer,
  type text,
  room_type text,
  floor text,
  location_description text,
  status text DEFAULT 'active',
  photo_path text,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rooms_select_authenticated" ON rooms;
CREATE POLICY "rooms_select_authenticated" ON rooms FOR SELECT
  TO authenticated USING (is_deleted = false);

-- Academic Years
CREATE TABLE IF NOT EXISTS academic_years (
  id text PRIMARY KEY,
  name text NOT NULL,
  is_current boolean DEFAULT false,
  start_date text,
  end_date text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "academic_years_select_authenticated" ON academic_years;
CREATE POLICY "academic_years_select_authenticated" ON academic_years FOR SELECT
  TO authenticated USING (true);

-- Semesters
CREATE TABLE IF NOT EXISTS semesters (
  id text PRIMARY KEY,
  academic_year_id text,
  name_ar text,
  name_en text,
  semester_number integer,
  is_current boolean DEFAULT false,
  start_date text,
  end_date text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "semesters_select_authenticated" ON semesters;
CREATE POLICY "semesters_select_authenticated" ON semesters FOR SELECT
  TO authenticated USING (true);

-- Add foreign key constraints using DO blocks for idempotency
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_departments_college') THEN
    ALTER TABLE departments ADD CONSTRAINT fk_departments_college
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_rooms_building') THEN
    ALTER TABLE rooms ADD CONSTRAINT fk_rooms_building
      FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_rooms_college') THEN
    ALTER TABLE rooms ADD CONSTRAINT fk_rooms_college
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_semesters_academic_year') THEN
    ALTER TABLE semesters ADD CONSTRAINT fk_semesters_academic_year
      FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_departments_college_id ON departments(college_id);
CREATE INDEX IF NOT EXISTS idx_rooms_college_id ON rooms(college_id);
CREATE INDEX IF NOT EXISTS idx_rooms_building_id ON rooms(building_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
