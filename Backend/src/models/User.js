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
    type: String,
    required: true,
    unique: true,
    index: true,
    uppercase: true,
    trim: true
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

/**
 * Generate a unique user code with format: XXXXXXU (6 random digits + U suffix)
 */
UserSchema.statics.generateUserCode = async function() {
  let userCode;
  let isUnique = false;
  
  while (!isUnique) {
    // Generate 6 random digits
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    userCode = `${randomDigits}U`;
    
    // Check if code already exists
    const existing = await this.findOne({ user_code: userCode });
    if (!existing) {
      isUnique = true;
    }
  }
  
  return userCode;
};

// Index for efficient queries
UserSchema.index({ user_email: 1 });

// Static method to find or create user
UserSchema.statics.findOrCreateUser = async function(userData) {
  let user = await this.findOne({ user_code: userData.user_code.toUpperCase() });
  
  if (!user) {
    // Generate user_code if not provided
    const userCode = userData.user_code || await this.generateUserCode();
    user = await this.create({
      user_name: userData.user_name,
      user_email: userData.user_email,
      user_code: userCode.toUpperCase()
    });
  }
  
  return user;
};

// Static method to find user by code
UserSchema.statics.findByCode = function(userCode) {
  return this.findOne({ user_code: userCode.toUpperCase() });
};

module.exports = mongoose.model('User', UserSchema);

