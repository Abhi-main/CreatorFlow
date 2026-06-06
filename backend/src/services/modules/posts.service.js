const ApiError = require("../../utils/ApiError");
const { parsePagination, paginate } = require("../../utils/pagination");
const {
  demoState,
  nextId,
  getAccountById,
  getPostById,
  enrichPost,
  createNotification,
  createLog
} = require("./store");

function listPosts(teamId, filters) {
  const { page, pageSize } = parsePagination(filters);

  let posts = demoState.posts.filter((post) => Number(post.team_id) === Number(teamId));

  if (filters.status) {
    posts = posts.filter((post) => post.publish_status === filters.status);
  }

  if (filters.account) {
    posts = posts.filter((post) => Number(post.social_account_id) === Number(filters.account));
  }

  if (filters.platform) {
    posts = posts.filter((post) => {
      const account = getAccountById(post.social_account_id);
      return account && Number(account.platform_id) === Number(filters.platform);
    });
  }

  if (filters.dateFrom) {
    posts = posts.filter((post) => post.scheduled_for && new Date(post.scheduled_for) >= new Date(filters.dateFrom));
  }

  if (filters.dateTo) {
    posts = posts.filter((post) => post.scheduled_for && new Date(post.scheduled_for) <= new Date(filters.dateTo));
  }

  posts = posts
    .map(enrichPost)
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at));

  return paginate(posts, page, pageSize);
}

function getPost(teamId, postId) {
  const post = getPostById(postId);

  if (!post || Number(post.team_id) !== Number(teamId)) {
    throw new ApiError(404, "Post not found.");
  }

  return enrichPost(post);
}

function createPost(teamId, userId, payload) {
  const account = getAccountById(payload.social_account_id);

  if (!account || Number(account.team_id) !== Number(teamId)) {
    throw new ApiError(400, "A valid social account is required.");
  }

  const post = {
    id: nextId("posts"),
    team_id: Number(teamId),
    campaign_id: payload.campaign_id ? Number(payload.campaign_id) : null,
    social_account_id: Number(payload.social_account_id),
    author_user_id: Number(userId),
    title: payload.title,
    caption: payload.caption,
    content_status: payload.publish_status === "draft" ? "draft" : "approved",
    approval_status: payload.publish_status === "draft" ? "pending" : "approved",
    publish_status: payload.publish_status || (payload.scheduled_for ? "scheduled" : "draft"),
    platform_post_id: null,
    scheduled_for: payload.scheduled_for || null,
    published_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    recurring_pattern: payload.recurring_pattern || null
  };

  demoState.posts.unshift(post);

  if (post.publish_status === "scheduled" && post.scheduled_for) {
    demoState.scheduledPosts.unshift({
      id: nextId("scheduledPosts"),
      post_id: post.id,
      run_at: post.scheduled_for,
      status: "queued",
      retry_count: 0,
      last_error: null
    });
  }

  return enrichPost(post);
}

function updatePost(teamId, postId, payload) {
  const post = getPostById(postId);

  if (!post || Number(post.team_id) !== Number(teamId)) {
    throw new ApiError(404, "Post not found.");
  }

  Object.assign(post, {
    title: payload.title ?? post.title,
    caption: payload.caption ?? post.caption,
    campaign_id: payload.campaign_id ?? post.campaign_id,
    social_account_id: payload.social_account_id ?? post.social_account_id,
    scheduled_for: payload.scheduled_for ?? post.scheduled_for,
    publish_status: payload.publish_status ?? post.publish_status,
    updated_at: new Date().toISOString()
  });

  return enrichPost(post);
}

function deletePost(teamId, postId) {
  const post = getPostById(postId);

  if (!post || Number(post.team_id) !== Number(teamId)) {
    throw new ApiError(404, "Post not found.");
  }

  demoState.posts = demoState.posts.filter((item) => Number(item.id) !== Number(postId));
  demoState.scheduledPosts = demoState.scheduledPosts.filter((item) => Number(item.post_id) !== Number(postId));
  demoState.postAnalytics = demoState.postAnalytics.filter((item) => Number(item.post_id) !== Number(postId));
  return { deleted: true };
}

