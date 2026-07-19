import { DynamicModule, Module } from '@nestjs/common';
import { Pool } from 'pg';
import {
  EmbeddingModule,
  POSTGRES_POOL,
} from '../embeddings/embedding.module';
import { RAG_OPTIONS } from './rag.constants';
import { RagModuleOptions, RagService } from './rag.service';

@Module({})
export class RagModule {
  static register(
    pool: Pool,
    options: RagModuleOptions = {},
  ): DynamicModule {
    return {
      module: RagModule,
      imports: [EmbeddingModule.register(pool)],
      providers: [
        { provide: POSTGRES_POOL, useValue: pool },
        { provide: RAG_OPTIONS, useValue: options },
        RagService,
      ],
      exports: [RagService],
    };
  }
}
