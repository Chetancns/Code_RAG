import { DynamicModule, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { CodeChunkerModule } from '../code-chunker/code-chunker.module';
import { EmbeddingModule } from '../embeddings/embedding.module';
import { FileWatcherService } from './file-watcher.service';

@Module({})
export class FileWatcherModule {
  static register(pool: Pool): DynamicModule {
    return {
      module: FileWatcherModule,
      imports: [CodeChunkerModule, EmbeddingModule.register(pool)],
      providers: [FileWatcherService],
      exports: [FileWatcherService],
    };
  }
}
