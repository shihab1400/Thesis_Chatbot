import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** A message as the LLM layer sees it. */
export class MessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  content: string;
}

/** Body of POST /chat. Omit chatId to start a new conversation. */
export class SendMessageDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,64}$/, { message: 'Invalid chat id.' })
  chatId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  message: string;
}
