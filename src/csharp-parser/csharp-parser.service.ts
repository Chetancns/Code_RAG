import { Injectable } from '@nestjs/common';
import Parser = require('tree-sitter');
import CSharp = require('tree-sitter-c-sharp');

export interface CSharpChunk {
  chunkKey: string;
  content: string;
  endLine: number;
  filePath: string;
  name: string;
  startLine: number;
  type: 'class' | 'method';
}

@Injectable()
export class CSharpParserService {
  private readonly parser = new Parser();

  constructor() {
    this.parser.setLanguage(CSharp);
  }

  parse(source: string, filePath: string): CSharpChunk[] {
    const tree = this.parser.parse(source);
    const chunks: CSharpChunk[] = [];

    this.visit(tree.rootNode, filePath, chunks);

    return chunks;
  }

  private visit(
    node: Parser.SyntaxNode,
    filePath: string,
    chunks: CSharpChunk[],
  ): void {
    if (node.type === 'class_declaration') {
      chunks.push(this.toChunk(node, filePath, 'class'));

      const body = node.namedChildren.find(
        (child) => child.type === 'class_body',
      );

      if (body) {
        for (const child of body.namedChildren) {
          if (child.type === 'method_declaration') {
            chunks.push(this.toChunk(child, filePath, 'method'));
          }
        }
      }
    }

    for (const child of node.namedChildren) {
      this.visit(child, filePath, chunks);
    }
  }

  private toChunk(
    node: Parser.SyntaxNode,
    filePath: string,
    type: CSharpChunk['type'],
  ): CSharpChunk {
    const name = node.childForFieldName('name')?.text ?? '<anonymous>';

    return {
      content: node.text,
      chunkKey: this.createChunkKey(node, type, name),
      endLine: node.endPosition.row + 1,
      filePath,
      name,
      startLine: node.startPosition.row + 1,
      type,
    };
  }

  private createChunkKey(
    node: Parser.SyntaxNode,
    type: CSharpChunk['type'],
    name: string,
  ): string {
    if (type === 'method') {
      return `${type}:${name}:${node.childForFieldName('parameters')?.text ?? ''}`;
    }

    return `${type}:${name}`;
  }
}
