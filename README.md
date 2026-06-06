# CreatorFlow

CreatorFlow is a full-stack **Smart Social Media Scheduling & Analytics Management System** built as a mini Buffer/Hootsuite-style SaaS for agencies and solo creators.

## Stack

- Frontend: React + Tailwind CSS + Vite
- Backend: Node.js + Express
- Database: MySQL 8.0
- Auth: JWT access token in memory + refresh token in httpOnly cookie
- Uploads: Multer local storage with UUID filenames
- Jobs: node-cron
- Mail: Nodemailer

## App modules

- Auth: register, login, refresh, logout, forgot password, reset password
- User and team management: profile editing, members list, invites, role changes
- Social accounts: connect, list, delete, manual sync
- Post scheduling: drafts, scheduled posts, recurring schedules, publish-now
- Analytics: dashboard, post analytics, daily, weekly, followers, best times
- Campaigns: CRUD and campaign analytics
- Hashtags: CRUD, analytics, and recommendations
- Admin: users, status updates, logs, reports
- Notifications: list, mark-read, mark-all-read

## Frontend pages

- `/login`
- `/register`
- `/`
- `/schedule`
- `/posts`
- `/analytics`
- `/campaigns`
- `/hashtags`
- `/admin`
- `/settings`

Charts are implemented with Recharts and route pages are lazy-loaded for smaller bundles.

## Folder layout

```text
creatorflow/
  backend/
    src/
      config/
      controllers/modules/
      data/
      jobs/
      middleware/
      routes/
      services/modules/
      sql/
      utils/
    uploads/
  frontend/
    src/
      api/
      components/
      context/
      pages/
      styles/
  server/
    seed.js
```

## Database objects

This project includes the named database objects from the prompt:

- Tables: `Roles`, `Users`, `Sessions`, `PasswordResets`, `Teams`, `TeamMembers`, `Platforms`, `SocialAccounts`, `MediaFiles`, `Campaigns`, `Hashtags`, `Posts`, `PostMedia`, `PostHashtags`, `ScheduledPosts`, `RecurringSchedules`, `RecurringPostInstances`, `PostAnalytics`, `DailyAnalytics`, `WeeklyAnalytics`, `FollowersHistory`, `HashtagAnalytics`, `CampaignAnalytics`, `BestPostingTimes`, `HashtagRecommendations`, `CaptionSuggestions`, `Notifications`, `Reports`, `Logs`, `AdminActions`
- Views: `vw_AccountDashboard`, `vw_TopPosts`, `vw_CampaignSummary`
- Procedures: `sp_RollupWeeklyAnalytics`, `sp_GetDuePosts`, `sp_MarkPostPublished`
- Triggers: `trg_after_post_published`, `trg_after_follower_history_insert`, `trg_after_admin_action`

Schema files live in [backend/src/sql/schema.sql](C:/Users/ASUS/Desktop/creatorflow/backend/src/sql/schema.sql) and [backend/src/sql/seed.sql](C:/Users/ASUS/Desktop/creatorflow/backend/src/sql/seed.sql). The richer scripted seed lives in [server/seed.js](C:/Users/ASUS/Desktop/creatorflow/server/seed.js).

## Local setup

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Default mode is `APP_MODE=demo`, which powers the whole app without a live MySQL instance.

For MySQL mode:

1. Create the schema from [backend/src/sql/schema.sql](C:/Users/ASUS/Desktop/creatorflow/backend/src/sql/schema.sql)
2. Set `APP_MODE=mysql` in `.env`
3. Run `npm run seed` from [backend](C:/Users/ASUS/Desktop/creatorflow/backend)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Optional frontend env:

```bash
VITE_API_URL=http://localhost:5000/api
```

## Demo credentials

- Email: `admin@creatorflow.app`
- Password: `Password123!`

## API contract

Protected routes require the `Authorization: Bearer <accessToken>` header.

Refresh tokens are set in an httpOnly cookie by:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`

All API responses follow this shape:

```json
{ "success": true, "data": {}, "message": "..." }
{ "success": false, "error": "...", "code": 400 }
```

## Key endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password/:token`
- `GET /api/users/me`
- `PUT /api/users/me`
- `GET /api/teams/:id/members`
- `POST /api/teams/:id/invite`
- `DELETE /api/teams/:id/members/:userId`
- `PATCH /api/teams/:id/members/:userId/role`
- `GET /api/accounts`
- `POST /api/accounts`
- `DELETE /api/accounts/:id`
- `POST /api/accounts/:id/sync`
- `POST /api/posts`
- `GET /api/posts`
- `GET /api/posts/:id`
- `PUT /api/posts/:id`
- `DELETE /api/posts/:id`
- `POST /api/posts/:id/publish-now`
- `POST /api/schedules/recurring`
- `GET /api/schedules/recurring`
- `DELETE /api/schedules/recurring/:id`
- `GET /api/analytics/dashboard`
- `GET /api/analytics/posts/:accountId`
- `GET /api/analytics/daily/:accountId`
- `GET /api/analytics/weekly/:accountId`
- `GET /api/analytics/followers/:accountId`
- `GET /api/analytics/best-times/:accountId`
- `GET /api/campaigns`
- `POST /api/campaigns`
- `GET /api/campaigns/:id/analytics`
- `GET /api/hashtags`
- `POST /api/hashtags`
- `GET /api/hashtags/recommendations/:postId`
- `GET /api/hashtags/:id/analytics`
- `GET /api/admin/users`
- `PATCH /api/admin/users/:id/status`
- `GET /api/admin/logs`
- `POST /api/admin/reports`
- `GET /api/admin/reports`
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`
- `POST /api/uploads/media`

## Verification status

Verified locally in demo mode:

- Backend login + refresh-cookie flow
- Protected route access for members, accounts, and analytics dashboard
- Frontend production build
- `npm audit --omit=dev` is clean for both frontend and backend

## Notes

- The current implementation is strongest in demo mode, which is the mode verified end to end here.
- The frontend now stores the access token only in React context memory, not in `localStorage`.
- Scheduled publishing and weekly rollups are simulated jobs that are ready to be swapped for live platform APIs and real MySQL rollup procedures.
