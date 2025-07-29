const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  accessToken: {
    type: String,
    default: null
  },
  tokenExpiry: {
    type: Date,
    default: null
  },
  proxy: {
    type: String,
    default: null
  },
  points: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'proxy_error'],
    default: 'active'
  },
  websiteType: {
    type: String,
    enum: ['sgd666', 'one789'],
    required: true,
    default: 'sgd666'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Virtual field để kiểm tra trạng thái proxy
accountSchema.virtual('proxyStatus').get(function() {
  if (this.status === 'proxy_error') {
    return 'Lỗi proxy';
  }
  return this.proxy ? 'Có proxy' : 'Thiếu proxy';
});

// Method để kiểm tra token còn hạn không
accountSchema.methods.isTokenValid = function() {
  return this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry;
};

module.exports = mongoose.model('Account', accountSchema);