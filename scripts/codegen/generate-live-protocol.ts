import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const protoRoot = join(root, 'proto');
const generatedRoot = join(root, 'src/modules/live/generated/proto');
const buf = join(root, 'node_modules/.bin/buf');
const oxfmt = join(root, 'node_modules/.bin/oxfmt');
const protocGenEs = join(root, 'node_modules/.bin/protoc-gen-es');
const check = process.argv.includes('--check');
const temporaryRoot = await mkdtemp(join(tmpdir(), 'chroviewer-live-proto-'));

try {
  const template = {
    version: 'v2',
    plugins: [{ local: protocGenEs, out: temporaryRoot, opt: ['target=ts'] }],
  };
  const generationProcess = Bun.spawn([buf, 'generate', protoRoot, '--template', JSON.stringify(template), '--clean'], {
    cwd: root,
    stderr: 'pipe',
    stdout: 'pipe',
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    generationProcess.exited,
    new Response(generationProcess.stdout).text(),
    new Response(generationProcess.stderr).text(),
  ]);
  if (exitCode !== 0) throw new Error(`live protocol generation failed\n${stderr || stdout}`);

  const formatProcess = Bun.spawn([oxfmt, '--write', temporaryRoot], { cwd: root, stderr: 'pipe', stdout: 'ignore' });
  const formatExitCode = await formatProcess.exited;
  if (formatExitCode !== 0) {
    throw new Error(`generated live protocol formatting failed\n${await new Response(formatProcess.stderr).text()}`);
  }

  const generatedProtocolRoot = join(temporaryRoot, 'scoresaber/live/v1');
  const files = (await readdir(generatedProtocolRoot)).filter((file) => file.endsWith('_pb.ts')).sort();
  if (check) {
    const destinationRoot = join(generatedRoot, 'scoresaber/live/v1');
    const currentFiles = (await readdir(destinationRoot)).filter((file) => file.endsWith('_pb.ts')).sort();
    const drift = new Set(files.length === currentFiles.length ? [] : [relative(root, destinationRoot)]);
    for (const file of files) {
      const generated = await readFile(join(generatedProtocolRoot, file), 'utf8');
      const destination = join(destinationRoot, file);
      const current = (await Bun.file(destination).exists()) ? await readFile(destination, 'utf8') : '';
      if (current !== generated) drift.add(relative(root, destination));
    }
    if (drift.size > 0) {
      throw new Error(
        `generated live protocol is stale:\n${[...drift].map((file) => `- ${file}`).join('\n')}\nrun bun run proto:generate`,
      );
    }
  } else {
    await rm(generatedRoot, { force: true, recursive: true });
    await cp(temporaryRoot, generatedRoot, { recursive: true });
  }
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}
