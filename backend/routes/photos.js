const express = require('express');
const { 
  uploadPhoto, 
  getPhotos, 
  getMyPhotos, 
  updatePhoto,
  deletePhoto, 
  likePhoto,
  upload
} = require('../controllers/photoController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Tüm route'lar authentication gerektirir
router.use(authenticateToken);

// POST /api/photos/upload - Fotoğraf yükle
router.post('/upload', upload.single('photo'), uploadPhoto);

// GET /api/photos/feed - Fotoğraf akışını getir
router.get('/feed', getPhotos);

// GET /api/photos/my - Kendi fotoğraflarını getir
router.get('/my', getMyPhotos);

// PUT /api/photos/:photoId - Fotoğraf güncelle
router.put('/:photoId', updatePhoto);

// DELETE /api/photos/:photoId - Fotoğraf sil
router.delete('/:photoId', deletePhoto);

// POST /api/photos/:photoId/like - Fotoğraf beğen/beğenme
router.post('/:photoId/like', likePhoto);

module.exports = router;
