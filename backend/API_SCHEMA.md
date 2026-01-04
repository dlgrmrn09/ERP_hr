# ERP HR Module Backend Reference

## API Overview

- Base URL: `http://localhost:5000/api` (override with `PORT` and `VITE_API_BASE_URL`).
- Responses are JSON; pagination results include `data` and `pagination` with `page`, `pageSize`, `total`, `totalPages`.
- Authentication: HTTP-only `token` cookie issued at login; Bearer tokens also accepted.
- Authorization: Role and permission checks enforced through `authorize(module, action)` middleware.

## Authentication & Session

| Method | Path                    | Purpose                                       | Access          |
| ------ | ----------------------- | --------------------------------------------- | --------------- |
| POST   | /auth/bootstrap         | One-time administrator registration           | Public          |
| POST   | /auth/register/director | Register director (single account)            | Logged-in admin |
| POST   | /auth/register/hr       | Register HR specialist                        | Logged-in admin |
| POST   | /auth/login             | Issue session token                           | Public          |
| GET    | /auth/me                | Return authenticated profile with permissions | Authenticated   |
| POST   | /auth/logout            | Clear session token                           | Authenticated   |

### Git Bash quick-start commands

Run the following `curl` helpers inside Git Bash (Windows) or any POSIX shell to seed core accounts. Adjust the sample data as needed.

```bash
# point to your backend (defaults to http://localhost:5000)
API_BASE=${API_BASE:-http://localhost:5000/api}

# 1) One-time administrator bootstrap (creates the very first superuser)
curl -X POST "$API_BASE/auth/bootstrap" \
	-H "Content-Type: application/json" \
	-c cookies.txt \
	-d '{
				"firstName": "Админ",
				"lastName": "Супер",
				"email": "admin@example.mn",
				"password": "ChangeMe123!"
			}'

# 2) Register the Director (requires logged-in admin cookie)
curl -X POST "$API_BASE/auth/register/director" \
	-H "Content-Type: application/json" \
	-b cookies.txt -c cookies.txt \
	-d '{
				"firstName": "Захирал",
				"lastName": "Бат",
				"email": "director@example.mn",
				"password": "ChangeMe123!"
			}'

# 3) Register an HR specialist (also requires admin session cookie)
curl -X POST "$API_BASE/auth/register/hr" \
	-H "Content-Type: application/json" \
	-b cookies.txt -c cookies.txt \
	-d '{
				"firstName": "Хүний",
				"lastName": "Нөөц",
				"email": "hr@example.mn",
				"password": "ChangeMe123!"
			}'
```

> Tip: `cookies.txt` captures the session token issued by `/auth/bootstrap` so the subsequent registration calls reuse the authenticated admin session.

## Dashboard

| Method | Path               | Purpose                                                        | Required permission |
| ------ | ------------------ | -------------------------------------------------------------- | ------------------- |
| GET    | /dashboard/summary | Aggregated metrics for employees, attendance, documents, tasks | dashboard:read      |

## Employees

| Method | Path           | Purpose                                                             | Required permission |
| ------ | -------------- | ------------------------------------------------------------------- | ------------------- |
| GET    | /employees     | Paginated list with filters (search, status, position, start dates) | employees:read      |
| POST   | /employees     | Create employee record                                              | employees:create    |
| GET    | /employees/:id | Fetch single employee with attendance aggregates                    | employees:read      |
| PATCH  | /employees/:id | Update employee fields (code, contact, status, etc.)                | employees:update    |
| DELETE | /employees/:id | Soft delete employee                                                | employees:delete    |

## Attendance & Time Tracking

| Method | Path                               | Purpose                                                                                  | Required permission |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------------------- | ------------------- |
| GET    | /attendance                        | Paginated attendance records (filters: employeeId, status, month, dateFrom/dateTo, sort) | attendance:read     |
| POST   | /attendance                        | Create attendance record; prevents duplicates per employee/date                          | attendance:create   |
| GET    | /attendance/:id                    | Read single attendance record                                                            | attendance:read     |
| PATCH  | /attendance/:id                    | Update status, minutes late, overtime, notes                                             | attendance:update   |
| GET    | /attendance/aggregates/:employeeId | Summaries per employee (late, absent, overtime)                                          | attendance:read     |
| POST   | /attendance/refresh                | Placeholder hook for recalculating aggregates                                            | attendance:update   |

## Documents

| Method | Path           | Purpose                                             | Required permission |
| ------ | -------------- | --------------------------------------------------- | ------------------- |
| GET    | /documents     | Paginated library (filters: search, category, sort) | documents:read      |
| POST   | /documents     | Upload PDF and metadata (multipart field `file`)    | documents:create    |
| GET    | /documents/:id | Fetch single document metadata                      | documents:read      |
| PATCH  | /documents/:id | Update metadata and optionally replace file         | documents:update    |
| DELETE | /documents/:id | Soft delete document                                | documents:delete    |

## Workspaces & Boards

