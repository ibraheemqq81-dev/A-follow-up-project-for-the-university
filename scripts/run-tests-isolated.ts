import { spawn } from 'node:child_process';
import path from 'node:path';

const testFile = path.resolve(process.cwd(), 'departmentPackage.test.ts');
const child = spawn('npx', ['tsx', testFile], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
  },
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
