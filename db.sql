CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;


CREATE TABLE IF NOT EXISTS "roles" (
  role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  UNIQUE (module, action)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(role_id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  employee_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email CITEXT UNIQUE NOT NULL,
  phone_number TEXT UNIQUE,
  gender VARCHAR(255),
  age INT,
  position_title JSONB,
  employment_status TEXT NOT NULL,
  start_date DATE,
  years_of_service NUMERIC(5, 2),
  cv_url TEXT,
  photo_url TEXT,
  created_by UUID REFERENCES users(user_id),
  updated_by UUID REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS salaries (
  salary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(employee_id),
  salary_amount NUMERIC(10, 2),
  kpi NUMERIC(5, 2),
  salary_bonus NUMERIC(10, 2),
  overtime NUMERIC(10, 2),
  penalty NUMERIC(10, 2),
  salary_first NUMERIC(10, 2),
  salary_last NUMERIC(10, 2),
  salary_date_first DATE NOT NULL,
  salary_date_last DATE NOT NULL,
  created_by UUID REFERENCES users(user_id),
  updated_by UUID REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX employees_search_idx ON employees USING gin (
  to_tsvector(
    'simple',
    coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(position_title->>'title', '')
  )
);
CREATE INDEX employees_status_idx ON employees (employment_status) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION employees_set_years_of_service()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.start_date IS NOT NULL THEN
    NEW.years_of_service := ROUND(EXTRACT(EPOCH FROM age(current_date, NEW.start_date)) / 31557600.0, 2);
  ELSE
    NEW.years_of_service := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER employees_set_years_of_service_biu
BEFORE INSERT OR UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION employees_set_years_of_service();

-- School profile information
CREATE TABLE IF NOT EXISTS school_profile (
  school_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  total_employees INT NOT NULL CHECK (total_employees > 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO school_profile (name, type, total_employees, description)
VALUES (
  'Эрдмийн Оргил Ахлах Сургууль',
  'ЕБС-ийн ахлах түвшин',
  350,
  'Улаанбаатар хотод байрлах, 350 багш ажилтантай ахлах сургууль. Энд сургалтын төлөвлөлт, хичээлийн чанарын үнэлгээ, сурагчдын хөгжлийн ажлуудыг төвлөрүүлсэн мэдээллийн систем ашигладаг.'
)
ON CONFLICT (name) DO NOTHING;

-- Attendance
CREATE TABLE IF NOT EXISTS attendance_records (
  attendance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(employee_id),
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('On Time', 'Late', 'Absent')),
  minutes_late INT DEFAULT 0 CHECK (minutes_late >= 0),
  overtime_minutes INT DEFAULT 0 CHECK (overtime_minutes >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(user_id),
  UNIQUE (employee_id, attendance_date)
);

CREATE OR REPLACE VIEW attendance_employee_aggregates AS
SELECT
  employee_id,
  COUNT(*) FILTER (WHERE status = 'Late') AS total_late,
  COUNT(*) FILTER (WHERE status = 'Absent') AS total_absent,
  SUM(overtime_minutes) AS total_overtime_minutes
FROM attendance_records
GROUP BY employee_id;

-- Documents
CREATE TABLE document_categories (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE  IF NOT EXISTS documents (
  document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES document_categories(category_id),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  uploaded_by UUID NOT NULL REFERENCES users(user_id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX documents_search_idx ON documents USING gin (
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
);

-- Task Management
CREATE TABLE IF NOT EXISTS workspaces (
  workspace_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE  IF NOT EXISTS boards (
  board_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(workspace_id),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS board_members (
  board_id UUID REFERENCES boards(board_id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(employee_id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, employee_id)
);

CREATE TABLE IF NOT EXISTS status_groups (
  status_group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(board_id),
  status_group_id UUID REFERENCES status_groups(status_group_id),
  title TEXT NOT NULL,
  task_group TEXT,
  description TEXT,
  planned_start_date DATE,
  planned_end_date DATE,
  status TEXT,
  created_by UUID REFERENCES users(user_id),
  updated_by UUID REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS task_assignees (
  task_id UUID REFERENCES tasks(task_id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(employee_id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, employee_id)
);

CREATE TABLE IF NOT EXISTS task_activity (
  activity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(user_id),
  action TEXT NOT NULL,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tasks_search_idx ON tasks USING gin (
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
);
CREATE INDEX boards_name_idx ON boards (lower(name));
CREATE INDEX tasks_status_idx ON tasks (status);

-- Audit triggers (example)
CREATE OR REPLACE FUNCTION set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_timestamp();
CREATE TRIGGER set_timestamp_employees BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION set_timestamp();
CREATE TRIGGER set_timestamp_documents BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION set_timestamp();
CREATE TRIGGER set_timestamp_workspaces BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION set_timestamp();
CREATE TRIGGER set_timestamp_boards BEFORE UPDATE ON boards FOR EACH ROW EXECUTE FUNCTION set_timestamp();
CREATE TRIGGER set_timestamp_tasks BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_timestamp();

-- Seed data for development and testing

-- Roles
INSERT INTO roles (name, description)
VALUES
  ('Системийн админ', 'Системийн бүх эрхийг бүрэн эдэлдэг админууд'),
  ('Хүний нөөцийн менежер', 'Ажилтан, баримт бичгийн бүртгэлийг хариуцна'),
  ('Багийн ахлагч', 'Самбар, даалгаврын хэрэгжилтийг удирдана'),
  ('Ерөнхий ажилтан', 'Ердийн хэрэглэгчийн харах боломжтой эрх')
ON CONFLICT (name) DO NOTHING;

-- Permissions
INSERT INTO permissions (module, action)
VALUES
  ('dashboard', 'read'),
  ('employees', 'read'),
  ('employees', 'manage'),
  ('documents', 'read'),
  ('documents', 'upload'),
  ('tasks', 'read'),
  ('tasks', 'manage'),
  ('boards', 'read'),
  ('boards', 'manage')
ON CONFLICT (module, action) DO NOTHING;

-- Role permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Системийн админ'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p ON p.module IN ('employees', 'documents', 'dashboard')
WHERE r.name = 'Хүний нөөцийн менежер'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p ON p.module IN ('tasks', 'boards', 'documents')
WHERE r.name = 'Багийн ахлагч'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p ON (p.module, p.action) IN (('dashboard', 'read'), ('documents', 'read'))
WHERE r.name = 'Ерөнхий ажилтан'
ON CONFLICT (role_id, permission_id) DO NOTHING;
