import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { ChatsService } from './chats.service';

@Controller('chats')
@UseGuards(FirebaseAuthGuard)
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.chats.list(user.uid);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.chats.get(user.uid, id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.chats.remove(user.uid, id);
    return { deleted: true };
  }
}
