import { Module } from '@nestjs/common';
import { CSharpParserService } from './csharp-parser.service';

@Module({
  providers: [CSharpParserService],
  exports: [CSharpParserService],
})
export class CSharpParserModule {}
