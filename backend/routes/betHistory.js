const express = require('express');
const router = express.Router();
const BetHistory = require('../models/BetHistory');
const auth = require('../middleware/auth');
const resultCheckService = require('../services/resultCheckService');

// Lấy danh sách lịch sử cược
router.get('/', auth, async (req, res) => {
  try {
    // Kiểm tra kết quả tự động khi user vào trang thống kê
    try {
      await resultCheckService.checkResultsOnStatsView();
    } catch (checkError) {
      console.error('Error checking results:', checkError.message);
      // Không throw error để không ảnh hưởng đến việc lấy dữ liệu
    }
    const { 
      page = 1, 
      limit = 20, 
      status, 
      websiteType, 
      orderCode, 
      region, 
      betType, 
      startDate, 
      endDate 
    } = req.query;
    
    const filter = { userId: req.user.userId };
    
    if (status) filter.overallStatus = status;
    if (websiteType) filter.websiteType = websiteType;
    if (orderCode) filter.orderCode = { $regex: orderCode, $options: 'i' };
    if (region) filter.region = region;
    if (betType) filter.betType = betType;
    
    // Lọc theo ngày
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        // Thêm 1 ngày để bao gồm cả ngày endDate
        const endDateTime = new Date(endDate);
        endDateTime.setDate(endDateTime.getDate() + 1);
        filter.createdAt.$lt = endDateTime;
      }
    }

    const betHistories = await BetHistory.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('accountsUsed.accountId', 'username')
      .lean();

    const total = await BetHistory.countDocuments(filter);

    res.json({
      success: true,
      data: {
        betHistories,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Lỗi khi lấy lịch sử cược',
      details: error.message
    });
  }
});

// Lấy chi tiết một đơn cược
router.get('/:orderCode', auth, async (req, res) => {
  try {
    const betHistory = await BetHistory.findOne({
      orderCode: req.params.orderCode,
      userId: req.user.userId
    }).populate('accountsUsed.accountId', 'username');

    if (!betHistory) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy đơn cược'
      });
    }

    res.json({
      success: true,
      data: betHistory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Lỗi khi lấy chi tiết cược',
      details: error.message
    });
  }
});

// Cập nhật kết quả thắng thua (sẽ implement sau)
router.put('/:orderCode/result', auth, async (req, res) => {
  try {
    const { winningNumbers, winDetails } = req.body;
    
    const betHistory = await BetHistory.findOne({
      orderCode: req.params.orderCode,
      userId: req.user.userId
    });

    if (!betHistory) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy đơn cược'
      });
    }

    betHistory.result = {
      isChecked: true,
      winningNumbers,
      winDetails,
      totalWinAmount: winDetails.reduce((sum, detail) => sum + detail.winAmount, 0),
      checkedAt: new Date()
    };

    await betHistory.save();

    res.json({
      success: true,
      message: 'Đã cập nhật kết quả',
      data: betHistory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Lỗi khi cập nhật kết quả',
      details: error.message
    });
  }
});

module.exports = router;