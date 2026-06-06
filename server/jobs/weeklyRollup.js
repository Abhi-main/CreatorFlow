import cron from 'node-cron';
import pool from '../config/db.js';

cron.schedule('0 0 * * 0', async () => {
  console.log('Running weekly analytics rollup...');

  try {
    const [accounts] = await pool.query(`SELECT account_id FROM SocialAccounts WHERE is_active = true`);
    const lastMonday = new Date();
    lastMonday.setUTCDate(lastMonday.getUTCDate() - lastMonday.getUTCDay() - 6);
    const weekStart = lastMonday.toISOString().slice(0, 10);

    for (const { account_id: accountId } of accounts) {
      await pool.query('CALL sp_RollupWeeklyAnalytics(?, ?)', [accountId, weekStart]);
      console.log(`Rolled up analytics for account ${accountId}`);
    }
  } catch (err) {
    console.error('Weekly rollup failed:', err.message);
  }
});
