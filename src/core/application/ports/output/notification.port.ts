import { Message } from '../../../domain/entities/message';

export interface NotificationPort {
  /**
   * Broadcast pesan baru ke agent yang relevan
   * (biasanya digunakan untuk pesan masuk dari customer)
   */
  notifyNewMessage(message: Message): void;

  /**
   * Memberitahu client bahwa pesan yang baru saja dikirim (outgoing)
   * sudah berhasil dikirim ke WhatsApp → update tempId menjadi real ID
   */
  notifyMessageAck(payload: {
    tempId?: string;
    message: Message;
  }): void;

  notifyTyping(chatId: string, isTyping: boolean): void;

  notifyOnlineStatus(chatId: string, isOnline: boolean, lastSeen?: Date): void;

  /**
   * Update status pesan (delivery/read receipt)
   */
  notifyReceipt(messageId: string, status: 'delivered' | 'read'): void;
}