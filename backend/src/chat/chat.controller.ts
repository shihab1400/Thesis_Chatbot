import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { MessageDto, SendMessageDto } from './chat.dto';
import { ChatService } from './chat.service';
import { ChatsService } from './chats.service';

@Controller('chat')
@UseGuards(FirebaseAuthGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly chats: ChatsService,
  ) {}

  @Post()
  async send(@Body() dto: SendMessageDto, @CurrentUser() user: AuthUser) {
    let title: string | undefined;
    let history: MessageDto[] = [];
    if (dto.chatId) {
      ({ title, history } = await this.chats.prepare(user.uid, dto.chatId));
    }

    const { reply, sources } = await this.chat.reply([
      ...history,
      { role: 'user', content: dto.message },
    ]);

    // Saved only after the model answered, so a failed request leaves no half-chat.
    const saved = await this.chats.save(
      user.uid, dto.chatId, title, dto.message, reply, sources,
    );
    return { chatId: saved.id, title: saved.title, updatedAt: saved.updatedAt, reply, sources };
  }
}
