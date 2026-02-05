import { Message } from '../../../domain/entities/message';

export interface NotificationPort {
  notifyNewMessage(message: Message): void; // broadcast ke agent yang relevan
  notifyTyping(chatId: string, isTyping: boolean): void;
  notifyOnlineStatus(chatId: string, isOnline: boolean, lastSeen?: Date): void;
  notifyReceipt(messageId: string, status: 'delivered' | 'read'): void;
}