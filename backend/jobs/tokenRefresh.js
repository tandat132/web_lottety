const cron = require('node-cron');
const sgd666AuthService = require('../services/sgd666Auth');
const Account = require('../models/Account');

// Chạy mỗi 2 tiếng để kiểm tra và refresh tokens
cron.schedule('0 */2 * * *', async () => {
  console.log('Starting token refresh job...');
  
  try {
    const expiryThreshold = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4h
    
    const accounts = await Account.find({
      websiteType: 'sgd666',
      status: 'active',
      $or: [
        { tokenExpiry: { $lt: expiryThreshold } },
        { tokenExpiry: null }
      ]
    });

    console.log(`Found ${accounts.length} accounts needing token refresh`);

    for (const account of accounts) {
      try {
        await sgd666AuthService.refreshToken(account);
        console.log(`✅ Refreshed token for ${account.username}`);
      } catch (error) {
        console.error(`❌ Failed to refresh token for ${account.username}:`, error.message);
      }
      
      // Delay giữa các request để tránh rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('Token refresh job completed');
  } catch (error) {
    console.error('Token refresh job failed:', error);
  }
});

module.exports = {};