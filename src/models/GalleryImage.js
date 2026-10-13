const mongoose = require('mongoose');

const galleryImageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Image title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    /** Descriptive alt text is required for accessibility and SEO. */
    alt: {
      type: String,
      required: [true, 'Alt text is required'],
      trim: true,
      maxlength: [200, 'Alt text cannot exceed 200 characters'],
    },
    caption: {
      type: String,
      trim: true,
      maxlength: [300, 'Caption cannot exceed 300 characters'],
    },
    image: {
      type: String,
      required: [true, 'An image is required'],
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    published: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

galleryImageSchema.index({ published: 1, displayOrder: 1, createdAt: -1 });
galleryImageSchema.index({ category: 1 });

// Only published images may appear on the public website.
galleryImageSchema.statics.publicFilter = function publicFilter() {
  return { published: true };
};

module.exports = mongoose.model('GalleryImage', galleryImageSchema);
