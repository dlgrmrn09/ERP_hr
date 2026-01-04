import { Request, Response, NextFunction } from "express";

type HttpError = Error & { status?: number; details?: any };

export const notFound = (req: Request, _res: Response, next: NextFunction) => {
  const error: HttpError = new Error(`Not Found - ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

export const errorHandler = (
  err: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || "Internal server error",
    details: err.details,
  });
};

export default { notFound, errorHandler };
