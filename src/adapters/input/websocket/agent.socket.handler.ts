import { Server, Socket } from 'socket.io';
import { SendMessageUseCase } from '../../../core/application/usecases/send-message.usecase';
import { Message } from '../../../core/domain/entities/message';

export function setupAgentSocket(
  io: Server,
  sendMessageUseCase: SendMessageUseCase
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
  });
}