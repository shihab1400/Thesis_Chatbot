import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { MessageDto } from './chat.dto';
import { Source } from './chat.types';

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const HISTORY_FOR_MODEL = 6;

/**
 * Firestore layout (only this backend touches it):
 *   users/{uid}
 *   users/{uid}/chats/{chatId}                 { title, createdAt, updatedAt }
 *   users/{uid}/chats/{chatId}/messages/{id}   { role, content, sources?, order }
 */
@Injectable()
export class ChatsService {
  constructor(private readonly firebase: FirebaseService) {}

  private chats(uid: string) {
    return this.firebase.db.collection(`users/${uid}/chats`);
  }

  private async require(uid: string, id: string) {
    if (!ID.test(id)) throw new NotFoundException('Chat not found.');
    const ref = this.chats(uid).doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Chat not found.');
    return { ref, data: snap.data() as { title: string } };
  }

  async list(uid: string) {
    const snap = await this.chats(uid).orderBy('updatedAt', 'desc').limit(100).get();
    return snap.docs.map((d) => {
      const c = d.data();
      return { id: d.id, title: c.title as string, updatedAt: c.updatedAt as number };
    });
  }

  async get(uid: string, id: string) {
    const { ref, data } = await this.require(uid, id);
    const snap = await ref.collection('messages').orderBy('order', 'asc').get();
    return {
      id,
      title: data.title,
      messages: snap.docs.map((d) => {
        const m = d.data();
        return { role: m.role, content: m.content, sources: m.sources ?? [] };
      }),
    };
  }

  /** Verifies ownership and returns the last few messages for the model. */
  async prepare(uid: string, id: string) {
    const { ref, data } = await this.require(uid, id);
    const snap = await ref
      .collection('messages')
      .orderBy('order', 'desc')
      .limit(HISTORY_FOR_MODEL)
      .get();
    const history: MessageDto[] = snap.docs
      .map((d) => d.data())
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }));
    return { title: data.title, history };
  }

  /** Saves the user message and the reply together (all-or-nothing). */
  async save(
    uid: string,
    chatId: string | undefined,
    existingTitle: string | undefined,
    userText: string,
    reply: string,
    sources: Source[],
  ) {
    const now = Date.now();
    const ref = chatId ? this.chats(uid).doc(chatId) : this.chats(uid).doc();
    const title = existingTitle ?? this.makeTitle(userText);

    const batch = this.firebase.db.batch();
    if (chatId) batch.update(ref, { updatedAt: now });
    else batch.set(ref, { title, createdAt: now, updatedAt: now });

    const messages = ref.collection('messages');
    batch.set(messages.doc(), { role: 'user', content: userText, order: now });
    batch.set(messages.doc(), { role: 'assistant', content: reply, sources, order: now + 1 });
    await batch.commit();

    return { id: ref.id, title, updatedAt: now };
  }

  async remove(uid: string, id: string) {
    const { ref } = await this.require(uid, id);
    await this.firebase.db.recursiveDelete(ref); // chat + its messages
  }

  private makeTitle(text: string) {
    const t = text.replace(/\s+/g, ' ').trim();
    return t.length > 60 ? t.slice(0, 57) + '…' : t;
  }
}
