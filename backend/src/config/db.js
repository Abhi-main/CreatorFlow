const mysql = require("mysql2/promise");
const env = require("./env");

let pool;

function isMysqlMode() {
  return env.appMode === "mysql";
}

function getPool() {
  if (!isMysqlMode()) {
    return null;
  }

  if (!pool) {
    pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      database: env.db.name,
      user: env.db.user,
      password: env.db.password,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true
    });
  }

  return pool;
}

async function query(sql, params = []) {
  const connectionPool = getPool();

  if (!connectionPool) {
    throw new Error("MySQL mode is disabled. Set APP_MODE=mysql to use the database.");
  }

  const [rows] = await connectionPool.execute(sql, params);
  return rows;
}

async function callProcedure(name, params = []) {
  const connectionPool = getPool();

  if (!connectionPool) {
    throw new Error("MySQL mode is disabled. Stored procedures are unavailable in demo mode.");
  }

  const placeholders = params.map(() => "?").join(", ");
  const statement = `CALL ${name}(${placeholders})`;
  const [rows] = await connectionPool.query(statement, params);
  return rows;
}

module.exports = {
  isMysqlMode,
  getPool,
  query,
  callProcedure
};
