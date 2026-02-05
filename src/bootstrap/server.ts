import express from 'express';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { setupAgentSocket } from '../adapters/input/websocket/agent.socket.handler';

import { BaileysAdapter } from '../adapters/output/whatsapp/baileys.adapter';
import { MongooseMessageRepository } from '../adapters/output/database/mongoose/message.repository.adapter'; // nanti kita buat ini
import { SocketNotificationAdapter } from '../adapters/output/notification/socket.notification.adapter'; // nanti kita buat

import { SendMessageUseCase } from '../core/application/usecases/send-message.usecase';

dotenv.config();

async function startServer() {
  // 1. Connect MongoDB
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  }

  // 2. Init Express & Socket.io
  const app = express();
  app.use(express.json());

  const httpServer = http.createServer(app);
  const io = new SocketServer(httpServer, {
    cors: {
      origin: '*', // nanti ubah ke domain frontend kalau deploy
      methods: ['GET', 'POST']
    }
  });

  // 3. Init adapters
  const whatsappAdapter = new BaileysAdapter();
  await whatsappAdapter.initialize(); // ini yang akan print QR di terminal

  const messageRepo = new MongooseMessageRepository(); // placeholder, nanti kita buat file ini
  const notificationAdapter = new SocketNotificationAdapter(io);

  // 4. Init use case
  const sendMessageUseCase = new SendMessageUseCase(
    whatsappAdapter,
    messageRepo,
    notificationAdapter
  );

  setupAgentSocket(io, sendMessageUseCase);

 whatsappAdapter.onMessage(async (message) => {
  await messageRepo.saveMessage(message);
  notificationAdapter.notifyNewMessage(message);
  // Optional: kalau mau kirim typing ke agent lain, bisa tambah logic
});

whatsappAdapter.onPresenceUpdate((update) => {
  console.log('[Baileys] Presence update:', update); // debug
  notificationAdapter.notifyOnlineStatus(
    update.chatId,
    update.isOnline,
    update.lastSeen
  );
  notificationAdapter.notifyTyping(update.chatId, update.isTyping);
});

whatsappAdapter.onReceiptUpdate((update) => {
  console.log('[Baileys] Receipt update:', update); // debug
  notificationAdapter.notifyReceipt(update.messageId, update.status);
});

  // 6. Contoh endpoint sederhana untuk test (nanti diganti controller full)
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

  // 7. Start server
  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
    console.log('Scan QR di terminal untuk login WhatsApp...');
  });
}

// Jalankan server
startServer().catch((err) => {
  console.error('Error saat start server:', err);
  process.exit(1);
});