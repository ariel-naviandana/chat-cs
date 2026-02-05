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
      tempId?: string;          // ← tambahkan ini (dari client)
    }
  ): Promise<string> {
    console.log('[UseCase] Mulai kirim pesan:', dto);

    const now = new Date();

    // 1. Buat entitas pesan dengan status awal 'sending'
    const outgoingMessage: Message = {
      id: '', // akan diisi setelah kirim
      chatId: dto.chatId,
      from: 'me',               // atau ganti dengan nomor WA kamu nanti
      fromMe: true,             // sangat penting!
      text: dto.text,
      quotedMessageId: dto.quotedId,
      status: 'sending',        // atau 'sent' kalau mau langsung
      timestamp: now,
      isPinned: false,
    };

    try {
      // 2. Kirim ke WhatsApp (sekarang return object)
      const sendResult = await this.whatsappPort.sendMessage(dto.chatId, {
        text: dto.text,
        quotedId: dto.quotedId,
        // media: dto.media,      // nanti kalau sudah support
      });

      const { messageId, timestamp } = sendResult;

      console.log('[UseCase] Berhasil kirim, messageId:', messageId);

      // 3. Update dengan data real dari WhatsApp
      outgoingMessage.id = messageId;
      outgoingMessage.timestamp = new Date(timestamp * 1000);
      outgoingMessage.status = 'sent'; // sekarang resmi terkirim ke server WA

      // 4. Simpan ke database
      await this.messageRepository.saveMessage(outgoingMessage);

      // 5. Beritahu client yang mengirim (khusus untuk mengganti tempId → real id)
      if (dto.tempId) {
        this.notificationPort.notifyMessageAck({
          tempId: dto.tempId,
          message: outgoingMessage,
        });
      }

      // 6. (Opsional) Broadcast ke agent lain hanya jika multi-agent
      // Jika hanya 1 agent atau kamu ingin hindari duplikat di UI,
      // lebih baik **tidak broadcast** pesan keluar ke 'all-agents'
      // this.notificationPort.notifyNewMessage(outgoingMessage);

      return messageId;
    } catch (error) {
      console.error('[UseCase] Gagal mengirim pesan:', error);

      // Optional: update status ke 'failed' kalau sudah punya id
      if (outgoingMessage.id) {
        outgoingMessage.status = 'failed';
        await this.messageRepository.saveMessage(outgoingMessage).catch(() => {});
      }

      throw error;
    }
  }
}