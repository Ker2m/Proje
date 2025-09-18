const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT token doğrulama middleware'i
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Erişim token\'ı gerekli'
      });
    }

    // Token'ı doğrula
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Kullanıcıyı veritabanından kontrol et
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz token - kullanıcı bulunamadı'
      });
    }

    if (user.is_active === false) {
      return res.status(401).json({
        success: false,
        message: 'Hesabınız deaktif durumda'
      });
    }

    // Kullanıcı bilgisini request'e ekle
    req.user = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token süresi dolmuş'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Token doğrulama hatası'
    });
  }
};

// Opsiyonel authentication (token varsa doğrula, yoksa devam et)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (user && user.is_active !== false) {
      req.user = {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // Opsiyonel auth'da hata durumunda kullanıcıyı null yap ve devam et
    req.user = null;
    next();
  }
};

module.exports = {
  authenticateToken,
  optionalAuth
};
