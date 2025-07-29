const express = require('express');
const Account = require('../models/Account');
const auth = require('../middleware/auth');

const router = express.Router();

// Lấy tất cả accounts
router.get('/', auth, async (req, res) => {
  try {
    const accounts = await Account.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Thêm account mới
router.post('/', auth, async (req, res) => {
  try {
    const { accountData, websiteType } = req.body;
    
    if (!accountData.includes(':')) {
      return res.status(400).json({ message: 'Định dạng không hợp lệ. Sử dụng username:password:proxy' });
    }
    
    const parts = accountData.split(':');
    if (parts.length < 3) {
      return res.status(400).json({ message: 'Định dạng không hợp lệ. Phải có đủ username:password:proxy' });
    }
    
    const username = parts[0];
    const password = parts[1];
    // Lấy toàn bộ phần còn lại làm proxy (có thể chứa dấu : trong proxy)
    const proxy = parts.slice(2).join(':');
    
    // Kiểm tra proxy bắt buộc
    if (!proxy || proxy.trim() === '') {
      return res.status(400).json({ message: 'Thiếu proxy' });
    }
    
    // Validate proxy format (ip:port hoặc ip:port:username:pass)
    const proxyRegex = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})(?::(\S+):(\S+))?$/;
    if (!proxyRegex.test(proxy.trim())) {
      return res.status(400).json({ message: 'Định dạng proxy không hợp lệ. Sử dụng ip:port hoặc ip:port:username:password' });
    }
    
    // Validate IP và port
    const proxyParts = proxy.trim().split(':');
    const ip = proxyParts[0];
    const port = parseInt(proxyParts[1]);
    
    // Kiểm tra IP hợp lệ
    const ipParts = ip.split('.');
    if (ipParts.length !== 4 || ipParts.some(part => {
      const num = parseInt(part);
      return isNaN(num) || num < 0 || num > 255;
    })) {
      return res.status(400).json({ message: 'Địa chỉ IP trong proxy không hợp lệ' });
    }
    
    // Kiểm tra port hợp lệ
    if (isNaN(port) || port < 1 || port > 65535) {
      return res.status(400).json({ message: 'Port trong proxy không hợp lệ (1-65535)' });
    }
    
    // Kiểm tra username và password nếu có
    if (proxyParts.length === 4) {
      if (!proxyParts[2] || !proxyParts[3] || proxyParts[2].trim() === '' || proxyParts[3].trim() === '') {
        return res.status(400).json({ message: 'Username và password trong proxy không thể để trống' });
      }
    }

    const account = new Account({
      username: username.trim(),
      password: password.trim(),
      proxy: proxy.trim(),
      status: 'active',
      websiteType: websiteType || 'sgd666',
      userId: req.userId
    });
    
    await account.save();
    res.status(201).json(account);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Cập nhật account
router.put('/:id', auth, async (req, res) => {
  try {
    const { username, password, proxy, points, status, websiteType } = req.body;
    
    // Kiểm tra username trùng lặp trong website được chọn (trừ chính tài khoản đang sửa)
    const existingAccount = await Account.findOne({
      username: { $regex: new RegExp(`^${username}$`, 'i') },
      userId: req.userId,
      websiteType: websiteType,
      _id: { $ne: req.params.id } // Loại trừ chính tài khoản đang sửa
    });
    
    if (existingAccount) {
      return res.status(400).json({ 
        message: `Username "${username}" đã tồn tại trong website ${websiteType}` 
      });
    }

    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { username, password, proxy, points, status: status, websiteType: websiteType },
      { new: true }
    );
    
    if (!account) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    }
    
    res.json(account);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Xóa account
router.delete('/:id', auth, async (req, res) => {
  try {
    const account = await Account.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });
    
    if (!account) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    }
    
    res.json({ message: 'Xóa tài khoản thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Kiểm tra username đã tồn tại
router.get('/check-username/:username', auth, async (req, res) => {
  try {
    const { username } = req.params;
    const { websiteType } = req.query;
    const existingAccount = await Account.findOne({ 
      username: { $regex: new RegExp(`^${username}$`, 'i') }, // Case-insensitive,
      websiteType: websiteType,
      userId: req.userId
    });
    
    res.json({ exists: !!existingAccount });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

// Kiểm tra nhiều username cùng lúc
router.post('/check-usernames', auth, async (req, res) => {
  try {
    const { usernames, websiteType } = req.body;
    
    if (!Array.isArray(usernames)) {
      return res.status(400).json({ message: 'usernames phải là một mảng' });
    }
    
    const existingAccounts = await Account.find({
      username: { 
        $in: usernames.map(u => new RegExp(`^${u}$`, 'i'))
      },
      websiteType: websiteType,
      userId: req.userId
    }, 'username');
    
    const existingUsernames = existingAccounts.map(acc => acc.username.toLowerCase());
    
    res.json({ existingUsernames });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

module.exports = router;