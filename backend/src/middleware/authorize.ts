import { Request, Response, NextFunction } from "express";

type Permission = { module: string; action: string };
type User = { roleName?: string; permissions?: Permission[] };

export const authorize = (moduleName: string, action: string) => {
  return (
    req: Request & { user?: User },
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    if (req.user.roleName === "Administrator") {
      return next();
    }

    const allowed = req.user.permissions?.some(
      (permission) =>
        permission.module === moduleName &&
        (permission.action === action || permission.action === "manage")
    );

    if (!allowed) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    return next();
  };
};

export default authorize;
