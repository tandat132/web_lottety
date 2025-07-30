const express = require('express');
const router = express.Router();
const sgd666AuthService = require('../services/sgd666Auth');
const one789AuthService = require('../services/one789Auth');
const proxyService = require('../services/proxyService');
const Account = require('../models/Account');
const auth = require('../middleware/auth');

// Kiểm tra nhiều tài khoản cùng lúc
router.post('/check-multiple', auth, async (req, res) => {
  try {
    const { accountIds } = req.body;
    
    if (!Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'accountIds phải là một mảng không rỗng'
      });
    }

    const accounts = await Account.find({
      _id: { $in: accountIds },
      userId: req.userId
    });

    const BATCH_SIZE = 10; // Xử lý 10 tài khoản cùng lúc
    const results = [];

    // Hàm xử lý một tài khoản
    const processAccount = async (account) => {
      try {
        let parsedProxy = null;
        if (account.proxy && typeof account.proxy === 'string') {
          parsedProxy = proxyService.parseProxyString(account.proxy);
        }

        let result;

        // Chọn service phù hợp
        if (account.websiteType === 'sgd666') {
          result = await sgd666AuthService.checkAccount(account, parsedProxy);
        } else if (account.websiteType === 'one789') {
          result = await one789AuthService.checkAccount(account, parsedProxy);
        }

        return {
          accountId: account._id,
          username: account.username,
          websiteType: account.websiteType,
          status: 'success',
          points: result.points,
          fromExistingToken: result.fromExistingToken,
          message: 'Kiểm tra thành công'
        };

      } catch (error) {
        let status = 'failed';
        if (error.message.includes('Proxy lỗi') || error.message.includes('proxy')) {
          status = 'proxy_error';
        }
        return {
          accountId: account._id,
          username: account.username,
          websiteType: account.websiteType,
          status: status,
          points: account.points || 0,
          message: error.message
        };
      }
    };

    // Chia accounts thành các batch và xử lý song song
    for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
      const batch = accounts.slice(i, i + BATCH_SIZE);
      
      // Xử lý batch song song với Promise.allSettled
      const batchPromises = batch.map(account => processAccount(account));
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Thêm kết quả vào results
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Xử lý trường hợp promise bị reject
          results.push({
            status: 'failed',
            message: result.reason?.message || 'Unknown error'
          });
        }
      });

      // Delay nhỏ giữa các batch để tránh overload server
      if (i + BATCH_SIZE < accounts.length) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5s delay
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const proxyErrorCount = results.filter(r => r.status === 'proxy_error').length;

    res.json({
      success: true,
      message: `Đã kiểm tra ${accounts.length} tài khoản. Thành công: ${successCount}, Thất bại: ${failedCount}, Lỗi proxy: ${proxyErrorCount}`,
      results: results,
      summary: {
        total: accounts.length,
        success: successCount,
        failed: failedCount,
        proxyError: proxyErrorCount
      }
    });

  } catch (error) {
    console.error('Multiple account check error:', error);
    res.status(500).json({
      success: false,
      message: `Lỗi khi kiểm tra tài khoản: ${error.message}`
    });
  }
});

module.exports = router;