import { SendMessageUseCasePort } from '../ports/input/send-message.use-case.port';
import { WhatsappPort } from '../ports/output/whatsapp.port';
import { MessageRepository } from '../ports/output/message.repository.port';
import { NotificationPort } from '../ports/output/notification.port';

import { Message } from '../../domain/entities/message';

export class SendMessageUseCase implements SendMessageUseCasePort {
  constructor(
    private whatsappPort: WhatsappPort,
    private messageRepository: MessageRepository,
    private notificationPort: NotificationPort
  ) {}

  async execute(
    dto: {
      chatId: string;
      text?: string;
      quotedId?: string;
      media?: any;
      tempId?: string;
    }
  ): Promise<string> {
    console.log('[UseCase] Mulai kirim pesan:', dto);

    const now = new Date();

    const outgoingMessage: Message = {
      id: '',
      chatId: dto.chatId,
      from: 'me',
      fromMe: true,
      text: dto.text,
      quotedMessageId: dto.quotedId,
      status: 'sending',
      timestamp: now,
      isPinned: false,
    };

    try {
      const sendResult = await this.whatsappPort.sendMessage(dto.chatId, {
        text: dto.text,
        quotedId: dto.quotedId,
      });

      const { messageId, timestamp } = sendResult;

      console.log('[UseCase] Berhasil kirim, messageId:', messageId);

      outgoingMessage.id = messageId;
      outgoingMessage.timestamp = new Date(timestamp * 1000);
      outgoingMessage.status = 'sent';

      await this.messageRepository.saveMessage(outgoingMessage);

      if (dto.tempId) {
        this.notificationPort.notifyMessageAck({
          tempId: dto.tempId,
          message: outgoingMessage,
        });
      }

      return messageId;
    } catch (error) {
      console.error('[UseCase] Gagal mengirim pesan:', error);

      if (outgoingMessage.id) {
        outgoingMessage.status = 'failed';
        await this.messageRepository.saveMessage(outgoingMessage).catch(() => {});
      }

      throw error;
    }
  }
}