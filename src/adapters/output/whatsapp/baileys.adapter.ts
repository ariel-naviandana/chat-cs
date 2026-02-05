import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { WhatsappPort } from '../../../core/application/ports/output/whatsapp.port';
import { Message } from '../../../core/domain/entities/message';
import { Chat } from '../../../core/domain/entities/chat';;

export class BaileysAdapter implements WhatsappPort {
  private sock: any = null;

  async initialize(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info/baileys');
  const { version } = await fetchLatestBaileysVersion();

  this.sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    // HAPUS printQRInTerminal: true, atau set false
    printQRInTerminal: false,
    auth: state,
    syncFullHistory: false,
  });

  // Simpan creds
  this.sock.ev.on('creds.update', saveCreds);

  // Handle connection update + tampilkan QR manual
  this.sock.ev.on('connection.update', (update: any) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
  console.log('=== QR CODE UNTUK LOGIN WHATSAPP ===');
  qrcode.generate(qr, { small: true });  // Ini yang bikin kotak-kotak di terminal
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

  // =====================================
  // Event Listeners (dipanggil sekali di bootstrap)
  // =====================================

  onMessage(callback: (message: Message) => Promise<void>): void {
    this.sock.ev.on('messages.upsert', async (m: any) => {
      const msg = m.messages[0];
      if (!msg.message || m.type !== 'notify') return; // skip pesan sistem atau broadcast

      let text = '';
      if (msg.message.conversation) {
        text = msg.message.conversation;
      } else if (msg.message.extendedTextMessage?.text) {
        text = msg.message.extendedTextMessage.text;
      }

      const parsedMessage: Message = {
        id: msg.key.id!,
        chatId: msg.key.remoteJid!,
        from: msg.key.fromMe ? 'agent' : msg.key.participant || msg.key.remoteJid!,
        text,
        status: 'delivered',
        timestamp: new Date((msg.messageTimestamp || 0) * 1000),
        isPinned: false,
        // quotedMessageId & media akan ditambah nanti
      };

      await callback(parsedMessage);
    });
  }

  onReceiptUpdate(callback: (update: { messageId: string; status: 'delivered' | 'read' }) => void): void {
    this.sock.ev.on('message-receipt.update', (updates: any[]) => {
      for (const upd of updates) {
        if (upd.receipt?.readTimestamp) {
          callback({
            messageId: upd.key.id!,
            status: 'read',
          });
        } else if (upd.receipt?.deliveryTimestamp) {
          callback({
            messageId: upd.key.id!,
            status: 'delivered',
          });
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

  // =====================================
  // Operasi Kirim
  // =====================================

  async sendMessage(chatId: string, content: { text?: string; quotedId?: string }): Promise<string> {
  if (!this.sock) throw new Error('Baileys belum diinisialisasi');

  console.log('[Baileys] Mencoba kirim pesan ke:', chatId);
  console.log('[Baileys] Isi pesan:', content);

  const msgContent: any = { text: content.text || '' };

  if (content.quotedId) {
    console.log('[Baileys] Ada quotedId:', content.quotedId);
    msgContent.quoted = { key: { id: content.quotedId }, message: { conversation: '...' } }; // minimal dummy
  }

  try {
    const sent = await this.sock.sendMessage(chatId, msgContent);
    console.log('[Baileys] Sukses kirim! Message key ID:', sent?.key?.id);
    console.log('[Baileys] Full sent object:', sent);
    return sent?.key?.id || '';
  } catch (err) {
    console.error('[Baileys] GAGAL KIRIM PESAN:', err);
    throw err; // lempar error ke atas biar use case tangkap
  }
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

    // Untuk private chat, cukup pakai JID
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
      unreadCount: 0, // nanti hitung dari DB
    };
  }
}