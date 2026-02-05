import express from 'express';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { setupAgentSocket } from '../adapters/input/websocket/agent.socket.handler';

import { BaileysAdapter } from '../adapters/output/whatsapp/baileys.adapter';
import { MongooseMessageRepository } from '../adapters/output/database/mongoose/message.repository.adapter';
import { SocketNotificationAdapter } from '../adapters/output/notification/socket.notification.adapter';

import { SendMessageUseCase } from '../core/application/usecases/send-message.usecase';

dotenv.config();

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  }

  const app = express();
  app.use(express.json());

  const httpServer = http.createServer(app);
  const io = new SocketServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  const whatsappAdapter = new BaileysAdapter();
  await whatsappAdapter.initialize();

  const messageRepo = new MongooseMessageRepository();
  const notificationAdapter = new SocketNotificationAdapter(io);

  const sendMessageUseCase = new SendMessageUseCase(
    whatsappAdapter,
    messageRepo,
    notificationAdapter
  );

  setupAgentSocket(io, sendMessageUseCase);

    // INCOMING MESSAGE dari WhatsApp (customer kirim ke kita)
  // di server.ts
const OUR_NUMBER = '6282132102349@s.whatsapp.net'; // ganti dengan nomor kamu

whatsappAdapter.onMessage(async (message) => {
  await messageRepo.saveMessage(message);

  const isFromUs = message.from === OUR_NUMBER || message.from.includes('status@broadcast');

  if (!isFromUs) {
    io.to('all-agents').emit('newMessage', message);
  } else {
    console.log('[Server] Pesan keluar dari kita — tidak dibroadcast');
  }
});

  whatsappAdapter.onPresenceUpdate((update) => {
    console.log('[Baileys] Presence update:', update);
    notificationAdapter.notifyOnlineStatus(
      update.chatId,
      update.isOnline,
      update.lastSeen
    );
    notificationAdapter.notifyTyping(update.chatId, update.isTyping);
  });

  whatsappAdapter.onReceiptUpdate((update) => {
  console.log('[Server] 📬 Receipt update diterima:', update);

  messageRepo.updateMessageStatus(update.messageId, update.status)
    .catch(err => console.error('Gagal update status di DB:', err));

  // Pastikan emit ini berjalan
  console.log('[Server] ➤ Emit receipt ke all-agents:', update.messageId, update.status);
  notificationAdapter.notifyReceipt(update.messageId, update.status);
});

  app.post('/api/test-send', async (req, res) => {
    const { chatId, text } = req.body;
    if (!chatId || !text) {
      return res.status(400).json({ error: 'chatId dan text wajib' });
    }

    try {
      const messageId = await sendMessageUseCase.execute({ chatId, text });
      res.json({ success: true, messageId });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
    console.log('Scan QR di terminal untuk login WhatsApp...');
  });
}

startServer().catch((err) => {
  console.error('Error saat start server:', err);
  process.exit(1);
});