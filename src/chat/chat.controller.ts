import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { RagService } from '../rag/rag.service';

export interface ChatRequest {
  question: string;
}

export interface ChatResponse {
  answer: string;
}

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly ragService: RagService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async chat(@Body() request: ChatRequest): Promise<ChatResponse> {
    if (
      !request ||
      typeof request.question !== 'string' ||
      !request.question.trim()
    ) {
      this.logger.warn('Rejected chat request: question must be a non-empty string.');
      throw new BadRequestException('question must be a non-empty string.');
    }

    const question = request.question.trim();
    this.logger.log(`Received chat request (questionLength=${question.length}).`);

    try {
      const result = await this.ragService.answer(question);
      this.logger.log('Chat request completed successfully.');

      return { answer: result.answer };
    } catch (error) {
      this.logger.error(
        `Chat request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
