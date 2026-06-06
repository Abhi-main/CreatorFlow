import pool from "../config/db.js";
import { sendInvite } from "../services/emailService.js";
import { asyncController, fail, getRoleId, ok, paged, pageParams, requireTeam } from "./_helpers.js";

export const getTeam = asyncController(async (req, res) => {
  await requireTeam(req.params.id, req.user);
  const [[team]] = await pool.query(
    `SELECT t.*, COUNT(tm.member_id) AS member_count
       FROM Teams t LEFT JOIN TeamMembers tm ON tm.team_id = t.team_id AND tm.status = 'active'
      WHERE t.team_id = ?
      GROUP BY t.team_id`,
    [req.params.id]
  );
  return ok(res, team, "Team fetched");
});

export const updateTeam = asyncController(async (req, res) => {
  await requireTeam(req.params.id, req.user);
  const [[team]] = await pool.query("SELECT owner_id FROM Teams WHERE team_id = ? LIMIT 1", [req.params.id]);
  if (Number(team?.owner_id) !== Number(req.user.sub || req.user.id)) return fail(res, "Only the owner can update team settings", 403);
  await pool.query("UPDATE Teams SET team_name = COALESCE(?, team_name), updated_at = UTC_TIMESTAMP() WHERE team_id = ?", [req.body.team_name || req.body.name || null, req.params.id]);
  return getTeam(req, res);
});

export const listMembers = asyncController(async (req, res) => {
  await requireTeam(req.params.id, req.user);
  const { page, limit, offset } = pageParams(req.query);
  const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM TeamMembers WHERE team_id = ? AND status = 'active'", [req.params.id]);
  const [rows] = await pool.query(
    `SELECT tm.member_id, tm.team_id, tm.user_id, tm.joined_at, tm.status,
            r.role_name,
            u.first_name, u.last_name, CONCAT(u.first_name, ' ', u.last_name) AS full_name,
            u.email, u.avatar_url
       FROM TeamMembers tm
       JOIN Users u ON u.user_id = tm.user_id
       JOIN Roles r ON r.role_id = tm.role_id
      WHERE tm.team_id = ? AND tm.status = 'active'
      ORDER BY tm.joined_at DESC
      LIMIT ? OFFSET ?`,
    [req.params.id, limit, offset]
  );
  return ok(res, paged(rows, total, page, limit), "Team members fetched");
});

export const inviteMember = asyncController(async (req, res) => {
  await requireTeam(req.params.id, req.user);
  const { email, role_name = "viewer", full_name } = req.body;
  const roleId = await getRoleId(role_name);
  if (!email || !roleId) return fail(res, "Valid email and role are required", 400);

  const [[team]] = await pool.query("SELECT team_name FROM Teams WHERE team_id = ? LIMIT 1", [req.params.id]);
  let [[user]] = await pool.query("SELECT user_id FROM Users WHERE email = ? LIMIT 1", [email]);
  if (!user) {
    const [created] = await pool.query(
      `INSERT INTO Users (role_id, team_id, first_name, last_name, email, password_hash, timezone, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, '', 'UTC', true, UTC_TIMESTAMP())`,
      [roleId, req.params.id, full_name || email.split("@")[0], "", email]
    );
    user = { user_id: created.insertId };
  }
  await pool.query(
    `INSERT INTO TeamMembers (team_id, user_id, role_id, joined_at, status)
     VALUES (?, ?, ?, UTC_TIMESTAMP(), 'active')
     ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), status = 'active'`,
    [req.params.id, user.user_id, roleId]
  );
  await sendInvite(email, team.team_name, `${process.env.FRONTEND_URL}/register`);
  return listMembers(req, res);
});

export const updateMemberRole = asyncController(async (req, res) => {
  await requireTeam(req.params.id, req.user);
  const roleId = await getRoleId(req.body.role_name || req.body.role);
  if (!roleId) return fail(res, "Invalid role", 400);
  await pool.query("UPDATE TeamMembers SET role_id = ? WHERE team_id = ? AND user_id = ?", [roleId, req.params.id, req.params.userId]);
  return ok(res, { updated: true }, "Role updated");
});

export const removeMember = asyncController(async (req, res) => {
  await requireTeam(req.params.id, req.user);
  const [[team]] = await pool.query("SELECT owner_id FROM Teams WHERE team_id = ? LIMIT 1", [req.params.id]);
  if (Number(team?.owner_id) === Number(req.params.userId)) return fail(res, "Cannot remove team owner", 400);
  await pool.query("UPDATE TeamMembers SET status = 'removed' WHERE team_id = ? AND user_id = ?", [req.params.id, req.params.userId]);
  return ok(res, {}, "Member removed");
});

export const getUsage = asyncController(async (req, res) => {
  await requireTeam(req.params.id, req.user);
  const [[[team]], [[members]], [[accounts]], [[posts]], [[storage]]] = await Promise.all([
    pool.query("SELECT max_members FROM Teams WHERE team_id = ? LIMIT 1", [req.params.id]),
    pool.query("SELECT COUNT(*) AS used FROM TeamMembers WHERE team_id = ? AND status = 'active'", [req.params.id]),
    pool.query("SELECT COUNT(*) AS used FROM SocialAccounts WHERE team_id = ? AND is_active = true", [req.params.id]),
    pool.query("SELECT COUNT(*) AS used FROM Posts WHERE team_id = ? AND created_at >= DATE_FORMAT(UTC_DATE(), '%Y-%m-01')", [req.params.id]),
    pool.query("SELECT COALESCE(SUM(size_bytes),0) AS used FROM MediaFiles WHERE team_id = ?", [req.params.id])
  ]);
  return ok(res, {
    members: { used: members.used, max: team.max_members || 5 },
    accounts: { used: accounts.used, max: 15 },
    postsThisMonth: { used: posts.used, max: 200 },
    storage: { used: storage.used, max: 1024 * 1024 * 1024 }
  }, "Usage fetched");
});
