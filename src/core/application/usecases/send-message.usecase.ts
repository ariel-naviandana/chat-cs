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

  async execute(dto: { chatId: string; text?: string; quotedId?: string; media?: any }): Promise<string> {
  console.log('[UseCase] Mulai kirim pesan:', dto);

  const message: Partial<Message> = {
    chatId: dto.chatId,
    from: 'agent',
    text: dto.text,
    quotedMessageId: dto.quotedId,
    status: 'sent',
    timestamp: new Date(),
    isPinned: false,
  };

  try {
    const messageId = await this.whatsappPort.sendMessage(dto.chatId, {
      text: dto.text,
      quotedId: dto.quotedId,
    });
    console.log('[UseCase] Dapat messageId dari Baileys:', messageId);

    message.id = messageId;
    await this.messageRepository.saveMessage(message as Message);
    this.notificationPort.notifyNewMessage(message as Message);

    return messageId;
  } catch (error) {
    console.error('[UseCase] ERROR saat kirim:', error);
    throw error;
  }
}
}