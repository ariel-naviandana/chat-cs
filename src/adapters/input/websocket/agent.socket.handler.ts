import { Server, Socket } from 'socket.io';
import { SendMessageUseCase } from '../../../core/application/usecases/send-message.usecase';
import { Message } from '../../../core/domain/entities/message';
import { MessageRepository } from '../../../core/application/ports/output/message.repository.port';

export function setupAgentSocket(
  io: Server,
  sendMessageUseCase: SendMessageUseCase,
  messageRepo: MessageRepository
) {
  io.on('connection', (socket: Socket) => {
    console.log('[Socket] Agent connected:', socket.id);
    socket.join('all-agents');

    socket.on('sendMessage', async (data: { chatId: string; text?: string; quotedId?: string; tempId?: string }) => {
      try {
        console.log('[Socket Handler] sendMessage received from', socket.id);

        const messageId = await sendMessageUseCase.execute({
          chatId: data.chatId,
          text: data.text,
          quotedId: data.quotedId,
          tempId: data.tempId
        });

        const message: Message = {
          id: messageId,
          chatId: data.chatId,
          from: 'agent',
          fromMe: true,
          text: data.text || '',
          status: 'sent',
          timestamp: new Date(),
          isPinned: false
        };

        socket.emit('messageAck', { tempId: data.tempId, message });
        console.log('[Socket Handler] messageAck emitted to sender');

      } catch (err: any) {
        console.error('[Socket Handler] sendMessage error:', err.message);
        socket.emit('messageSent', { success: false, tempId: data.tempId, error: err.message });
      }
    });

    socket.on('startTyping', (data: { chatId: string }) => {
      console.log('[Socket Handler] startTyping for', data.chatId);
      socket.to('all-agents').emit('typing', { chatId: data.chatId, isTyping: true });
    });

    socket.on('stopTyping', (data: { chatId: string }) => {
      console.log('[Socket Handler] stopTyping for', data.chatId);
      socket.to('all-agents').emit('typing', { chatId: data.chatId, isTyping: false });
    });

    socket.on('loadChats', async () => {
      try {
        const chats = await messageRepo.getChats();
        socket.emit('chatsList', chats);
        console.log('[Socket] Sent chats list to', socket.id, 'count:', chats.length);
      } catch (err: any) {
        socket.emit('chatsList', { error: err.message });
        console.error('[loadChats] Error:', err.message);
      }
    });

    socket.on('loadChatHistory', async (data: { chatId: string; limit?: number; offset?: number }) => {
      try {
        const messages = await messageRepo.getMessagesByChat(data.chatId, data.limit || 50, data.offset || 0);
        socket.emit('chatHistory', { chatId: data.chatId, messages });
        console.log('[Socket] Sent history for', data.chatId, 'count:', messages.length);
      } catch (err: any) {
        socket.emit('chatHistory', { error: err.message });
        console.error('[loadChatHistory] Error:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Agent disconnected:', socket.id);
    });
  });
}