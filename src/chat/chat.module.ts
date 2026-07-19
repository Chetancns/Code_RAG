import { DynamicModule, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { RagModule } from '../rag/rag.module';
import { RagModuleOptions } from '../rag/rag.service';
import { ChatController } from './chat.controller';

@Module({})
export class ChatModule {
  static register(
    pool: Pool,
    options: RagModuleOptions = {},
  ): DynamicModule {
    return {
      module: ChatModule,
      imports: [RagModule.register(pool, options)],
      controllers: [ChatController],
    };
  }
}
