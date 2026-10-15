import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { RetrievalService } from './retrieval.service';

@Module({
  controllers: [ChatController, ChatsController],
  providers: [ChatService, ChatsService, RetrievalService],
})
export class ChatModule {}
