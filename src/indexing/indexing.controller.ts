import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { IndexingResult, IndexingService } from './indexing.service';

interface IndexRequest {
  folderPath: string;
}

@Controller('index')
export class IndexingController {
  constructor(private readonly indexingService: IndexingService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async index(@Body() request: IndexRequest): Promise<IndexingResult> {
    if (
      !request ||
      typeof request.folderPath !== 'string' ||
      !request.folderPath.trim()
    ) {
      throw new BadRequestException('folderPath must be a non-empty string.');
    }

    try {
      return await this.indexingService.index(request.folderPath.trim());
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Not a directory:')) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }
}
