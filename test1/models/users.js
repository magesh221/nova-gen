import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254, index: true },
    passwordHash: { type: String, select: false },
    // Read only for a one-time migration from the original users collection.
    password: { type: String, select: false },
    status: { type: String, enum: ['active', 'disabled'], default: 'active', index: true },
    lastLoginAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: Date.now },
}, { timestamps: true, versionKey: false });

userSchema.index({ email: 1 }, { unique: true });

export default mongoose.models.User || mongoose.model('User', userSchema);
