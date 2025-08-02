const mongoose = require('mongoose');

const betHistorySchema = new mongoose.Schema({
  // Thông tin đơn cược
  orderCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Thông tin cược
  websiteType: {
    type: String,
    enum: ['sgd666', 'one789'],
    required: true
  },
  betType: {
    type: String,
    required: true
  },
  betTypeDisplay: {
    type: String,
    required: true
  },
  region: {
    type: String,
    enum: ['south', 'central', 'north', 'north1', 'north2'],
    required: true
  },
  stations: [{
    value: String,
    label: String
  }],
  numbers: [String],
  points: {
    type: Number,
    required: true
  },
  totalStake: {
    type: Number,
    required: true
  },
  distributionType: {
    type: String,
    enum: ['equal', 'random', 'all'],
    required: true
  },
  
  // Thông tin tài khoản đã cược
  accountsUsed: [{
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true
    },
    username: {
      type: String,
      required: true
    },
    numbersAssigned: [String],
    stakeAmount: Number,
    betStatus: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending'
    },
    betResponse: mongoose.Schema.Types.Mixed,
    errorMessage: String
  }],
  
  // Thông tin người tạo
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Trạng thái tổng thể
  overallStatus: {
    type: String,
    enum: ['pending', 'completed', 'partial_success', 'failed'],
    default: 'pending'
  },
  
  // Thống kê
  totalAccountsUsed: {
    type: Number,
    default: 0
  },
  successfulBets: {
    type: Number,
    default: 0
  },
  failedBets: {
    type: Number,
    default: 0
  },
  
  // Kết quả (sẽ cập nhật sau khi có kết quả xổ số)
  result: {
    isChecked: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['WIN', 'LOSS', 'DRAW', 'not_found'],
      default: 'LOSS'
    },
    winningNumbers: [String], // Tất cả số thắng
    winningNumbersByChannel: mongoose.Schema.Types.Mixed, // Số thắng theo từng đài
    totalWinAmount: {
      type: Number,
      default: 0
    },
    totalStake: {
      type: Number,
      default: 0
    },
    winDetails: [mongoose.Schema.Types.Mixed],
    channelResults: mongoose.Schema.Types.Mixed,
    accountResults: [{
      accountUsername: String,
      accountId: mongoose.Schema.Types.ObjectId,
      orderCode: String,
      totalWinLoss: Number,
      totalStake: Number,
      status: String,
      recordCount: Number,
      winDetails: [mongoose.Schema.Types.Mixed],
      winningNumbers: [String], // Số thắng của account này
      winningNumbersByChannel: mongoose.Schema.Types.Mixed, // Số thắng theo đài của account này
      error: String
    }],
    processedAccounts: {
      type: Number,
      default: 0
    },
    totalAccounts: {
      type: Number,
      default: 0
    },
    checkedAt: Date,
    searchedOrderCode: String,
    availableOrderCodes: [String]
  },
  
  // Metadata
  betDate: {
    type: Date,
    default: Date.now
  },
  notes: String
}, {
  timestamps: true
});

// Index cho tìm kiếm nhanh
betHistorySchema.index({ userId: 1, createdAt: -1 });
betHistorySchema.index({ websiteType: 1, betDate: -1 });
betHistorySchema.index({ overallStatus: 1 });

// Method để tính toán thống kê
betHistorySchema.methods.updateStatistics = function() {
  this.totalAccountsUsed = this.accountsUsed.length;
  this.successfulBets = this.accountsUsed.filter(acc => acc.betStatus === 'success').length;
  this.failedBets = this.accountsUsed.filter(acc => acc.betStatus === 'failed').length;
  
  // Cập nhật trạng thái tổng thể
  if (this.successfulBets === this.totalAccountsUsed) {
    this.overallStatus = 'completed';
  } else if (this.successfulBets > 0) {
    this.overallStatus = 'partial_success';
  } else if (this.failedBets === this.totalAccountsUsed) {
    this.overallStatus = 'failed';
  }
};

// Static method để tạo orderCode unique
betHistorySchema.statics.generateOrderCode = function() {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BET${timestamp}${random}`;
};

module.exports = mongoose.model('BetHistory', betHistorySchema);