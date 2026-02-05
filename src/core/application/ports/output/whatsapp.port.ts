import { Message } from '../../../domain/entities/message';
import { Chat } from '../../../domain/entities/chat';

export interface WhatsappPort {
  initialize(): Promise<void>;  // Init Baileys, scan QR jika perlu

  // Event listeners (dipanggil sekali saat bootstrap)
  onMessage(callback: (message: Message) => Promise<void>): void;
  onReceiptUpdate(callback: (update: { messageId: string; status: 'delivered' | 'read' }) => void): void;
  onPresenceUpdate(callback: (update: { chatId: string; isOnline: boolean; isTyping: boolean; lastSeen?: Date }) => void): void;

  // Operasi kirim
  sendMessage(chatId: string, content: { text?: string; quotedId?: string; media?: any }): Promise<string>; // return message ID
  sendTyping(chatId: string, isTyping: boolean): Promise<void>;
  pinMessage(chatId: string, messageId: string, pin: boolean): Promise<void>;

  // Query
  getChat(chatId: string): Promise<Chat | null>;
}