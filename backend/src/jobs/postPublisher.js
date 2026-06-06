const postsService = require("../services/modules/posts.service");

async function runPostPublisher() {
  const duePosts = postsService.getDuePosts();

  for (const item of duePosts) {
    const fakePlatformId = `dev_${item.post.id}_${Date.now()}`;
    console.log(`[postPublisher] Publishing post ${item.post.id} -> ${fakePlatformId}`);
    postsService.markPostPublished(item.post.id, fakePlatformId);
  }
}

module.exports = {
  runPostPublisher
};
