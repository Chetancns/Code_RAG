import { DynamicModule, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { CodeChunkerModule } from '../code-chunker/code-chunker.module';
import { EmbeddingModule } from '../embeddings/embedding.module';
import { FolderScannerModule } from '../folder-scanner/folder-scanner.module';
import { FileWatcherModule } from '../watcher/file-watcher.module';
import { IndexingController } from './indexing.controller';
import { IndexingService } from './indexing.service';

@Module({})
export class IndexingModule {
  static register(pool: Pool): DynamicModule {
    return {
      module: IndexingModule,
      imports: [
        FolderScannerModule,
        CodeChunkerModule,
        EmbeddingModule.register(pool),
        FileWatcherModule.register(pool),
      ],
      controllers: [IndexingController],
      providers: [IndexingService],
    };
  }
}
