import pool from "../config/db";

const roles = [
  { name: "Administrator", description: "Full access" },
  { name: "Director", description: "Leadership visibility" },
  { name: "HR Specialist", description: "HR operations without delete" },
];

const modulePermissions = {
  dashboard: ["read"],
  users: ["create", "read", "update", "delete"],
  employees: ["create", "read", "update", "delete"],
  attendance: ["create", "read", "update", "delete"],
  documents: ["create", "read", "update", "delete"],
  workspaces: ["create", "read", "update", "delete"],
  boards: ["create", "read", "update", "delete"],
  tasks: ["create", "read", "update", "delete"],
};

const hrAllowedActions = new Set(["create", "read", "update"]);
const hrAllowedModules = new Set([
  "dashboard",
  "employees",
  "attendance",
  "documents",
]);
const directorReadableModules = new Set([
  "dashboard",
  "employees",
  "attendance",
  "documents",
  "workspaces",
  "boards",
  "tasks",
]);

export const initializeRBAC = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const role of roles) {
      await client.query(
        `INSERT INTO roles (name, description)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description`,
        [role.name, role.description]
      );
    }

    for (const [module, actions] of Object.entries(modulePermissions)) {
      for (const action of actions) {
        await client.query(
          `INSERT INTO permissions (module, action)
           VALUES ($1, $2)
           ON CONFLICT (module, action) DO NOTHING`,
          [module, action]
        );
      }
    }

    const permissionsRes = await client.query(
      `SELECT permission_id, module, action FROM permissions`
    );
    const permissionsMap = new Map<string, number>();
    permissionsRes.rows.forEach((row) => {
      permissionsMap.set(`${row.module}:${row.action}`, row.permission_id);
    });

    const rolesRes = await client.query(
      `SELECT role_id, name FROM roles WHERE name = ANY($1)`,
      [roles.map((role) => role.name)]
    );
    const roleMap = new Map<string, number>();
    rolesRes.rows.forEach((row) => roleMap.set(row.name, row.role_id));

    for (const [module, actions] of Object.entries(modulePermissions)) {
      for (const action of actions) {
        const permissionKey = `${module}:${action}`;
        const permissionId = permissionsMap.get(permissionKey);
        if (!permissionId) {
          continue;
        }

        const adminRoleId = roleMap.get("Administrator");
        if (adminRoleId) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id)
             SELECT $1, $2
             WHERE NOT EXISTS (
               SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_id = $2
             )`,
            [adminRoleId, permissionId]
          );
        }

        const hrRoleId = roleMap.get("HR Specialist");
        if (
          hrRoleId &&
          hrAllowedModules.has(module) &&
          hrAllowedActions.has(action)
        ) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id)
             SELECT $1, $2
             WHERE NOT EXISTS (
               SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_id = $2
             )`,
            [hrRoleId, permissionId]
          );
        }

        const directorRoleId = roleMap.get("Director");
        if (
          directorRoleId &&
          action === "read" &&
          directorReadableModules.has(module)
        ) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id)
             SELECT $1, $2
             WHERE NOT EXISTS (
               SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_id = $2
             )`,
            [directorRoleId, permissionId]
          );
        }
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export default { initializeRBAC };
