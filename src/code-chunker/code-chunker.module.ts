import { Module } from '@nestjs/common';
import { CSharpParserModule } from '../csharp-parser/csharp-parser.module';
import { CodeChunkerService } from './code-chunker.service';

@Module({
  imports: [CSharpParserModule],
  providers: [CodeChunkerService],
  exports: [CodeChunkerService],
})
export class CodeChunkerModule {}
