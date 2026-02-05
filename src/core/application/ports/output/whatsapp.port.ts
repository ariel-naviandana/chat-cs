import { Message } from "../../../domain/entities/message";
import { Chat } from "@whiskeysockets/baileys";

export interface WhatsappPort {
  initialize(): Promise<void>;

  // Event listeners
  onMessage(callback: (message: Message) => Promise<void>): void;
  onReceiptUpdate(callback: (update: { messageId: string; status: 'delivered' | 'read' }) => void): void;
  onPresenceUpdate(callback: (update: { chatId: string; isOnline: boolean; isTyping: boolean; lastSeen?: Date }) => void): void;

  // Operasi kirim - DIUBAH menjadi mengembalikan object
  sendMessage(
    chatId: string,
    content: { text?: string; quotedId?: string; media?: any }
  ): Promise<{ messageId: string; timestamp: number }>;

  sendTyping(chatId: string, isTyping: boolean): Promise<void>;
  pinMessage(chatId: string, messageId: string, pin: boolean): Promise<void>;

  // Query
  getChat(chatId: string): Promise<Chat | null>;
}