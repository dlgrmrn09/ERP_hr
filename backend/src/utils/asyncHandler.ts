import { Request, Response, NextFunction, RequestHandler } from "express";

type Handler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown> | unknown;

export const asyncHandler = (fn: Handler): RequestHandler => {
  return (req, res, next) =>
    Promise.resolve()
      .then(() => fn(req, res, next))
      .catch(next);
};

export default asyncHandler;
