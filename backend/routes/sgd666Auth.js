const express = require('express');
const router = express.Router();
const sgd666AuthService = require('../services/sgd666Auth');
const Account = require('../models/Account');
const auth = require('../middleware/auth');
const proxyService = require('../services/proxyService');

// Test login SGD666
router.post('/test-login', auth, async (req, res) => {
  try {
    const { username, password, proxy } = req.body;

    let parsedProxy = null;
    if (proxy && typeof proxy === 'string') {
      parsedProxy = proxyService.parseProxyString(proxy);
    }

    // Kiểm tra proxy trước khi thực hiện login
    if (parsedProxy) {
      const proxyCheck = await proxyService.checkProxy(parsedProxy);
      if (!proxyCheck.isWorking) {
        return res.status(400).json({
          success: false,
          message: `Proxy lỗi: ${proxyCheck.message}`
        });
      }
    }

    const result = await sgd666AuthService.login(username, password, parsedProxy);
    
    console.log(result);
    
    res.json({
      success: true,
      message: 'Login successful',
      token: result.token
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Refresh token cho account
router.post('/refresh-token/:accountId', auth, async (req, res) => {
  try {
    const account = await Account.findById(req.params.accountId);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    // Kiểm tra proxy trước khi refresh token
    if (account.proxy) {
      let parsedProxy = null;
      try {
        parsedProxy = proxyService.parseProxyString(account.proxy);
        const proxyCheck = await proxyService.checkProxy(parsedProxy);
        if (!proxyCheck.isWorking) {
          account.status = 'proxy_error';
          await account.save();
          return res.status(400).json({
            success: false,
            message: `Proxy lỗi: ${proxyCheck.message}`
          });
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Proxy không hợp lệ: ${error.message}`
        });
      }
    }

    const newToken = await sgd666AuthService.refreshToken(account);
    
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      token: newToken,
      expiry: account.tokenExpiry
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Lấy token hợp lệ (tự động refresh nếu cần)
router.get('/valid-token/:accountId', auth, async (req, res) => {
  try {
    const account = await Account.findById(req.params.accountId);
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    // Kiểm tra proxy trước khi lấy token
    if (account.proxy) {
      let parsedProxy = null;
      try {
        parsedProxy = proxyService.parseProxyString(account.proxy);
        const proxyCheck = await proxyService.checkProxy(parsedProxy);
        if (!proxyCheck.isWorking) {
          account.status = 'proxy_error';
          await account.save();
          return res.status(400).json({
            success: false,
            message: `Proxy lỗi: ${proxyCheck.message}`
          });
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Proxy không hợp lệ: ${error.message}`
        });
      }
    }

    const token = await sgd666AuthService.getValidToken(req.params.accountId);
    
    res.json({
      success: true,
      token: token
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Refresh tất cả tokens sắp hết hạn
router.post('/refresh-all', auth, async (req, res) => {
  try {
    const expiryThreshold = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h
    
    const accounts = await Account.find({
      websiteType: 'sgd666',
      status: { $in: ['active', 'inactive'] }, // Không refresh những account có proxy_error
      $or: [
        { tokenExpiry: { $lt: expiryThreshold } },
        { tokenExpiry: null }
      ]
    });

    const results = [];
    for (const account of accounts) {
      try {
        // Kiểm tra proxy trước khi refresh
        if (account.proxy) {
          let parsedProxy = null;
          try {
            parsedProxy = proxyService.parseProxyString(account.proxy);
            const proxyCheck = await proxyService.checkProxy(parsedProxy);
            if (!proxyCheck.isWorking) {
              account.status = 'proxy_error';
              await account.save();
              results.push({
                accountId: account._id,
                username: account.username,
                status: 'proxy_error',
                error: `Proxy lỗi: ${proxyCheck.message}`
              });
              continue;
            }
          } catch (error) {
            results.push({
              accountId: account._id,
              username: account.username,
              status: 'failed',
              error: `Proxy không hợp lệ: ${error.message}`
            });
            continue;
          }
        }

        await sgd666AuthService.refreshToken(account);
        results.push({
          accountId: account._id,
          username: account.username,
          status: 'success'
        });
      } catch (error) {
        // Kiểm tra xem lỗi có phải do proxy không
        if (error.message.includes('Proxy lỗi')) {
          account.status = 'proxy_error';
          await account.save();
        }
        
        results.push({
          accountId: account._id,
          username: account.username,
          status: 'failed',
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const proxyErrorCount = results.filter(r => r.status === 'proxy_error').length;

    res.json({
      success: true,
      message: `Processed ${accounts.length} accounts. Success: ${successCount}, Failed: ${failedCount}, Proxy Error: ${proxyErrorCount}`,
      results: results,
      summary: {
        total: accounts.length,
        success: successCount,
        failed: failedCount,
        proxyError: proxyErrorCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;