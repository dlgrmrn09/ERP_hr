import { PermissionRow } from "../middleware/auth";

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      firstName: string;
      lastName: string;
      roleId: number;
      roleName: string;
      permissions: PermissionRow[];
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
