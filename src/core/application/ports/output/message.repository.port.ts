import { Message } from '../../../domain/entities/message';
import { Chat } from '../../../domain/entities/chat';

export interface MessageRepository {
  saveMessage(message: Message): Promise<void>;
  getMessagesByChat(chatId: string, limit?: number, offset?: number): Promise<Message[]>;
  updateMessageStatus(messageId: string, status: 'delivered' | 'read'): Promise<void>;
  markChatAsRead(chatId: string): Promise<void>; // optional, untuk reset unread
  getChats(): Promise<Chat[]>; // untuk list chat di UI CS
  assignChatToAgent(chatId: string, agentId: string): Promise<void>;
}