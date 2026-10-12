import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { git, snapshot, parseDiff, parseNumstat } from '../src/git.js';
async function fixture(t, committed = true) {
  const dir = await mkdtemp(path.join(tmpdir(), 'patchscope-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await git(dir, ['init', '-b', 'main']);
  await git(dir, ['config', 'core.autocrlf', 'false']);
  await git(dir, ['config', 'user.name', 'Test']); await git(dir, ['config', 'user.email', 'test@example.com']);
  if (committed) { await writeFile(path.join(dir, 'hello.txt'), 'one\ntwo\nthree\n'); await git(dir, ['add', '.']); await git(dir, ['commit', '-m', 'baseline']); }
  return dir;
}
test('parses a rename containing tabs and newlines without losing its path', () => {
  assert.deepEqual(parseNumstat('2\t1\t\0old name\t.txt\0new\nname.txt\0'), [{ path: 'new\nname.txt', oldPath: 'old name\t.txt', additions: 2, deletions: 1, binary: false }]);
});
test('hunks preserve line numbers and no-newline markers', () => {
  const [h] = parseDiff('@@ -2,2 +2,2 @@ function\n-two\n+changed\n three\n\\ No newline at end of file\n');
  assert.deepEqual(h.lines.map(l => [l.type,l.old,l.next]), [['delete',2,null],['add',null,2],['context',3,3],['note',null,null]]);
});
test('working includes staged and unstaged changes, staged reads only index', async t => {
  const dir = await fixture(t);
  await writeFile(path.join(dir,'hello.txt'),'one\nstaged\nthree\n'); await git(dir,['add','.']);
  await writeFile(path.join(dir,'hello.txt'),'one\nunstaged\nthree\n');
  const working = await snapshot(dir); const staged = await snapshot(dir,'staged');
  assert.equal(working.files[0].hunks[0].lines.find(l=>l.type==='add').text,'unstaged');
  assert.equal(staged.files[0].hunks[0].lines.find(l=>l.type==='add').text,'staged');
  assert.notEqual(working.files[0].id,staged.files[0].id);
});
test('checkpoint fingerprint changes with patch content', async t => {
  const dir=await fixture(t); await writeFile(path.join(dir,'hello.txt'),'first\n'); const a=await snapshot(dir);
  await writeFile(path.join(dir,'hello.txt'),'second\n');const b=await snapshot(dir);assert.notEqual(a.files[0].id,b.files[0].id);
});
test('untracked files are counted but excluded', async t=>{
  const dir=await fixture(t); await writeFile(path.join(dir,'private.txt'),'excluded');const s=await snapshot(dir);assert.equal(s.untracked,1);assert.equal(s.files.length,0);
});
test('unborn repositories support staged additions',async t=>{
  const dir=await fixture(t,false);await writeFile(path.join(dir,'new.txt'),'hello\n');await git(dir,['add','.']);const s=await snapshot(dir,'staged');assert.equal(s.files[0].kind,'added');assert.equal(s.files[0].additions,1);
});
test('renames and binary files are represented',async t=>{
  const dir=await fixture(t);await rename(path.join(dir,'hello.txt'),path.join(dir,'renamed file.txt'));await writeFile(path.join(dir,'binary.bin'),Buffer.from([0,1,2,3]));await git(dir,['add','.']);const s=await snapshot(dir);assert.equal(s.files.find(f=>f.path==='renamed file.txt').oldPath,'hello.txt');assert.equal(s.files.find(f=>f.path==='binary.bin').binary,true);
});
test('literal special filenames cannot become Git arguments', { skip: process.platform === 'win32' }, async t=>{
  const dir=await fixture(t);const filename='-strange\tname\n.txt';await writeFile(path.join(dir,filename),'safe\n');await git(dir,['add','--',filename]);const s=await snapshot(dir);assert.equal(s.files[0].path,filename);assert.equal(s.files[0].hunks[0].lines[0].text,'safe');
});
test('invalid scope rejected',async()=>{await assert.rejects(snapshot('.','HEAD; echo nope'),/Unsupported/);});

test('pathspec metacharacters are treated as literal filenames', async t => {
  const dir = await fixture(t);
  await writeFile(path.join(dir, '[abc].txt'), 'literal\n');
  await writeFile(path.join(dir, 'a.txt'), 'other\n');
  await git(dir, ['add', '.']);
  const s = await snapshot(dir);
  const file = s.files.find(f => f.path === '[abc].txt');
  assert.equal(file.hunks.length, 1);
  assert.equal(file.hunks[0].lines[0].text, 'literal');
});
