import { Request, Response } from "express";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import employeeRoutes from "./routes/employees";
import attendanceRoutes from "./routes/attendance";
import documentRoutes from "./routes/documents";
import workspaceRoutes from "./routes/workspaces";
import boardRoutes from "./routes/boards";
import taskRoutes from "./routes/tasks";
import dashboardRoutes from "./routes/dashboard";
import { notFound, errorHandler } from "./middleware/errorHandler";
import { initializeRBAC } from "./services/bootstrapService";
import { initializeUploadStorage, getUploadRoot } from "./utils/storage";

dotenv.config();

const app = express();

initializeUploadStorage();

app.use(
  cors({
    origin: (origin, callback) => {
      const rawAllowedOrigins =
        process.env["CLIENT_URLS"] ?? process.env["CLIENT_URL"] ?? "";
      const allowedOrigins = rawAllowedOrigins
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(
  "/uploads",
  express.static(getUploadRoot(), { index: false, fallthrough: true })
);

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "OK" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env["PORT"] || 5000;

const startServer = async () => {
  try {
    await initializeRBAC();
    app.listen(PORT, () => {
      console.log(`Сервер ${PORT} порт дээр ажиллаж байна.`);
    });
  } catch (error) {
    console.error("Сервер асаахад алдаа гарлаа:", error);
    process.exit(1);
  }
};

startServer();
