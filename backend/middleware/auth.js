const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'Không có token, truy cập bị từ chối' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { userId: decoded.userId };
    req.userId = decoded.userId; // Giữ lại để tương thích với code cũ
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token không hợp lệ' });
  }
};