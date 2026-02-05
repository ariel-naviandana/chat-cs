import { Server } from 'socket.io';
import { NotificationPort } from '../../../core/application/ports/output/notification.port';
import { Message } from '../../../core/domain/entities/message';

export class SocketNotificationAdapter implements NotificationPort {
  constructor(private io: Server) {}

  notifyNewMessage(message: Message): void {
    this.io.to('all-agents').emit('newMessage', message);
  }

  notifyTyping(chatId: string, isTyping: boolean): void {
    this.io.to('all-agents').emit('typing', { chatId, isTyping });
  }

  notifyOnlineStatus(chatId: string, isOnline: boolean, lastSeen?: Date): void {
    this.io.to('all-agents').emit('presence', {
      chatId,
      isOnline,
      lastSeen: lastSeen ? lastSeen.toISOString() : null
    });
  }

  notifyReceipt(messageId: string, status: 'delivered' | 'read'): void {
    this.io.to('all-agents').emit('receipt', { messageId, status });
  }
}