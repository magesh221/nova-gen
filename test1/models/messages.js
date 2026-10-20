import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, default: '', maxlength: 20_000 },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed', required: true },
    model: { type: String, default: null },
    clientMessageId: { type: String, maxlength: 100, default: undefined },
    generationId: { type: String, maxlength: 100, default: undefined },
    replyToMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    attempt: { type: Number, min: 0, default: 0 },
    usage: {
        promptTokens: { type: Number, min: 0, default: null },
        completionTokens: { type: Number, min: 0, default: null },
        totalTokens: { type: Number, min: 0, default: null },
    },
    responseDurationMs: { type: Number, min: 0, default: null },
    errorCode: { type: String, maxlength: 80, default: null },
}, { timestamps: true, versionKey: false });

messageSchema.index({ conversationId: 1, createdAt: 1, _id: 1 });
messageSchema.index({ userId: 1, createdAt: -1, _id: -1 });
messageSchema.index(
    { conversationId: 1, clientMessageId: 1 },
    { unique: true, partialFilterExpression: { clientMessageId: { $type: 'string' } }, name: 'unique_client_message_per_conversation' },
);
messageSchema.index(
    { conversationId: 1, replyToMessageId: 1, attempt: 1 },
    { unique: true, partialFilterExpression: { role: 'assistant', replyToMessageId: { $type: 'objectId' } }, name: 'unique_assistant_attempt' },
);
messageSchema.index(
    { conversationId: 1 },
    { unique: true, partialFilterExpression: { role: 'assistant', status: 'pending' }, name: 'one_pending_assistant_per_conversation' },
);
messageSchema.index({ userId: 1, content: 'text' }, { name: 'message_content_search' });

export default mongoose.models.Message || mongoose.model('Message', messageSchema);
