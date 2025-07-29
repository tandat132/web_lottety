const express = require('express');
const auth = require('../middleware/auth');
const bettingService = require('../services/bettingService');
const Account = require('../models/Account');
const proxyService = require('../services/proxyService');

const router = express.Router();

// Submit betting order
router.post('/submit', auth, async (req, res) => {
  try {
    const bettingData = req.body;
    
    // Validate dữ liệu
    const { points, numbers, stations, betType, websiteType, runningAccountsCount } = bettingData;
    
    if (!points || points <= 0) {
      return res.status(400).json({ message: 'Điểm cần đánh không hợp lệ' });
    }
    
    if (!numbers || !numbers.trim()) {
      return res.status(400).json({ message: 'Thiếu thông tin số cần đánh' });
    }
    
    if (!stations || stations.length === 0) {
      return res.status(400).json({ message: 'Thiếu thông tin đài' });
    }
    
    if (!betType) {
      return res.status(400).json({ message: 'Thiếu thông tin kiểu đánh' });
    }
    
    if (!runningAccountsCount || runningAccountsCount <= 0) {
      return res.status(400).json({ message: 'Số tài khoản chạy không hợp lệ' });
    }

    // Xử lý betting
    const result = await bettingService.processBetting(req.userId, bettingData);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Đã xử lý lệnh đánh thành công',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Betting submit error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi server', 
      error: error.message 
    });
  }
});

// Kiểm tra trạng thái proxy của tài khoản
router.post('/check-proxy/:accountId', auth, async (req, res) => {
  try {
    const account = await Account.findOne({
      _id: req.params.accountId,
      userId: req.userId
    });
    
    if (!account) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    }
    
    const proxyCheck = await proxyService.checkProxy(account.proxy);
    
    // Cập nhật trạng thái
    if (proxyCheck.success) {
      account.status = 'active';
      account.proxyErrorMessage = null;
    } else {
      account.status = 'proxy_error';
      account.proxyErrorMessage = proxyCheck.error;
    }
    account.lastProxyCheck = new Date();
    await account.save();
    
    res.json({
      success: proxyCheck.success,
      message: proxyCheck.success ? 'Proxy hoạt động bình thường' : 'Proxy có lỗi',
      details: proxyCheck
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Refresh token cho tài khoản
router.post('/refresh-token/:accountId', auth, async (req, res) => {
  try {
    const account = await Account.findOne({
      _id: req.params.accountId,
      userId: req.userId
    });
    
    if (!account) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    }
    
    const tokenResult = await bettingService.getAccessToken(account);
    
    res.json({
      success: tokenResult.success,
      message: tokenResult.success ? 'Token đã được refresh' : 'Lỗi khi refresh token',
      details: tokenResult
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

module.exports = router;