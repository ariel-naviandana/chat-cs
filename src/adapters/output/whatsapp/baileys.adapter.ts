import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { WhatsappPort } from '../../../core/application/ports/output/whatsapp.port';
import { Message } from '../../../core/domain/entities/message';
import { Chat } from '../../../core/domain/entities/chat';

export class BaileysAdapter implements WhatsappPort {
  private sock: any = null;
  private sentMessageIds: Set<string> = new Set(); // Track pesan yang kita kirim

  async initialize(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info/baileys');
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      syncFullHistory: false,
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('=== QR CODE UNTUK LOGIN WHATSAPP ===');
        qrcode.generate(qr, { small: true });
        console.log('\nScan kotak-kotak di atas pakai WhatsApp → Perangkat Tertaut → Tautkan Perangkat');
        console.log('QR expire dalam ~20 detik. Kalau hilang, stop & jalankan ulang server.');
      }

      if (connection === 'close') {
        const shouldReconnect =
          (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Connection closed. Reconnecting:', shouldReconnect);
        if (shouldReconnect) {
          this.initialize();
        } else {
          console.log('Logged out. Hapus folder auth_info untuk login ulang.');
        }
      }

      if (connection === 'open') {
        console.log('Baileys berhasil terhubung ke WhatsApp!');
      }
    });
  }

  onMessage(callback: (message: Message) => Promise<void>): void {
    this.sock.ev.on('messages.upsert', async (m: any) => {
      const msg = m.messages[0];

      console.log('[Baileys] messages.upsert event:', {
        id: msg.key.id,
        fromMe: msg.key.fromMe,
        type: m.type,
        hasMessage: !!msg.message,
      });

      if (!msg.message || m.type !== 'notify') {
        console.log('[Baileys] Skip: tidak ada message atau type bukan notify');
        return;
      }

      // Filter pesan dari diri sendiri (outgoing)
      if (msg.key.fromMe) {
        console.log('[Baileys] Skip: pesan dari kita sendiri (fromMe=true):', msg.key.id);
        return;
      }

      let text = '';
      if (msg.message.conversation) {
        text = msg.message.conversation;
      } else if (msg.message.extendedTextMessage?.text) {
        text = msg.message.extendedTextMessage.text;
      }

      const parsedMessage: Message = {
        id: msg.key.id!,
        chatId: msg.key.remoteJid!,
        from: msg.key.participant || msg.key.remoteJid!,
        fromMe: msg.key.fromMe === true,          // ← WAJIB ditambahkan
        text,
        status: 'delivered',
        timestamp: new Date((msg.messageTimestamp || 0) * 1000),
        isPinned: false,
      };

      console.log(
        '[Baileys] ✅ Processing incoming message:',
        parsedMessage.id,
        'text:',
        parsedMessage.text,
      );
      await callback(parsedMessage);
    });
  }

  // Method sendMessage – return object { messageId, timestamp }
  async sendMessage(
    chatId: string,
    content: { text?: string; quotedId?: string; media?: any },
  ): Promise<{ messageId: string; timestamp: number }> {
    if (!this.sock) throw new Error('Baileys belum diinisialisasi');

    console.log('[Baileys] Mencoba kirim pesan ke:', chatId);
    console.log('[Baileys] Isi pesan:', content);

    const msgContent: any = { text: content.text || '' };

    if (content.quotedId) {
      console.log('[Baileys] Ada quotedId:', content.quotedId);
      msgContent.quoted = { key: { id: content.quotedId }, message: { conversation: '...' } };
    }

    // nanti bisa ditambahkan penanganan media di sini jika sudah support

    try {
      const sent = await this.sock.sendMessage(chatId, msgContent);
      const messageId = sent?.key?.id || '';

      if (!messageId) {
        throw new Error('Tidak mendapatkan message ID dari Baileys');
      }

      console.log('[Baileys] Sukses kirim! Message key ID:', messageId);
      console.log('[Baileys] Full sent object:', JSON.stringify(sent, null, 2));

      this.sentMessageIds.add(messageId);

      return {
        messageId,
        timestamp: sent.messageTimestamp || Math.floor(Date.now() / 1000),
      };
    } catch (err) {
      console.error('[Baileys] GAGAL KIRIM PESAN:', err);
      throw err;
    }
  }

    onReceiptUpdate(callback: (update: { messageId: string; status: 'delivered' | 'read' }) => void): void {
  this.sock.ev.on('message-receipt.update', (updates: any[]) => {
    console.log('[Baileys] 🔔 message-receipt.update EVENT MASUK !');
    console.log('[Baileys] Jumlah update:', updates.length);
    console.log('[Baileys] Raw updates:', JSON.stringify(updates, null, 2));

    for (const upd of updates) {
      console.log('[Baileys] Processing receipt untuk ID:', upd.key?.id);

      if (upd.receipt?.readTimestamp) {
        console.log('[Baileys] ✅ READ receipt diterima untuk:', upd.key.id);
        callback({
          messageId: upd.key.id!,
          status: 'read',
        });
      } else if (upd.receipt?.deliveryTimestamp) {
        console.log('[Baileys] ✅ DELIVERED receipt diterima untuk:', upd.key.id);
        callback({
          messageId: upd.key.id!,
          status: 'delivered',
        });
      } else {
        console.log('[Baileys] ⚠️ Receipt tanpa delivery/read timestamp:', JSON.stringify(upd, null, 2));
      }
    }
  });
}

  onPresenceUpdate(callback: (update: { chatId: string; isOnline: boolean; isTyping: boolean; lastSeen?: Date }) => void): void {
    this.sock.ev.on('presence.update', (upd: any) => {
      const isTyping = upd.presence?.unavailable !== true && upd.presence?.composing;
      callback({
        chatId: upd.id,
        isOnline: upd.presence?.available === true,
        isTyping: !!isTyping,
        lastSeen: upd.lastSeen ? new Date(upd.lastSeen * 1000) : undefined,
      });
    });
  }

  async sendTyping(chatId: string, isTyping: boolean): Promise<void> {
    if (!this.sock) return;
    await this.sock.presenceSubscribe(chatId);
    await this.sock.sendPresenceUpdate(isTyping ? 'composing' : 'paused', chatId);
  }

  async pinMessage(chatId: string, messageId: string, pin: boolean): Promise<void> {
    if (!this.sock) return;
    await this.sock.chatModify(
      { pin: { action: pin ? 'pin' : 'unpin', messageId } },
      chatId
    );
  }

  async getChat(chatId: string): Promise<Chat | null> {
    if (!this.sock) return null;

    const isGroup = chatId.includes('@g.us');
    let participants: string[] = [];

    if (isGroup) {
      try {
        const metadata = await this.sock.groupMetadata(chatId);
        participants = metadata.participants.map((p: any) => p.id);
      } catch {}
    }

    return {
      id: chatId,
      isGroup,
      participants,
      unreadCount: 0,
    };
  }
}