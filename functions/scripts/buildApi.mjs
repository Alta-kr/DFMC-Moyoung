import ts from '../../client/node_modules/typescript/lib/typescript.js';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../../', import.meta.url);
await mkdir(new URL('functions/lib/', root), { recursive: true });
const sources = ['functions/src/legacyApi.ts', ...['identity','legacyManagers','legacyParticipation','legacyFeedReader'].map(name => `client/src/firebase/${name}.ts`)];
for (const path of sources) {
  const source = (await readFile(new URL(path, root), 'utf8'))
    .replaceAll("'firebase/firestore'", "'../src/adminFirestore.js'")
    .replaceAll("'../../../functions/src/dateTime.js'", "'../src/dateTime.js'")
    .replaceAll("'./identity.ts'", "'./identity.js'");
  const compiled = ts.transpileModule(source, { fileName: path, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  if (compiled.diagnostics?.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(compiled.diagnostics, {
    getCurrentDirectory: () => fileURLToPath(root), getCanonicalFileName: name => name, getNewLine: () => '\n',
  }));
  await writeFile(new URL('functions/lib/' + path.split('/').pop().replace('.ts','.js'), root), compiled.outputText);
}
