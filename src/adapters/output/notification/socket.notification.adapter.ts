import { Server } from 'socket.io';
import { NotificationPort } from '../../../core/application/ports/output/notification.port';
import { Message } from '../../../core/domain/entities/message';

export class SocketNotificationAdapter implements NotificationPort {
  constructor(private io: Server) {}

  /**
   * Broadcast pesan baru (umumnya pesan masuk dari customer)
   */
  notifyNewMessage(message: Message): void {
    this.io.to('all-agents').emit('newMessage', message);
  }

  /**
   * Memberitahu client bahwa pesan keluar sudah berhasil dikirim ke WhatsApp
   * → digunakan untuk mengganti tempId menjadi real message ID di UI
   */
  notifyMessageAck(payload: { tempId?: string; message: Message }): void {
    this.io.to('all-agents').emit('messageAck', payload);

    // Optional: log untuk debugging
    console.log(
      '[SocketNotification] Emitted messageAck:',
      payload.tempId ? `tempId=${payload.tempId}` : '(no tempId)',
      '→ real id =',
      payload.message.id
    );
  }

  notifyTyping(chatId: string, isTyping: boolean): void {
    this.io.to('all-agents').emit('typing', { chatId, isTyping });
  }

  notifyOnlineStatus(chatId: string, isOnline: boolean, lastSeen?: Date): void {
    this.io.to('all-agents').emit('presence', {
      chatId,
      isOnline,
      lastSeen: lastSeen ? lastSeen.toISOString() : null,
    });
  }

  notifyReceipt(messageId: string, status: 'delivered' | 'read'): void {
    this.io.to('all-agents').emit('receipt', { messageId, status });
  }
}