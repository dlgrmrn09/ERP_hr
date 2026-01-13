import { Request, Response, NextFunction } from "express";
import type { MulterError } from "multer";

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

  // Normalize Multer errors to 400 responses.
  const multerError = err as MulterError;
  if (multerError && typeof multerError === "object" && "code" in multerError) {
    const code = (multerError as MulterError).code;
    const messageByCode: Record<string, string> = {
      LIMIT_FILE_SIZE: "Файлын хэмжээ хэтэрсэн байна.",
      LIMIT_UNEXPECTED_FILE: "Файлын талбар буруу байна.",
      LIMIT_PART_COUNT: "Хэт олон хэсэгтэй хүсэлт байна.",
      LIMIT_FILE_COUNT: "Хэт олон файл байна.",
      LIMIT_FIELD_KEY: "Талбарын нэр хэт урт байна.",
      LIMIT_FIELD_VALUE: "Талбарын утга хэт урт байна.",
      LIMIT_FIELD_COUNT: "Талбарын тоо хэтэрсэн байна.",
    };

    return res.status(400).json({
      message:
        messageByCode[code] ||
        multerError.message ||
        "Файл оруулахад алдаа гарлаа.",
      details: err.details,
    });
  }

  // File filter errors should be treated as 400.
  const inferredStatus =
    err.status ||
    (typeof err.message === "string" && err.message.startsWith("Зөвхөн")
      ? 400
      : 500);

  return res.status(inferredStatus).json({
    message: err.message || "Internal server error",
    details: err.details,
  });
};

export default { notFound, errorHandler };
