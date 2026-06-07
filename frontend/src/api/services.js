import api from "./api";

function unwrap(response) {
  return response.data.data;
}

export const authApi = {
  login: (payload) => api.post("/auth/login", payload).then(unwrap),
  register: (payload) => api.post("/auth/register", payload).then(unwrap),
  refresh: () => api.post("/auth/refresh").then(unwrap),
  logout: () => api.post("/auth/logout").then(unwrap)
};

export const usersApi = {
  getMe: () => api.get("/users/me").then(unwrap),
  updateMe: (payload) => api.put("/users/me", payload).then(unwrap)
};

export const accountsApi = {
  list: (params = {}) => api.get("/accounts", { params }).then(unwrap),
  create: (payload) => api.post("/accounts", payload).then(unwrap),
  getMetaConnectUrl: (platform) => api.get("/accounts/meta/connect", { params: { platform } }).then(unwrap),
  remove: (id) => api.delete(`/accounts/${id}`).then(unwrap),
  sync: (id) => api.post(`/accounts/${id}/sync`).then(unwrap)
};

export const postsApi = {
  list: (params = {}) => api.get("/posts", { params }).then(unwrap),
  get: (id) => api.get(`/posts/${id}`).then(unwrap),
  create: (payload) => api.post("/posts", payload).then(unwrap),
  update: (id, payload) => api.put(`/posts/${id}`, payload).then(unwrap),
  remove: (id) => api.delete(`/posts/${id}`).then(unwrap),
  publishNow: (id) => api.post(`/posts/${id}/publish-now`).then(unwrap)
};

export const schedulesApi = {
  createRecurring: (payload) => api.post("/schedules/recurring", payload).then(unwrap),
  listRecurring: () => api.get("/schedules/recurring").then(unwrap)
};

export const analyticsApi = {
  dashboard: () => api.get("/analytics/dashboard").then(unwrap),
  posts: (accountId) => api.get(`/analytics/posts/${accountId}`).then(unwrap),
  daily: (accountId, params = {}) => api.get(`/analytics/daily/${accountId}`, { params }).then(unwrap),
  followers: (accountId, params = {}) => api.get(`/analytics/followers/${accountId}`, { params }).then(unwrap),
  bestTimes: (accountId) => api.get(`/analytics/best-times/${accountId}`).then(unwrap)
};

export const campaignsApi = {
  list: (params = {}) => api.get("/campaigns", { params }).then(unwrap),
  create: (payload) => api.post("/campaigns", payload).then(unwrap),
  get: (id) => api.get(`/campaigns/${id}`).then(unwrap),
  update: (id, payload) => api.put(`/campaigns/${id}`, payload).then(unwrap),
  remove: (id) => api.delete(`/campaigns/${id}`).then(unwrap),
  analytics: (id) => api.get(`/campaigns/${id}/analytics`).then(unwrap)
};

export const hashtagsApi = {
  list: (params = {}) => api.get("/hashtags", { params }).then(unwrap),
  create: (payload) => api.post("/hashtags", payload).then(unwrap),
  update: (id, payload) => api.put(`/hashtags/${id}`, payload).then(unwrap),
  remove: (id) => api.delete(`/hashtags/${id}`).then(unwrap),
  recommendations: (postId) => api.get(`/hashtags/recommendations/${postId}`).then(unwrap),
  analytics: (id) => api.get(`/hashtags/${id}/analytics`).then(unwrap)
};

export const mediaApi = {
  upload: (formData) =>
    api.post("/uploads/media", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    }).then(unwrap)
};

export const adminApi = {
  listUsers: (params = {}) => api.get("/admin/users", { params }).then(unwrap),
  updateUserStatus: (id, payload) => api.patch(`/admin/users/${id}/status`, payload).then(unwrap),
  listLogs: (params = {}) => api.get("/admin/logs", { params }).then(unwrap),
  createReport: (payload) => api.post("/admin/reports", payload).then(unwrap),
  listReports: (params = {}) => api.get("/admin/reports", { params }).then(unwrap)
};

export const notificationsApi = {
  list: (params = {}) => api.get("/notifications", { params }).then(unwrap),
  markRead: (id) => api.patch(`/notifications/${id}/read`).then(unwrap),
  markAllRead: () => api.patch("/notifications/read-all").then(unwrap)
};

export const teamsApi = {
  listMembers: (teamId, params = {}) => api.get(`/teams/${teamId}/members`, { params }).then(unwrap),
  inviteMember: (teamId, payload) => api.post(`/teams/${teamId}/invite`, payload).then(unwrap),
  removeMember: (teamId, userId) => api.delete(`/teams/${teamId}/members/${userId}`).then(unwrap),
  updateMemberRole: (teamId, userId, payload) => api.patch(`/teams/${teamId}/members/${userId}/role`, payload).then(unwrap)
};
