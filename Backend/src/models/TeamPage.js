const mongoose = require('mongoose');

const TeamPageSchema = new mongoose.Schema(
  {
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
    // Optional linkage to the user that created/last updated the page.
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    created_by_user_code: {
      type: String,
      required: false,
      uppercase: true,
      trim: true,
      index: true,
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

TeamPageSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('TeamPage', TeamPageSchema);