function publishNow(teamId, postId) {
  const post = getPostById(postId);

  if (!post || Number(post.team_id) !== Number(teamId)) {
    throw new ApiError(404, "Post not found.");
  }

  post.publish_status = "published";
  post.content_status = "published";
  post.platform_post_id = `manual_${post.id}_${Date.now()}`;
  post.published_at = new Date().toISOString();
  post.updated_at = new Date().toISOString();

  const existingAnalytics = demoState.postAnalytics.find((item) => Number(item.post_id) === Number(post.id));
  if (!existingAnalytics) {
    demoState.postAnalytics.unshift({
      id: nextId("postAnalytics"),
      post_id: post.id,
      impressions: 8600,
      reach_count: 6200,
      likes_count: 340,
      comments_count: 22,
      shares_count: 15,
      saves_count: 11,
      clicks_count: 56,
      engagement_count: 444,
      engagement_rate: 5.3,
      collected_at: new Date().toISOString()
    });
  }

  createNotification({
    user_id: post.author_user_id,
    team_id: post.team_id,
    title: "Post published",
    body: `${post.title} has been published successfully.`,
    variant: "success"
  });

  return enrichPost(post);
}

function createRecurringSchedule(teamId, payload) {
  const schedule = {
    id: nextId("recurringSchedules"),
    team_id: Number(teamId),
    post_id: Number(payload.post_id),
    frequency: payload.frequency,
    day_of_week: payload.day_of_week || null,
    hour_of_day: Number(payload.hour_of_day || 9),
    timezone: payload.timezone || "UTC",
    is_active: true
  };

  demoState.recurringSchedules.unshift(schedule);
  return schedule;
}

function listRecurringSchedules(teamId) {
  return demoState.recurringSchedules.filter((schedule) => Number(schedule.team_id) === Number(teamId));
}

function deleteRecurringSchedule(teamId, scheduleId) {
  const schedule = demoState.recurringSchedules.find(
    (item) => Number(item.id) === Number(scheduleId) && Number(item.team_id) === Number(teamId)
  );

  if (!schedule) {
    throw new ApiError(404, "Recurring schedule not found.");
  }

  demoState.recurringSchedules = demoState.recurringSchedules.filter((item) => Number(item.id) !== Number(scheduleId));
  return { deleted: true };
}

function getDuePosts() {
  const now = Date.now();
  return demoState.scheduledPosts
    .filter((schedule) => schedule.status === "queued" && new Date(schedule.run_at).getTime() <= now)
    .map((schedule) => ({
      schedule,
      post: getPostById(schedule.post_id)
    }))
    .filter((item) => item.post);
}

function markPostPublished(postId, fakePlatformId) {
  const post = getPostById(postId);

  if (!post) {
    return null;
  }

  post.publish_status = "published";
  post.content_status = "published";
  post.platform_post_id = fakePlatformId;
  post.published_at = new Date().toISOString();
  post.updated_at = new Date().toISOString();

  const schedule = demoState.scheduledPosts.find((item) => Number(item.post_id) === Number(postId));
  if (schedule) {
    schedule.status = "completed";
  }

  if (!demoState.postAnalytics.find((item) => Number(item.post_id) === Number(postId))) {
    demoState.postAnalytics.unshift({
      id: nextId("postAnalytics"),
      post_id: post.id,
      impressions: 7200 + post.id * 20,
      reach_count: 5200 + post.id * 16,
      likes_count: 260 + post.id,
      comments_count: 20,
      shares_count: 14,
      saves_count: 9,
      clicks_count: 48,
      engagement_count: 392 + post.id,
      engagement_rate: 5.1,
      collected_at: new Date().toISOString()
    });
  }

  createNotification({
    user_id: post.author_user_id,
    team_id: post.team_id,
    title: "Scheduled post published",
    body: `${post.title} was published by the scheduler.`,
    variant: "success"
  });
  createLog({
    source: "scheduler",
    message: `Published due post ${post.id}.`,
    metadata: { postId: post.id }
  });

  return enrichPost(post);
}

module.exports = {
  listPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  publishNow,
  createRecurringSchedule,
  listRecurringSchedules,
  deleteRecurringSchedule,
  getDuePosts,
  markPostPublished
};
