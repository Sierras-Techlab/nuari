import ts from 'typescript';
import type { Plugin } from 'vite';

// Nest relies on decorator metadata. Match the production TypeScript compiler,
// rather than Vite's default transform, which does not emit this metadata.
export function nestTypescript(): Plugin {
  return {
    name: 'nest-typescript-metadata', enforce: 'pre',
    transform(source, id) {
      if (!id.endsWith('.ts') || id.includes('/node_modules/') || id.includes('/generated/')) return;
      const result = ts.transpileModule(source, {
        fileName: id,
        compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true, sourceMap: true },
      });
      return { code: result.outputText, map: result.sourceMapText };
    },
  };
}
