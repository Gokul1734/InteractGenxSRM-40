const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  user_name: {
    type: String,
    required: true,
    trim: true
  },
  user_email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  user_code: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
UserSchema.index({ user_email: 1 });

// Static method to find or create user
UserSchema.statics.findOrCreateUser = async function(userData) {
  let user = await this.findOne({ user_code: userData.user_code });
  
  if (!user) {
    user = await this.create({
      user_name: userData.user_name,
      user_email: userData.user_email,
      user_code: userData.user_code
    });
  }
  
  return user;
};

// Static method to find user by code
UserSchema.statics.findByCode = function(userCode) {
  return this.findOne({ user_code: userCode });
};

module.exports = mongoose.model('User', UserSchema);

