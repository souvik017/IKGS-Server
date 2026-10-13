const multer = require('multer');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!config.upload.allowedTypes.includes(file.mimetype)) {
    return cb(ApiError.badRequest('Only JPEG, PNG or WEBP images are allowed'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize, files: 2 },
});

/** Accept up to two service images under the field name "images". */
const uploadServiceImages = upload.array('images', 2);

/** Accept a single gallery image under the field name "image". */
const uploadGalleryImage = upload.single('image');

module.exports = { upload, uploadServiceImages, uploadGalleryImage };
