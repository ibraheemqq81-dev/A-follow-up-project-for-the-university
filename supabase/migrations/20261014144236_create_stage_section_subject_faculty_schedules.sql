/*
# Academic Stage, Section, Subject, Faculty, and Schedule Tables

Creates:
- stages: Academic stages/years within departments
- sections: Student sections within stages
- subjects: Subjects taught in departments
- faculties: Faculty members
- schedules: Lecture schedules
- schedule_sections: Many-to-many between schedules and sections

Security:
- RLS enabled on all tables
- All authenticated users can read
*/

-- Stages
CREATE TABLE IF NOT EXISTS stages (
  id text PRIMARY KEY,
  department_id text NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  year_number integer,
  status text DEFAULT 'ACTIVE',
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stages_select_authenticated" ON stages;
CREATE POLICY "stages_select_authenticated" ON stages FOR SELECT
  TO authenticated USING (is_deleted = false);

-- Sections
CREATE TABLE IF NOT EXISTS sections (
  id text PRIMARY KEY,
  department_id text NOT NULL,
  stage_id text NOT NULL,
  name text NOT NULL,
  student_count integer DEFAULT 0,
  status text DEFAULT 'ACTIVE',
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sections_select_authenticated" ON sections;
CREATE POLICY "sections_select_authenticated" ON sections FOR SELECT
  TO authenticated USING (is_deleted = false);

-- Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id text PRIMARY KEY,
  department_id text NOT NULL,
  stage_id text,
  code text,
  name_ar text NOT NULL,
  name_en text,
  type text,
  theoretical_hours integer DEFAULT 0,
  practical_hours integer DEFAULT 0,
  credit_units integer DEFAULT 0,
  status text DEFAULT 'active',
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subjects_select_authenticated" ON subjects;
CREATE POLICY "subjects_select_authenticated" ON subjects FOR SELECT
  TO authenticated USING (is_deleted = false);

-- Faculties
CREATE TABLE IF NOT EXISTS faculties (
  id text PRIMARY KEY,
  college_id text,
  department_id text,
  employee_id text,
  name_ar text NOT NULL,
  name_en text,
  academic_title text,
  specialization text,
  email text,
  phone text,
  photo_path text,
  status text DEFAULT 'ACTIVE',
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE faculties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "faculties_select_authenticated" ON faculties;
CREATE POLICY "faculties_select_authenticated" ON faculties FOR SELECT
  TO authenticated USING (is_deleted = false);

-- Schedules
CREATE TABLE IF NOT EXISTS schedules (
  id text PRIMARY KEY,
  college_id text,
  department_id text NOT NULL,
  stage_id text,
  subject_id text NOT NULL,
  faculty_id text NOT NULL,
  section_id text NOT NULL,
  room_id text NOT NULL,
  day text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  lecture_type text,
  academic_year text NOT NULL,
  semester text NOT NULL,
  status text DEFAULT 'ACTIVE',
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedules_select_authenticated" ON schedules;
CREATE POLICY "schedules_select_authenticated" ON schedules FOR SELECT
  TO authenticated USING (is_deleted = false);

-- Schedule Sections (many-to-many)
CREATE TABLE IF NOT EXISTS schedule_sections (
  id text PRIMARY KEY,
  schedule_id text NOT NULL,
  section_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE schedule_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule_sections_select_authenticated" ON schedule_sections;
CREATE POLICY "schedule_sections_select_authenticated" ON schedule_sections FOR SELECT
  TO authenticated USING (true);

-- Foreign key constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_stages_department') THEN
    ALTER TABLE stages ADD CONSTRAINT fk_stages_department
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sections_department') THEN
    ALTER TABLE sections ADD CONSTRAINT fk_sections_department
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sections_stage') THEN
    ALTER TABLE sections ADD CONSTRAINT fk_sections_stage
      FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_subjects_department') THEN
    ALTER TABLE subjects ADD CONSTRAINT fk_subjects_department
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_faculties_college') THEN
    ALTER TABLE faculties ADD CONSTRAINT fk_faculties_college
      FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_faculties_department') THEN
    ALTER TABLE faculties ADD CONSTRAINT fk_faculties_department
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_schedules_department') THEN
    ALTER TABLE schedules ADD CONSTRAINT fk_schedules_department
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_schedule_sections_schedule') THEN
    ALTER TABLE schedule_sections ADD CONSTRAINT fk_schedule_sections_schedule
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_schedule_sections_section') THEN
    ALTER TABLE schedule_sections ADD CONSTRAINT fk_schedule_sections_section
      FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stages_department_id ON stages(department_id);
CREATE INDEX IF NOT EXISTS idx_sections_department_id ON sections(department_id);
CREATE INDEX IF NOT EXISTS idx_sections_stage_id ON sections(stage_id);
CREATE INDEX IF NOT EXISTS idx_subjects_department_id ON subjects(department_id);
CREATE INDEX IF NOT EXISTS idx_faculties_department_id ON faculties(department_id);
CREATE INDEX IF NOT EXISTS idx_faculties_college_id ON faculties(college_id);
CREATE INDEX IF NOT EXISTS idx_schedules_department_id ON schedules(department_id);
CREATE INDEX IF NOT EXISTS idx_schedules_faculty_id ON schedules(faculty_id);
CREATE INDEX IF NOT EXISTS idx_schedule_sections_schedule_id ON schedule_sections(schedule_id);
