import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import path from 'node:path';
const exec = promisify(execFile);
const EMPTY = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
export async function git(cwd, args) {
  const { stdout } = await exec('git', ['--no-pager', '--literal-pathspecs', '-c', 'core.quotepath=false', ...args], {
    cwd, encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' }
  });
  return stdout;
}
export function parseNumstat(raw) {
  const fields = raw.split('\0'); const files = [];
  for (let i = 0; i < fields.length; i++) {
    if (!fields[i]) continue;
    const match = /^(\d+|-)\t(\d+|-)\t([\s\S]*)$/.exec(fields[i]);
    if (!match) throw new Error('Invalid Git numstat output');
    let name = match[3], oldPath = null;
    if (!name) { oldPath = fields[++i]; name = fields[++i]; }
    if (!name) throw new Error('Missing Git filename');
    files.push({ path: name, oldPath, additions: Number(match[1]) || 0, deletions: Number(match[2]) || 0, binary: match[1] === '-' });
  }
  return files;
}
export function parseDiff(raw) {
  const hunks = []; let hunk = null, old = 0, next = 0;
  for (const line of raw.split('\n')) {
    const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/.exec(line);
    if (match) {
      old = Number(match[1]); next = Number(match[3]);
      hunk = { header: line, lines: [] }; hunks.push(hunk); continue;
    }
    if (!hunk || !/^[ +\\-]/.test(line)) continue;
    const type = line[0] === '+' ? 'add' : line[0] === '-' ? 'delete' : line[0] === '\\' ? 'note' : 'context';
    hunk.lines.push({ type, text: line.slice(1), old: type === 'add' || type === 'note' ? null : old++, next: type === 'delete' || type === 'note' ? null : next++ });
  }
  return hunks;
}
export async function snapshot(cwd, mode = 'working') {
  if (!['working', 'staged'].includes(mode)) throw new Error('Unsupported review mode');
  const root = (await git(cwd, ['rev-parse', '--show-toplevel'])).trim();
  let head;
  try { head = (await git(root, ['rev-parse', '--verify', 'HEAD'])).trim(); } catch { head = EMPTY; }
  const branch = (await git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => 'unborn')).trim();
  const args = ['diff', '--no-ext-diff', '--no-textconv', '--find-renames', ...(mode === 'staged' ? ['--cached'] : []), head];
  const all = parseNumstat(await git(root, [...args, '--numstat', '-z', '--']));
  const selected = all.slice(0, 150); const files = [];
  for (let offset = 0; offset < selected.length; offset += 4) {
    files.push(...await Promise.all(selected.slice(offset, offset + 4).map(async file => {
      const raw = await git(root, [...args, '--unified=4', '--', ...(file.oldPath ? [file.oldPath] : []), file.path]);
      const id = createHash('sha256').update(raw).digest('hex');
      const hunks = parseDiff(raw); let count = 0, truncated = false;
      const limited = hunks.map(h => ({ ...h, lines: h.lines.filter(() => { if (++count > 6000) { truncated = true; return false; } return true; }) })).filter(h => h.lines.length);
      return { ...file, id, hunks: limited, truncated, kind: file.oldPath ? 'renamed' : raw.includes('new file mode') ? 'added' : raw.includes('deleted file mode') ? 'deleted' : 'modified' };
    })));
  }
  const untracked = (await git(root, ['ls-files', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean).length;
  return { name: path.basename(root), repoId: createHash('sha256').update(root).digest('hex').slice(0, 16), branch, head, mode, files, totalFiles: all.length, untracked, generatedAt: new Date().toISOString() };
}
