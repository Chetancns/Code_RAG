import 'dotenv/config';
import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { ChatModule } from './chat/chat.module';
import { IndexingModule } from './indexing/indexing.module';
import { RagModuleOptions } from './rag/rag.service';

const databaseUrl = process.env.DATABASE_URL ?? createDatabaseUrl();

function createDatabaseUrl(): string {
  const password = process.env.DB_PASS;

  if (!password) {
    throw new Error('DATABASE_URL or DB_PASS must be configured.');
  }

  const user = process.env.DB_USER ?? 'postgres';
  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '5432';
  const database = process.env.DB_NAME ?? 'code_rag';

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(
    password,
  )}@${host}:${port}/${encodeURIComponent(database)}`;
}

const databasePool = new Pool({ connectionString: databaseUrl });
const chatProviderEnv = process.env.CHAT_PROVIDER;

if (
  chatProviderEnv &&
  chatProviderEnv !== 'ollama' &&
  chatProviderEnv !== 'openai'
) {
  throw new Error('CHAT_PROVIDER must be either "ollama" or "openai".');
}

const chatProvider = (chatProviderEnv ?? 'ollama') as 'ollama' | 'openai';

const chatProfileEnv = process.env.CHAT_PROFILE;

if (
  chatProfileEnv &&
  chatProfileEnv !== 'balanced' &&
  chatProfileEnv !== 'fast'
) {
  throw new Error('CHAT_PROFILE must be either "balanced" or "fast".');
}

const chatProfile = (chatProfileEnv ?? 'balanced') as 'balanced' | 'fast';

const ragOptions: RagModuleOptions = {
  chatProvider,
  ollamaUrl: process.env.OLLAMA_URL,
  model: process.env.OLLAMA_MODEL,
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL ?? getDefaultOpenAiModel(chatProfile),
  openAiMaxOutputTokens:
    parsePositiveInt(process.env.OPENAI_MAX_OUTPUT_TOKENS) ??
    getDefaultOpenAiMaxOutputTokens(chatProfile),
  requestTimeoutMs:
    parsePositiveInt(process.env.CHAT_TIMEOUT_MS) ??
    parsePositiveInt(process.env.OLLAMA_TIMEOUT_MS) ??
    getDefaultTimeoutMs(chatProfile),
  retrievalLimit:
    parsePositiveInt(process.env.RAG_RETRIEVAL_LIMIT) ??
    getDefaultRetrievalLimit(chatProfile),
};

function getDefaultOpenAiModel(profile: 'balanced' | 'fast'): string {
  return profile === 'fast' ? 'gpt-4o-mini' : 'gpt-4o-mini';
}

function getDefaultOpenAiMaxOutputTokens(
  profile: 'balanced' | 'fast',
): number | undefined {
  return profile === 'fast' ? 250 : undefined;
}

function getDefaultTimeoutMs(profile: 'balanced' | 'fast'): number | undefined {
  return profile === 'fast' ? 30_000 : undefined;
}

function getDefaultRetrievalLimit(profile: 'balanced' | 'fast'): number | undefined {
  return profile === 'fast' ? 4 : undefined;
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

@Module({
  imports: [
    ChatModule.register(databasePool, ragOptions),
    IndexingModule.register(databasePool),
  ],
})
export class AppModule {}
