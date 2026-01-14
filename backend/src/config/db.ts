import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

pool.on("connect", () => {
  console.log("Датабазтай амжилттай холбогдлоо.");
});

pool.on("error", (err) => {
  console.error("Алдаа гарлаа", err);
  process.exit(-1);
});

export default pool;
