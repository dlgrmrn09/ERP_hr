

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;


CREATE TABLE roles (
  role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  UNIQUE (module, action)
);

CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
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
CREATE TABLE employees (
  employee_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email CITEXT UNIQUE NOT NULL,
  phone_number TEXT,
  gender VARCHAR(255),
  age INT,
  position_title TEXT,
  employment_status TEXT NOT NULL,
  start_date DATE,
  years_of_service NUMERIC(5, 2),
  cv_url TEXT,
  created_by UUID REFERENCES users(user_id),
  updated_by UUID REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX employees_search_idx ON employees USING gin (
  to_tsvector(
    'simple',
    coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(position_title, '')
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
CREATE TABLE school_profile (
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
CREATE TABLE attendance_records (
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

INSERT INTO document_categories (name)
VALUES ('Тушаал'), ('АБХ'), ('Дотоод журам')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE documents (
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
CREATE TABLE workspaces (
  workspace_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE boards (
  board_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(workspace_id),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE board_members (
  board_id UUID REFERENCES boards(board_id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(employee_id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, employee_id)
);

CREATE TABLE status_groups (
  status_group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(board_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0
);

CREATE TABLE tasks (
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

CREATE TABLE task_assignees (
  task_id UUID REFERENCES tasks(task_id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(employee_id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, employee_id)
);

CREATE TABLE task_activity (
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

-- Users
INSERT INTO users (email, password_hash, first_name, last_name, role_id, is_active)
VALUES
  (
    'admin@company.mn',
    crypt('Admin123!', gen_salt('bf')),
    'Админ',
    'Супер',
    (SELECT role_id FROM roles WHERE name = 'Системийн админ'),
    TRUE
  ),
  (
    'hr.manager@company.mn',
    crypt('HrManager123!', gen_salt('bf')),
    'Munkhzula',
    'Dalai',
    (SELECT role_id FROM roles WHERE name = 'Хүний нөөцийн менежер'),
    TRUE
  ),
  (
    'lead.dev@company.mn',
    crypt('LeadDev123!', gen_salt('bf')),
    'Temuulen',
    'Bat',
    (SELECT role_id FROM roles WHERE name = 'Багийн ахлагч'),
    TRUE
  ),
  (
    'finance.staff@company.mn',
    crypt('Finance123!', gen_salt('bf')),
    'Oyun',
    'Erdene',
    (SELECT role_id FROM roles WHERE name = 'Ерөнхий ажилтан'),
    TRUE
  ),
  (
    'developer.one@company.mn',
    crypt('DevOne123!', gen_salt('bf')),
    'Khatan',
    'Tugs',
    (SELECT role_id FROM roles WHERE name = 'Ерөнхий ажилтан'),
    TRUE
  ),
  (
    'developer.two@company.mn',
    crypt('DevTwo123!', gen_salt('bf')),
    'Sukhbat',
    'Enkh',
    (SELECT role_id FROM roles WHERE name = 'Ерөнхий ажилтан'),
    TRUE
  )
ON CONFLICT (email) DO NOTHING;

-- Employees
INSERT INTO employees (
  employee_code,
  user_id,
  first_name,
  last_name,
  email,
  phone_number,
  gender,
  age,
  position_title,
  employment_status,
  start_date,
  cv_url,
  created_by,
  updated_by
)
VALUES
  (
    'EMP-1001',
    (SELECT user_id FROM users WHERE email = 'hr.manager@company.mn'),
    'Munkhzula',
    'Dalai',
    'munkhzula.dalai@company.mn',
    '99112233',
    'Female',
    34,
    'Хүний нөөцийн шинжээч',
    'Байнга',
    DATE '2017-03-15',
    'https://example.com/cv/EMP-1001.pdf',
    (SELECT user_id FROM users WHERE email = 'admin@company.mn'),
    (SELECT user_id FROM users WHERE email = 'admin@company.mn')
  ),
  (
    'EMP-1002',
    (SELECT user_id FROM users WHERE email = 'lead.dev@company.mn'),
    'Temuulen',
    'Bat',
    'temuulen.bat@company.mn',
    '88119922',
    'Male',
    36,
    'Ахлах програм хангамжийн инженер',
    'Байнга',
    DATE '2015-09-01',
    'https://example.com/cv/EMP-1002.pdf',
    (SELECT user_id FROM users WHERE email = 'admin@company.mn'),
    (SELECT user_id FROM users WHERE email = 'admin@company.mn')
  ),
  (
    'EMP-1003',
    (SELECT user_id FROM users WHERE email = 'developer.one@company.mn'),
    'Khatan',
    'Tugs',
    'khatan.tugs@company.mn',
    '99118844',
    'Female',
    28,
    'Урд талын хөгжүүлэгч',
    'Байнга',
    DATE '2020-06-10',
    'https://example.com/cv/EMP-1003.pdf',
    (SELECT user_id FROM users WHERE email = 'lead.dev@company.mn'),
    (SELECT user_id FROM users WHERE email = 'lead.dev@company.mn')
  ),
  (
    'EMP-1004',
    NULL,
    'Bat-Orgil',
    'Enkh-Amgalan',
    'batorgil.enkhamgalan@company.mn',
    '95223344',
    'Male',
    23,
    'Хүний нөөцийн дадлагын оюутан',
    'Интерн',
    DATE '2024-09-01',
    NULL,
    (SELECT user_id FROM users WHERE email = 'hr.manager@company.mn'),
    (SELECT user_id FROM users WHERE email = 'hr.manager@company.mn')
  ),
  (
    'EMP-1005',
    (SELECT user_id FROM users WHERE email = 'finance.staff@company.mn'),
    'Oyun',
    'Erdene',
    'oyun.erdene@company.mn',
    '99001122',
    'Female',
    41,
    'Санхүүгийн менежер',
    'Байнга',
    DATE '2012-01-05',
    'https://example.com/cv/EMP-1005.pdf',
    (SELECT user_id FROM users WHERE email = 'admin@company.mn'),
    (SELECT user_id FROM users WHERE email = 'admin@company.mn')
  ),
  (
    'EMP-1006',
    NULL,
    'Sukhbat',
    'Enkh',
    'sukhbat.enkh@company.mn',
    '93112233',
    'Male',
    30,
    'Чанарын инженер',
    'Байнга',
    DATE '2019-03-18',
    NULL,
    (SELECT user_id FROM users WHERE email = 'lead.dev@company.mn'),
    (SELECT user_id FROM users WHERE email = 'lead.dev@company.mn')
  ),
  (
    'EMP-1007',
    NULL,
    'Saruul',
    'Erdenebat',
    'saruul.erdenebat@company.mn',
    '99119988',
    'Female',
    27,
    'Төслийн зохицуулагч',
    'Гэрээт',
    DATE '2023-02-01',
    NULL,
    (SELECT user_id FROM users WHERE email = 'lead.dev@company.mn'),
    (SELECT user_id FROM users WHERE email = 'lead.dev@company.mn')
  ),
  (
    'EMP-1008',
    NULL,
    'Ganbold',
    'Lkhagvasuren',
    'ganbold.lkhagvasuren@company.mn',
    '99118877',
    'Male',
    52,
    'Мэдээллийн технологийн захирал',
    'Байнга',
    DATE '2010-05-24',
    'https://example.com/cv/EMP-1008.pdf',
    (SELECT user_id FROM users WHERE email = 'admin@company.mn'),
    (SELECT user_id FROM users WHERE email = 'admin@company.mn')
  )
ON CONFLICT (employee_code) DO NOTHING;

-- Attendance records
WITH admin_user AS (
  SELECT user_id FROM users WHERE email = 'admin@company.mn'
),
attendance_rows AS (
  SELECT * FROM (
    VALUES
      ('EMP-1001', DATE '2025-09-02', 'On Time', 0, 60),
      ('EMP-1001', DATE '2025-10-05', 'Late', 12, 0),
      ('EMP-1001', DATE '2025-11-12', 'On Time', 0, 30),
      ('EMP-1002', DATE '2025-09-03', 'On Time', 0, 45),
      ('EMP-1002', DATE '2025-10-11', 'Late', 8, 15),
      ('EMP-1002', DATE '2025-11-07', 'On Time', 0, 60),
      ('EMP-1003', DATE '2025-09-04', 'On Time', 0, 25),
      ('EMP-1003', DATE '2025-10-15', 'Absent', 0, 0),
      ('EMP-1003', DATE '2025-11-18', 'On Time', 0, 40),
      ('EMP-1004', DATE '2025-09-05', 'Late', 15, 0),
      ('EMP-1004', DATE '2025-10-09', 'On Time', 0, 10),
      ('EMP-1004', DATE '2025-11-14', 'On Time', 0, 5),
      ('EMP-1005', DATE '2025-09-06', 'On Time', 0, 35),
      ('EMP-1005', DATE '2025-10-13', 'On Time', 0, 30),
      ('EMP-1005', DATE '2025-11-10', 'Late', 20, 0),
      ('EMP-1006', DATE '2025-09-07', 'Late', 18, 0),
      ('EMP-1006', DATE '2025-10-16', 'On Time', 0, 25),
      ('EMP-1006', DATE '2025-11-21', 'On Time', 0, 30),
      ('EMP-1007', DATE '2025-09-08', 'On Time', 0, 20),
      ('EMP-1007', DATE '2025-10-12', 'On Time', 0, 0),
      ('EMP-1007', DATE '2025-11-19', 'Late', 10, 0),
      ('EMP-1008', DATE '2025-09-09', 'On Time', 0, 50),
      ('EMP-1008', DATE '2025-10-20', 'On Time', 0, 45),
      ('EMP-1008', DATE '2025-11-25', 'On Time', 0, 60)
  ) AS t(employee_code, attendance_date, status, minutes_late, overtime_minutes)
)
INSERT INTO attendance_records (
  employee_id,
  attendance_date,
  status,
  minutes_late,
  overtime_minutes,
  created_by
)
SELECT e.employee_id,
     r.attendance_date,
     r.status,
     r.minutes_late,
     r.overtime_minutes,
     admin_user.user_id
FROM attendance_rows r
JOIN employees e ON e.employee_code = r.employee_code
CROSS JOIN admin_user
ON CONFLICT (employee_id, attendance_date) DO NOTHING;

-- Documents
INSERT INTO documents (
  category_id,
  title,
  description,
  file_url,
  file_size_bytes,
  uploaded_by
)
VALUES
  (
    (SELECT category_id FROM document_categories WHERE name = 'Тушаал'),
    '2025-2026 оны хичээлийн жилийн нээлтийн тушаал',
    'Сургалтын жилийн нээлтийн бэлтгэл, үүрэг хуваарийн тухай тушаал.',
    'https://example.com/docs/tushaal-2025.pdf',
    524288,
    (SELECT user_id FROM users WHERE email = 'hr.manager@company.mn')
  ),
  (
    (SELECT category_id FROM document_categories WHERE name = 'АБХ'),
    'АБХ-ны хуралдааны тэмдэглэл /11 дүгээр сар/',
    'Арга зүйн багийн хуралдаанаар баталсан сургалтын нийтлэг чиглэлүүд.',
    'https://example.com/docs/abh-minutes-nov.pdf',
    312000,
    (SELECT user_id FROM users WHERE email = 'lead.dev@company.mn')
  ),
  (
    (SELECT category_id FROM document_categories WHERE name = 'Дотоод журам'),
    'Сургуулийн дотоод журам (шинэчилсэн найруулга)',
    'Ажилтан, сурагчдын өдөр тутмын сахилга, хариуцлагын журам.',
    'https://example.com/docs/dotood-juram-2025.pdf',
    415000,
    (SELECT user_id FROM users WHERE email = 'admin@company.mn')
  )
ON CONFLICT DO NOTHING;

-- Workspaces and boards
INSERT INTO workspaces (name, description, created_by)
SELECT 'Сургалтын удирдлага', 'Ахлах сургуулийн сургалтын бодлого, хичээлийн хуваарь болон чанарын үнэлгээг хариуцна.', (SELECT user_id FROM users WHERE email = 'hr.manager@company.mn')
WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE name = 'Сургалтын удирдлага');

INSERT INTO workspaces (name, description, created_by)
SELECT 'Сургуулийн менежмент', 'Дотоод журам, арга хэмжээ болон багш ажилтны нөөцийг төлөвлөдөг удирдлагын нэгж.', (SELECT user_id FROM users WHERE email = 'lead.dev@company.mn')
WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE name = 'Сургуулийн менежмент');

INSERT INTO boards (workspace_id, name, description, created_by)
SELECT w.workspace_id, 'Хичээлийн жил 2025-2026 бэлтгэл', 'Хичээлийн жилийн төлөвлөлт, сургалтын хэрэглэгдэхүүн бэлтгэх ажлууд.', (SELECT user_id FROM users WHERE email = 'hr.manager@company.mn')
FROM workspaces w
WHERE w.name = 'Сургалтын удирдлага'
  AND NOT EXISTS (SELECT 1 FROM boards b WHERE b.name = 'Хичээлийн жил 2025-2026 бэлтгэл');

INSERT INTO boards (workspace_id, name, description, created_by)
SELECT w.workspace_id, 'Ахлах сургуулийн арга хэмжээ', 'Эцэг эхийн уулзалт, уралдаан тэмцээн болон төгсөлтийн үйл ажиллагааны бэлтгэл.', (SELECT user_id FROM users WHERE email = 'lead.dev@company.mn')
FROM workspaces w
WHERE w.name = 'Сургуулийн менежмент'
  AND NOT EXISTS (SELECT 1 FROM boards b WHERE b.name = 'Ахлах сургуулийн арга хэмжээ');

-- Status groups
INSERT INTO status_groups (board_id, name, position)
SELECT b.board_id, 'Backlog', 1
FROM boards b
WHERE b.name = 'Хичээлийн жил 2025-2026 бэлтгэл'
  AND NOT EXISTS (SELECT 1 FROM status_groups sg WHERE sg.board_id = b.board_id AND sg.name = 'Backlog');

INSERT INTO status_groups (board_id, name, position)
SELECT b.board_id, 'In Progress', 2
FROM boards b
WHERE b.name = 'Хичээлийн жил 2025-2026 бэлтгэл'
  AND NOT EXISTS (SELECT 1 FROM status_groups sg WHERE sg.board_id = b.board_id AND sg.name = 'In Progress');

INSERT INTO status_groups (board_id, name, position)
SELECT b.board_id, 'Done', 3
FROM boards b
WHERE b.name = 'Хичээлийн жил 2025-2026 бэлтгэл'
  AND NOT EXISTS (SELECT 1 FROM status_groups sg WHERE sg.board_id = b.board_id AND sg.name = 'Done');

INSERT INTO status_groups (board_id, name, position)
SELECT b.board_id, 'Backlog', 1
FROM boards b
WHERE b.name = 'Ахлах сургуулийн арга хэмжээ'
  AND NOT EXISTS (SELECT 1 FROM status_groups sg WHERE sg.board_id = b.board_id AND sg.name = 'Backlog');

INSERT INTO status_groups (board_id, name, position)
SELECT b.board_id, 'In Progress', 2
FROM boards b
WHERE b.name = 'Ахлах сургуулийн арга хэмжээ'
  AND NOT EXISTS (SELECT 1 FROM status_groups sg WHERE sg.board_id = b.board_id AND sg.name = 'In Progress');

INSERT INTO status_groups (board_id, name, position)
SELECT b.board_id, 'Done', 3
FROM boards b
WHERE b.name = 'Ахлах сургуулийн арга хэмжээ'
  AND NOT EXISTS (SELECT 1 FROM status_groups sg WHERE sg.board_id = b.board_id AND sg.name = 'Done');

-- Board members
INSERT INTO board_members (board_id, employee_id)
SELECT b.board_id, e.employee_id
FROM boards b
JOIN employees e ON e.employee_code IN ('EMP-1001', 'EMP-1004')
WHERE b.name = 'Хичээлийн жил 2025-2026 бэлтгэл'
ON CONFLICT DO NOTHING;

INSERT INTO board_members (board_id, employee_id)
SELECT b.board_id, e.employee_id
FROM boards b
JOIN employees e ON e.employee_code IN ('EMP-1002', 'EMP-1003', 'EMP-1006', 'EMP-1007')
WHERE b.name = 'Ахлах сургуулийн арга хэмжээ'
ON CONFLICT DO NOTHING;

-- Tasks
INSERT INTO tasks (
  board_id,
  status_group_id,
  title,
  task_group,
  description,
  planned_start_date,
  planned_end_date,
  status,
  created_by,
  updated_by
)
SELECT
  b.board_id,
  sg.status_group_id,
  'Шинэ багш нарын чиглүүлэх сургалт',
  'Сургалтын бэлтгэл',
  'Шинэ багш нарт зориулсан чиглүүлэх сургалтын материал, хөтөлбөрийг бэлтгэх.',
  DATE '2025-09-01',
  DATE '2025-09-10',
  'Working On It',
  (SELECT user_id FROM users WHERE email = 'hr.manager@company.mn'),
  (SELECT user_id FROM users WHERE email = 'hr.manager@company.mn')
FROM boards b
JOIN status_groups sg ON sg.board_id = b.board_id AND sg.name = 'In Progress'
WHERE b.name = 'Хичээлийн жил 2025-2026 бэлтгэл'
  AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.title = 'Шинэ багш нарын чиглүүлэх сургалт');

INSERT INTO tasks (
  board_id,
  status_group_id,
  title,
  task_group,
  description,
  planned_start_date,
  planned_end_date,
  status,
  created_by,
  updated_by
)
SELECT
  b.board_id,
  sg.status_group_id,
  'Цалин хөлсний мэдээлэл баталгаажуулах',
  'Санхүү',
  'Шинээр томилогдсон ажилтнуудын цалин, нийгмийн даатгалын мэдээллийг системд баталгаажуулах.',
  DATE '2025-09-05',
  DATE '2025-09-15',
  'Done',
  (SELECT user_id FROM users WHERE email = 'hr.manager@company.mn'),
  (SELECT user_id FROM users WHERE email = 'hr.manager@company.mn')
FROM boards b
JOIN status_groups sg ON sg.board_id = b.board_id AND sg.name = 'Done'
WHERE b.name = 'Хичээлийн жил 2025-2026 бэлтгэл'
  AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.title = 'Цалин хөлсний мэдээлэл баталгаажуулах');

INSERT INTO tasks (
  board_id,
  status_group_id,
  title,
  task_group,
  description,
  planned_start_date,
  planned_end_date,
  status,
  created_by,
  updated_by
)
SELECT
  b.board_id,
  sg.status_group_id,
  'Эцэг эхийн зөвлөлийн уулзалтыг зохион байгуулах',
  'Захиргаа',
  'Эцэг эхийн зөвлөлийн намрын уулзалтын танхим, илтгэгч, мэдээллийн материал бэлтгэх.',
  DATE '2025-09-08',
  DATE '2025-09-29',
  'Working On It',
  (SELECT user_id FROM users WHERE email = 'lead.dev@company.mn'),
  (SELECT user_id FROM users WHERE email = 'lead.dev@company.mn')
FROM boards b
JOIN status_groups sg ON sg.board_id = b.board_id AND sg.name = 'In Progress'
WHERE b.name = 'Ахлах сургуулийн арга хэмжээ'
  AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.title = 'Эцэг эхийн зөвлөлийн уулзалтыг зохион байгуулах');

INSERT INTO tasks (
  board_id,
  status_group_id,
  title,
  task_group,
  description,
  planned_start_date,
  planned_end_date,
  status,
  created_by,
  updated_by
)
SELECT
  b.board_id,
  sg.status_group_id,
  'Лабораторийн тоног төхөөрөмжийн сорил',
  'Тоног төхөөрөмж',
  'Шинэчилсэн лабораторийн тоног төхөөрөмжийн аюулгүй ажиллагааны сорил хийх.',
  DATE '2025-09-20',
  DATE '2025-10-05',
  'Working On It',
  (SELECT user_id FROM users WHERE email = 'lead.dev@company.mn'),
  (SELECT user_id FROM users WHERE email = 'lead.dev@company.mn')
FROM boards b
JOIN status_groups sg ON sg.board_id = b.board_id AND sg.name = 'In Progress'
WHERE b.name = 'Ахлах сургуулийн арга хэмжээ'
  AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.title = 'Лабораторийн тоног төхөөрөмжийн сорил');

INSERT INTO tasks (
  board_id,
  status_group_id,
  title,
  task_group,
  description,
  planned_start_date,
  planned_end_date,
  status,
  created_by,
  updated_by
)
SELECT
  b.board_id,
  sg.status_group_id,
  'Сургалтын тайлан боловсруулах',
  'Сургалтын бодлого',
  'Хичээлийн жилийн завсрын тайлан, чанарын үзүүлэлтүүдийг нэгтгэн боловсруулах.',
  DATE '2025-09-25',
  DATE '2025-10-02',
  'Done',
  (SELECT user_id FROM users WHERE email = 'lead.dev@company.mn'),
  (SELECT user_id FROM users WHERE email = 'lead.dev@company.mn')
FROM boards b
JOIN status_groups sg ON sg.board_id = b.board_id AND sg.name = 'Done'
WHERE b.name = 'Ахлах сургуулийн арга хэмжээ'
  AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.title = 'Сургалтын тайлан боловсруулах');

-- Task assignees
INSERT INTO task_assignees (task_id, employee_id)
SELECT t.task_id, e.employee_id
FROM tasks t
JOIN employees e ON e.employee_code IN ('EMP-1001', 'EMP-1004')
WHERE t.title = 'Шинэ багш нарын чиглүүлэх сургалт'
ON CONFLICT DO NOTHING;

INSERT INTO task_assignees (task_id, employee_id)
SELECT t.task_id, e.employee_id
FROM tasks t
JOIN employees e ON e.employee_code = 'EMP-1005'
WHERE t.title = 'Цалин хөлсний мэдээлэл баталгаажуулах'
ON CONFLICT DO NOTHING;

INSERT INTO task_assignees (task_id, employee_id)
SELECT t.task_id, e.employee_id
FROM tasks t
JOIN employees e ON e.employee_code IN ('EMP-1002', 'EMP-1003')
WHERE t.title = 'Эцэг эхийн зөвлөлийн уулзалтыг зохион байгуулах'
ON CONFLICT DO NOTHING;

INSERT INTO task_assignees (task_id, employee_id)
SELECT t.task_id, e.employee_id
FROM tasks t
JOIN employees e ON e.employee_code IN ('EMP-1006', 'EMP-1007')
WHERE t.title = 'Лабораторийн тоног төхөөрөмжийн сорил'
ON CONFLICT DO NOTHING;

INSERT INTO task_assignees (task_id, employee_id)
SELECT t.task_id, e.employee_id
FROM tasks t
JOIN employees e ON e.employee_code = 'EMP-1002'
WHERE t.title = 'Сургалтын тайлан боловсруулах'
ON CONFLICT DO NOTHING;

-- Task activity
INSERT INTO task_activity (task_id, actor_id, action, detail)
SELECT
  t.task_id,
  (SELECT user_id FROM users WHERE email = 'hr.manager@company.mn'),
  'status_changed',
  jsonb_build_object('from', 'Backlog', 'to', 'In Progress', 'note', 'Чиглүүлэх сургалтын материал бэлтгэлийг эхлүүллээ')
FROM tasks t
WHERE t.title = 'Шинэ багш нарын чиглүүлэх сургалт'
  AND NOT EXISTS (
    SELECT 1 FROM task_activity a WHERE a.task_id = t.task_id AND a.action = 'status_changed'
  );

INSERT INTO task_activity (task_id, actor_id, action, detail)
SELECT
  t.task_id,
  (SELECT user_id FROM users WHERE email = 'lead.dev@company.mn'),
  'comment_added',
  jsonb_build_object('message', 'Эцэг эхийн зөвлөлийн уулзалтын танхим бэлтгэгдэж, илтгэгчдийн жагсаалт баталгаажлаа.')
FROM tasks t
WHERE t.title = 'Эцэг эхийн зөвлөлийн уулзалтыг зохион байгуулах'
  AND NOT EXISTS (
    SELECT 1 FROM task_activity a WHERE a.task_id = t.task_id AND a.action = 'comment_added'
  );
SELECT * FROM users;