const ApiError = require("../../utils/ApiError");
const { parsePagination, paginate } = require("../../utils/pagination");
const {
  demoState,
  getUserById,
  getTeamById,
  getRoleById,
  getRoleByName,
  nextId,
  sanitizeUser,
  createNotification,
  createLog
} = require("./store");

function getProfile(userId) {
  const user = getUserById(userId);
  return sanitizeUser(user);
}

function updateProfile(userId, payload) {
  const user = getUserById(userId);

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  user.full_name = payload.full_name || user.full_name;
  user.avatar_url = payload.avatar_url ?? user.avatar_url;
  user.timezone = payload.timezone || user.timezone;

  createLog({
    source: "users",
    message: `User ${user.email} updated their profile.`,
    metadata: { userId: user.id }
  });

  return sanitizeUser(user);
}

function listTeamMembers(teamId, query) {
  const team = getTeamById(teamId);
  if (!team) {
    throw new ApiError(404, "Team not found.");
  }

  const { page, pageSize } = parsePagination(query);
  const members = demoState.teamMembers
    .filter((member) => Number(member.team_id) === Number(teamId) && member.status !== "removed")
    .map((member) => {
      const user = getUserById(member.user_id);
      return {
        ...member,
        user: sanitizeUser(user),
        role_name: getRoleById(member.role_id)?.name || "viewer",
        team_name: team.name
      };
    });

  return paginate(members, page, pageSize);
}

function inviteTeamMember(teamId, payload) {
  const team = getTeamById(teamId);
  if (!team) {
    throw new ApiError(404, "Team not found.");
  }

  const role = payload.role_name ? getRoleByName(payload.role_name) : getRoleById(payload.role_id);

  if (!role) {
    throw new ApiError(400, "A valid role is required.");
  }

  const existing = demoState.users.find((user) => user.email.toLowerCase() === payload.email.toLowerCase());

  let user = existing;
  if (!user) {
    user = {
      id: nextId("users"),
      role_id: role.id,
      team_id: team.id,
      full_name: payload.full_name,
      email: payload.email,
      password_hash: demoState.users[0].password_hash,
      avatar_url: "",
      timezone: payload.timezone || "UTC",
      status: "active"
    };
    demoState.users.push(user);
  }

  const existingMembership = demoState.teamMembers.find(
    (member) => Number(member.team_id) === Number(teamId) && Number(member.user_id) === Number(user.id)
  );

  if (existingMembership) {
    throw new ApiError(409, "That user is already a member of this team.");
  }

  const member = {
    id: nextId("teamMembers"),
    team_id: team.id,
    user_id: user.id,
    role_id: role.id,
    title: payload.title || role.name,
    status: "active"
  };

  demoState.teamMembers.push(member);
  user.team_id = team.id;
  user.role_id = role.id;

  createNotification({
    user_id: user.id,
    team_id: team.id,
    title: "You were added to a team",
    body: `You have been invited to ${team.name} as ${role.name}.`,
    variant: "success"
  });

  return {
    ...member,
    user: sanitizeUser(user),
    role_name: role.name
  };
}

function removeTeamMember(teamId, userId) {
  const membership = demoState.teamMembers.find(
    (member) => Number(member.team_id) === Number(teamId) && Number(member.user_id) === Number(userId)
  );

  if (!membership) {
    throw new ApiError(404, "Team member not found.");
  }

  membership.status = "removed";
  createLog({
    source: "teams",
    message: `Removed user ${userId} from team ${teamId}.`,
    metadata: { teamId, userId }
  });

  return { removed: true };
}

function updateTeamMemberRole(teamId, userId, roleName) {
  const membership = demoState.teamMembers.find(
    (member) => Number(member.team_id) === Number(teamId) && Number(member.user_id) === Number(userId)
  );

  if (!membership) {
    throw new ApiError(404, "Team member not found.");
  }

  const role = getRoleByName(roleName);
  if (!role) {
    throw new ApiError(400, "Invalid role name.");
  }

  membership.role_id = role.id;
  const user = getUserById(userId);
  user.role_id = role.id;

  return {
    updated: true,
    user: sanitizeUser(user),
    role_name: role.name
  };
}

module.exports = {
  getProfile,
  updateProfile,
  listTeamMembers,
  inviteTeamMember,
  removeTeamMember,
  updateTeamMemberRole
};
