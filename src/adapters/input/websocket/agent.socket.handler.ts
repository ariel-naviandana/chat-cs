import { Server, Socket } from 'socket.io';
import { SendMessageUseCase } from '../../../core/application/usecases/send-message.usecase';

export function setupAgentSocket(
  io: Server,
  sendMessageUseCase: SendMessageUseCase
) {
  io.on('connection', (socket: Socket) => {
    console.log('Agent connected:', socket.id);

    // Agent join room "all-agents" untuk broadcast
    socket.join('all-agents');

    // Agent kirim pesan dari UI
    socket.on('sendMessage', async (data: { chatId: string; text?: string; quotedId?: string }) => {
      try {
        const messageId = await sendMessageUseCase.execute({
          chatId: data.chatId,
          text: data.text,
          quotedId: data.quotedId
        });
        socket.emit('messageSent', { success: true, messageId });
      } catch (err) {
        socket.emit('messageSent', { success: false, error: (err as Error).message });
      }
    });

    // Agent mulai typing di chat tertentu
    socket.on('startTyping', (chatId: string) => {
      // Nanti panggil whatsappPort.sendTyping(chatId, true)
      console.log(`Agent ${socket.id} mulai typing di ${chatId}`);
    });

    socket.on('stopTyping', (chatId: string) => {
      // whatsappPort.sendTyping(chatId, false)
    });

    socket.on('disconnect', () => {
      console.log('Agent disconnected:', socket.id);
    });
  });
}