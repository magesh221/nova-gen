import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120, default: 'New chat' },
    model: { type: String, required: true, default: 'openai/gpt-4o-mini' },
    archived: { type: Boolean, default: false },
    lastMessageAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

conversationSchema.index({ userId: 1, updatedAt: -1, _id: -1 });
conversationSchema.index({ userId: 1, title: 'text' }, { weights: { title: 10 }, name: 'conversation_title_search' });

export default mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
