import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
});

pool
  .getConnection()
  .then((conn) => {
    console.log("MySQL connected");
    conn.release();
  })
  .catch((err) => {
    console.error("MySQL error:", err.message);
    process.exit(1);
  });

export default pool;
