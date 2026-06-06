import { v4 as uuidv4 } from "uuid";
import pool from "../config/db.js";
import { syncAccount } from "../services/platformSync.js";
import { asyncController, ensureTeamAccount, ok } from "./_helpers.js";
import { emitToTeam } from "../socket/index.js";
import { EVENTS } from "../socket/events.js";

export const listAccounts = asyncController(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT sa.*, sa.account_id AS id, sa.account_handle AS handle,
            p.platform_id, p.name AS platform_name, p.icon AS platform_icon
       FROM SocialAccounts sa
       JOIN Platforms p ON p.platform_id = sa.platform_id
      WHERE sa.team_id = ? AND sa.is_active = true
      ORDER BY sa.created_at DESC`,
    [req.user.team_id]
  );
  const items = rows.map((row) => ({
    ...row,
    id: row.account_id,
    handle: row.account_handle,
    platform: {
      id: row.platform_id,
      name: row.platform_name,
      slug: String(row.platform_name || "").toLowerCase(),
      icon: row.platform_icon
    }
  }));

  return ok(res, { items, data: items, total: items.length }, "Accounts fetched");
});

export const createAccount = asyncController(async (req, res) => {
  const { platform_id, platform_slug, account_handle, account_name, account_type = "business" } = req.body;
  let platformId = platform_id;
  if (!platformId && platform_slug) {
    const [[platform]] = await pool.query("SELECT platform_id FROM Platforms WHERE LOWER(name) = LOWER(?) LIMIT 1", [platform_slug]);
    platformId = platform?.platform_id;
  }
  const [created] = await pool.query(
    `INSERT INTO SocialAccounts
       (team_id, platform_id, account_handle, account_name, account_type, access_token, follower_count, is_active, last_synced_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, true, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
    [req.user.team_id, platformId, account_handle || `@${account_name}`, account_name, account_type, uuidv4()]
  );
  req.params.id = created.insertId;
  const [[account]] = await pool.query("SELECT * FROM SocialAccounts WHERE account_id = ? LIMIT 1", [created.insertId]);
  return ok(res, account, "Account connected", 201);
});

export const deleteAccount = asyncController(async (req, res) => {
  await ensureTeamAccount(req.params.id, req.user.team_id);
  await pool.query("DELETE FROM SocialAccounts WHERE account_id = ? AND team_id = ?", [req.params.id, req.user.team_id]);
  return ok(res, {}, "Account disconnected");
});

export const sync = asyncController(async (req, res) => {
  await ensureTeamAccount(req.params.id, req.user.team_id);
  const result = await syncAccount(req.params.id);
  emitToTeam(req.io, req.user.team_id, EVENTS.FOLLOWERS_UPDATED, {
    accountId: Number(req.params.id),
    followerCount: result.followerCount,
    change: result.followerChange
  });
  emitToTeam(req.io, req.user.team_id, EVENTS.ANALYTICS_UPDATED, {
    accountId: Number(req.params.id),
    daily: result
  });
  return ok(res, result, "Sync complete");
});
