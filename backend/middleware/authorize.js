export const authorize = (module, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    if (req.user.roleName === "Administrator") {
      return next();
    }

    const allowed = req.user.permissions?.some(
      (permission) =>
        permission.module === module &&
        (permission.action === action || permission.action === "manage")
    );

    if (!allowed) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    return next();
  };
};

export default { authorize };
