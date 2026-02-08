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
        console.log('[Socket Handler] ➤ sendMessage received from', socket.id);
        
        const messageId = await sendMessageUseCase.execute({
          chatId: data.chatId,
          text: data.text,
          quotedId: data.quotedId
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

        console.log('[Socket Handler] ➤ emit messageAck to sender');
        socket.emit('messageAck', { 
          tempId: data.tempId, 
          message 
        });

        console.log('[Socket Handler] ➤ TIDAK emit newMessage (client sudah punya optimistic UI)');
        // JANGAN emit newMessage di sini! Client sudah punya optimistic bubble

      } catch (err) {
        console.error('[Socket Handler] ❌ Error:', err);
        socket.emit('messageSent', { 
          success: false, 
          tempId: data.tempId,
          error: (err as Error).message 
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Agent disconnected:', socket.id);
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
  socket.emit('chatsList', { error: err.message });
  console.error('[loadChats] Error:', err.message);
}
});
  });
}