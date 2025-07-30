const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Kết nối MongoDB thành công'))
  .catch(err => console.error('Lỗi kết nối MongoDB:', err));

// Schema đơn giản
const userSchema = new mongoose.Schema({
  username: String,
  password: String
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function createUsers() {
  try {
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('123456', salt); // Password chung cho user test
    const adminHashedPassword = await bcrypt.hash('admin', salt);
    
    // Tạo các user
    const users = [
      { username: 'admin', password: adminHashedPassword },
      { username: 'user1', password: hashedPassword },
      { username: 'user2', password: hashedPassword },
      { username: 'user3', password: hashedPassword },
      { username: 'user4', password: hashedPassword },
      { username: 'user5', password: hashedPassword },
      { username: 'user6', password: hashedPassword },
      { username: 'user7', password: hashedPassword },
      { username: 'user8', password: hashedPassword },
      { username: 'user9', password: hashedPassword },
      { username: 'user10', password: hashedPassword },
    ];
    
    // Xóa users cũ (nếu có)
    await User.deleteMany({});
    
    // Tạo users mới
    await User.insertMany(users);
    
    console.log('Đã tạo thành công các tài khoản:');
    users.forEach(user => {
      console.log(`- Username: ${user.username}, Password: ${user.username === 'admin' ? 'admin' : '123456'}`);
    });
  } catch (error) {
    console.error('Lỗi tạo users:', error);
    process.exit(1);
  }
}

createUsers();