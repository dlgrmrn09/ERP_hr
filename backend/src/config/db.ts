import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  user: process.env["DB_USER"],
  password: process.env["DB_PASSWORD"],
  host: process.env["DB_HOST"],
  port: process.env["DB_PORT"] ? Number(process.env["DB_PORT"]) : 5432,
  database: process.env["DB_NAME"],
});

pool.on("connect", () => {
  console.log("Датабазтай амжилттай холбогдлоо.");
});

pool.on("error", (err) => {
  console.error("Гэнэтийн алдаа гарлаа", err);
  process.exit(-1);
});

export default pool;
