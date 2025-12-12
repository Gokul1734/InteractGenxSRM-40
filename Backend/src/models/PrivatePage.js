const mongoose = require('mongoose');

const PrivatePageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    user_code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: 'Untitled',
      maxlength: 200,
    },
    contentHtml: {
      type: String,
      default: '<p></p>',
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

PrivatePageSchema.index({ user: 1, updatedAt: -1 });

module.exports = mongoose.model('PrivatePage', PrivatePageSchema);


