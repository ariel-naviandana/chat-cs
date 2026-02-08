import { Message } from '../../../domain/entities/message';
import { Chat } from '../../../domain/entities/chat';

export interface WhatsappPort {
  initialize(): Promise<void>;

  onMessage(callback: (message: Message) => Promise<void>): void;
  onReceiptUpdate(callback: (update: { messageId: string; status: 'delivered' | 'read' }) => void): void;
  onPresenceUpdate(callback: (update: { chatId: string; isOnline: boolean; isTyping: boolean; lastSeen?: Date }) => void): void;

  sendMessage(
    chatId: string,
    content: { text?: string; quotedId?: string; media?: any }
  ): Promise<{ messageId: string; timestamp: number }>;

  sendTyping(chatId: string, isTyping: boolean): Promise<void>;
  pinMessage(chatId: string, messageId: string, pin: boolean): Promise<void>;

  getChat(chatId: string): Promise<Chat | null>;

  subscribePresence(chatId: string): Promise<void>;
}