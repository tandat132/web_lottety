const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/accounts');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/sgd666-auth', require('./routes/sgd666Auth')); 
app.use('/api/betting', require('./routes/betting'));
app.use('/api/account-check', require('./routes/accountCheck'));
app.use('/api/bet-history', require('./routes/betHistory'));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Kết nối MongoDB thành công');
    app.listen(PORT, () => {
      console.log(`Server đang chạy trên port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Lỗi kết nối MongoDB:', error);
  });