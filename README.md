# Code RAG (NestJS)

A NestJS-based Retrieval-Augmented Generation (RAG) API for source-code Q&A.

It scans a code folder, chunks files, stores embeddings in PostgreSQL + pgvector, watches for file changes, and answers questions using either OpenAI or Ollama.

## Features

- Indexes code and related files (`.cs`, `.sql`, `.ts`, `.tsx`, `.js`, `.json`)
- Uses local embeddings via `@huggingface/transformers` (`Xenova/all-MiniLM-L6-v2`)
- Stores vectors in Postgres with `pgvector`
- Keeps the index fresh with file watching (`chokidar`)
- Supports chat providers:
  - OpenAI (`CHAT_PROVIDER=openai`)
  - Ollama (`CHAT_PROVIDER=ollama`)

## Project Structure

- `src/indexing`: Index API and indexing workflow
- `src/chat`: Chat API endpoint
- `src/rag`: Retrieval + answer generation
- `src/embeddings`: Embedding generation and vector persistence
- `src/folder-scanner`: Recursive file scanning
- `src/code-chunker`: File chunking logic
- `src/watcher`: File watch + incremental re-indexing

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ with `pgvector` extension available
- npm
- Optional: Ollama (if using local LLM provider)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
copy .env.example .env
```

3. Update `.env` values (DB credentials and provider settings).

4. Start in development mode:

```bash
npm run start:dev
```

Server default port: `3030` (set `PORT` to override).

## Environment Variables

### Database

- `DATABASE_URL` (optional): Full connection string. If omitted, these are used:
  - `DB_HOST`
  - `DB_PORT`
  - `DB_NAME`
  - `DB_USER`
  - `DB_PASS` (required when `DATABASE_URL` is not set)

### Chat / RAG

- `CHAT_PROVIDER`: `openai` or `ollama` (default: `ollama`)
- `CHAT_PROFILE`: `balanced` or `fast` (default: `balanced`)
- `CHAT_TIMEOUT_MS`: Request timeout for chat provider
- `RAG_RETRIEVAL_LIMIT`: Number of chunks retrieved per question

### OpenAI

- `OPENAI_API_KEY` (required when `CHAT_PROVIDER=openai`)
- `OPENAI_MODEL` (default: `gpt-4o-mini`)
- `OPENAI_MAX_OUTPUT_TOKENS` (optional)

### Ollama

- `OLLAMA_URL` (default: `http://localhost:11434`)
- `OLLAMA_MODEL` (default: `qwen3:4b`)
- `OLLAMA_TIMEOUT_MS` (compatibility fallback if `CHAT_TIMEOUT_MS` is not set)

## API

### 1) Index a folder

`POST /index`

Request body:

```json
{
  "folderPath": "C:/path/to/your/repo"
}
```

Response:

```json
{
  "folderPath": "C:/path/to/your/repo",
  "filesIndexed": 42,
  "chunksIndexed": 356
}
```

### 2) Ask a question

`POST /chat`

Request body:

```json
{
  "question": "Where is the indexing workflow implemented?"
}
```

Response:

```json
{
  "answer": "..."
}
```

## Quick Test (PowerShell)

Index:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3030/index -ContentType 'application/json' -Body '{"folderPath":"C:/path/to/repo"}'
```

Chat:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3030/chat -ContentType 'application/json' -Body '{"question":"How does file watching update embeddings?"}'
```

## Build and Run

Build:

```bash
npm run build
```

Run compiled app:

```bash
npm run start
```

## Notes

- The app creates `document_embeddings` table and indexes automatically.
- It also ensures `CREATE EXTENSION IF NOT EXISTS vector` is executed on startup.
- After indexing a folder, a watcher is started to keep embeddings up to date as files change.