| Method | Path                                 | Purpose                                  | Required permission |
| ------ | ------------------------------------ | ---------------------------------------- | ------------------- |
| GET    | /workspaces                          | List workspaces with pagination controls | workspaces:read     |
| POST   | /workspaces                          | Create workspace                         | workspaces:create   |
| PATCH  | /workspaces/:id                      | Update workspace metadata                | workspaces:update   |
| DELETE | /workspaces/:id                      | Soft delete workspace                    | workspaces:delete   |
| GET    | /boards                              | List boards (filter by workspaceId)      | boards:read         |
| POST   | /boards                              | Create board under workspace             | boards:create       |
| PATCH  | /boards/:id                          | Update board metadata                    | boards:update       |
| DELETE | /boards/:id                          | Soft delete board                        | boards:delete       |
| POST   | /boards/:id/members                  | Add board member (employee)              | boards:update       |
| DELETE | /boards/:id/members/:employeeId      | Remove member                            | boards:update       |
| GET    | /boards/:boardId/status-groups       | List status groups for board             | boards:read         |
| POST   | /boards/:boardId/status-groups       | Create status group                      | boards:update       |
| PATCH  | /boards/status-groups/:statusGroupId | Update status group name/order           | boards:update       |
| DELETE | /boards/status-groups/:statusGroupId | Delete status group                      | boards:delete       |

## Tasks & Activity

| Method | Path                | Purpose                                                                    | Required permission |
| ------ | ------------------- | -------------------------------------------------------------------------- | ------------------- |
| GET    | /tasks              | Paginated board tasks (filters: boardId, status, assigneeId, search, sort) | tasks:read          |
| POST   | /tasks              | Create task on board; accepts statusGroupId and assigneeIds                | tasks:create        |
| PATCH  | /tasks/:id          | Update task metadata and assignments                                       | tasks:update        |
| DELETE | /tasks/:id          | Soft delete task                                                           | tasks:delete        |
| GET    | /tasks/:id/activity | Task activity feed                                                         | tasks:read          |
| POST   | /tasks/:id/activity | Append activity entry                                                      | tasks:update        |

## User Administration

| Method | Path       | Purpose                                                       | Required permission |
| ------ | ---------- | ------------------------------------------------------------- | ------------------- |
| GET    | /users     | Paginated directory (filters: search, role, isActive)         | users:read          |
| POST   | /users     | Create user with role assignment                              | users:create        |
| GET    | /users/:id | Fetch user profile                                            | users:read          |
| PATCH  | /users/:id | Update name, role, active state (role safety checks enforced) | users:update        |
| DELETE | /users/:id | Deactivate user (ensures another admin remains active)        | users:delete        |

## Database Schema Overview

Core Authentication & RBAC

- roles: role_id (PK), name, created_at, updated_at.
- permissions: permission_id (PK), module, action.
- role_permissions: role_id (FK), permission_id (FK).
- users: user_id (PK), email, password_hash, first_name, last_name, role_id (FK), is_active, created_at, updated_at.

Employee Management

- employees: employee_id (PK), employee_code, first_name, last_name, email, phone_number, position_title, employment_status, start_date, years_of_service, cv_url, created_by, updated_by, created_at, updated_at, deleted_at.
- attendance_employee_aggregates: employee_id (PK, FK), total_late, total_absent, total_overtime_minutes, refreshed_at.

Time Tracking

- attendance_records: attendance_id (PK), employee_id (FK), attendance_date, status, minutes_late, overtime_minutes, notes, created_by, created_at, updated_at.

Document Repository

- document_categories: category_id (PK), name, created_at.
- documents: document_id (PK), category_id (FK), title, description, file_url, file_size_bytes, uploaded_by (FK users), uploaded_at, updated_at, deleted_at.

Task Management

- workspaces: workspace_id (PK), name, description, created_by, created_at, updated_at, deleted_at.
- boards: board_id (PK), workspace_id (FK), name, description, created_by, created_at, updated_at, deleted_at.
- board_members: board_id (FK), employee_id (FK), added_at.
- status_groups: status_group_id (PK), board_id (FK), name, position, created_at, updated_at.
- tasks: task_id (PK), board_id (FK), status_group_id (nullable FK), title, task_group, description, planned_start_date, planned_end_date, status, created_by, updated_by, created_at, updated_at, deleted_at.
- task_assignees: task_id (FK), employee_id (FK), assigned_at.
- task_activity: activity_id (PK), task_id (FK), actor_id (FK users), action, detail, created_at.

Supporting Tables & Utilities

- dashboard metrics assembled from employees, attendance_records, documents, tasks.
- uploads served from `/uploads` directory managed via `utils/storage.js`.

## Notes

- Soft-deleted rows retain historical data via `deleted_at` and are filtered in list endpoints.
- Most create/update routes rely on authenticated user context (`req.user.id`) for audit columns.
- Numeric fields such as `minutes_late` and `overtime_minutes` must be non-negative integers.
