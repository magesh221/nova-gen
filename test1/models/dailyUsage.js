import mongoose from 'mongoose';

const dailyUsageSchema = new mongoose.Schema({
    key: { type: String, required: true },
    date: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
}, { versionKey: false });

dailyUsageSchema.index({ key: 1, date: 1 }, { unique: true });
dailyUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.DailyUsage || mongoose.model('DailyUsage', dailyUsageSchema);
