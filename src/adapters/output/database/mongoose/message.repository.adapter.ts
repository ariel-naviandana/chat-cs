import mongoose from 'mongoose';
import { MessageRepository } from '../../../../core/application/ports/output/message.repository.port';
import { Message } from '../../../../core/domain/entities/message';
import { Chat } from '../../../../core/domain/entities/chat';

// Schema Message (cocok dengan entity Message)
const messageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  chatId: { type: String, required: true, index: true },
  from: { type: String },
  fromMe: { type: Boolean },
  text: { type: String },
  media: {
    type: { type: String },     // image, video, document, dll.
    url: String,
    mimeType: String,
    fileName: String
  },
  quotedMessageId: String,
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  timestamp: { type: Date, default: Date.now, index: true },
  isPinned: { type: Boolean, default: false }
});

const MessageModel = mongoose.models.Message || mongoose.model('Message', messageSchema);

export class MongooseMessageRepository implements MessageRepository {
  async saveMessage(message: Message): Promise<void> {
    try {
      // Cek kalau sudah ada (hindari duplikat dari receipt)
      const existing = await MessageModel.findOne({ id: message.id });
      if (existing) {
        // Update kalau ada perubahan (misal status)
        await MessageModel.updateOne({ id: message.id }, message);
        console.log(`Message updated: ${message.id}`);
      } else {
        const newMessage = new MessageModel(message);
        await newMessage.save();
        console.log(`Message saved to MongoDB: ${message.id}`);
      }
    } catch (err) {
      console.error('Error saving message:', err);
      throw err;
    }
  }

  async updateMessageStatus(messageId: string, status: 'delivered' | 'read'): Promise<void> {
    await MessageModel.updateOne(
      { id: messageId },
      { $set: { status } }
    );
    console.log(`Updated status ${messageId} → ${status}`);
  }

  async markChatAsRead(chatId: string): Promise<void> {
    await MessageModel.updateMany(
      { chatId, status: { $ne: 'read' } },
      { $set: { status: 'read' } }
    );
  }

  async getChats(): Promise<Chat[]> {
  const chatIds = await MessageModel.distinct('chatId');
  const chats = await Promise.all(chatIds.map(async (id) => {
    const lastMessage = await MessageModel.findOne({ chatId: id }).sort({ timestamp: -1 });
    const unreadCount = await MessageModel.countDocuments({ chatId: id, status: { $ne: 'read' } });
    return {
      id,
      isGroup: id.endsWith('@g.us'),
      participants: [], // nanti bisa isi dari groupMetadata kalau perlu
      lastMessage: lastMessage ? lastMessage.toObject() : undefined,
      unreadCount,
      assignedAgent: undefined, // kalau sudah ada auth
    };
  }));
  return chats;
}

async getMessagesByChat(chatId: string, limit = 50, offset = 0): Promise<Message[]> {
  return MessageModel.find({ chatId })
    .sort({ timestamp: -1 })
    .skip(offset)
    .limit(limit)
    .lean() as Promise<Message[]>;
}

  async assignChatToAgent(chatId: string, agentId: string): Promise<void> {
    // Untuk sementara log saja, nanti bisa tambah field di schema Chat terpisah
    console.log(`Assigned chat ${chatId} to agent ${agentId}`);
  }
}