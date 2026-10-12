const $ = id => document.getElementById(id);
const state = { data: null, selected: null, filter: 'all', query: '', mode: 'working', hideContext: false, reviewed: {}, loading: false };
const demo = new URLSearchParams(location.search).has('demo') || !['127.0.0.1', 'localhost'].includes(location.hostname);
function readStored(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function writeStored(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { toast('Browser storage is unavailable; progress lasts for this session.'); } }
state.reviewed = readStored('patchscope:reviews:v1', {});
if (!state.reviewed || typeof state.reviewed !== 'object' || Array.isArray(state.reviewed)) state.reviewed = {};
if (readStored('patchscope:theme', 'light') === 'dark') document.documentElement.classList.add('dark');
function node(tag, className, text) { const n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; }
function reviewKey(file) { return `${state.data.repoId}:${state.mode}:${file.path}:${file.id}`; }
function isReviewed(file) { return Boolean(state.reviewed[reviewKey(file)]); }
function visibleFiles() { return (state.data?.files || []).filter(f => f.path.toLowerCase().includes(state.query.toLowerCase()) && (state.filter === 'all' || isReviewed(f) === (state.filter === 'reviewed'))); }
function current() { return state.data?.files.find(f => f.path === state.selected); }
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2500); }
function select(path) { state.selected = path; render(); }
function navigate(offset) { const files = visibleFiles(); if (!files.length) return; const i = files.findIndex(f => f.path === state.selected); select(files[(i + offset + files.length) % files.length].path); }
function toggleReview() {
  const file = current(); if (!file) return;
  const key = reviewKey(file); const done = !isReviewed(file);
  if (done) state.reviewed[key] = Date.now(); else delete state.reviewed[key];
  // Bound storage across repositories and changed versions.
  state.reviewed = Object.fromEntries(Object.entries(state.reviewed).sort((a,b) => b[1] - a[1]).slice(0, 2000));
  writeStored('patchscope:reviews:v1', state.reviewed); render(); toast(done ? 'Reviewed. One step closer.' : 'Reopened for review.');
}
function render() {
  if (!state.data) return;
  const { files } = state.data; const visible = visibleFiles();
  if (!visible.some(f => f.path === state.selected)) state.selected = visible[0]?.path || null;
  const count = files.filter(isReviewed).length; const percent = files.length ? Math.round(count / files.length * 100) : 0;
  $('repo-name').textContent = state.data.name;
  $('branch').textContent = `⑂ ${state.data.branch}`;
  $('file-count').textContent = String(files.length);
  $('metric-files').textContent = String(files.length);
  $('metric-add').textContent = `+${files.reduce((n,f) => n + f.additions,0).toLocaleString()}`;
  $('metric-del').textContent = `−${files.reduce((n,f) => n + f.deletions,0).toLocaleString()}`;
  $('metric-review').textContent = `${count} / ${files.length}`;
  $('percent').textContent = `${percent}%`;
  $('ring-fill').style.strokeDashoffset = String(264 * (1 - percent / 100));
  $('scope').textContent = state.mode === 'staged' ? 'Index → HEAD' : 'Tracked files → HEAD';
  document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('active', b.dataset.filter === state.filter); b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter)); });
  document.querySelectorAll('[data-mode]').forEach(b => { b.classList.toggle('active', b.dataset.mode === state.mode); b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)); });
  const notices = [];
  if (demo) notices.push('Demo workspace · sample changes. Run PatchScope locally to review your own repository.');
  if (state.data.untracked) notices.push(`${state.data.untracked} untracked file(s) excluded. Stage new files in Git to include them.`);
  if (state.data.totalFiles > files.length) notices.push(`Showing the first ${files.length} of ${state.data.totalFiles} files. Split very large changes into smaller reviews.`);
  $('notice').hidden = notices.length === 0; $('notice').textContent = notices.join(' ');
  const list = $('files'); list.replaceChildren();
  for (const file of visible) {
    const parts = file.path.split('/'); const name = parts.pop();
    const button = node('button', `file-button${file.path === state.selected ? ' selected' : ''}`);
    button.setAttribute('aria-current', String(file.path === state.selected));
    button.setAttribute('aria-label', `${file.path}${isReviewed(file) ? ', reviewed' : ''}`);
    const info = node('span', 'file-info'); info.append(node('span','file-name',name),node('span','file-dir', parts.join('/') || 'root'));
    button.append(node('span','file-icon', file.binary ? '◇' : '{ }'), info, node('span','file-status',isReviewed(file) ? '✓' : '·'));
    button.onclick = () => select(file.path); list.append(button);
  }
  if (!visible.length) list.append(node('div','empty', 'No matching files.'));
  const map = $('map'); map.replaceChildren();
  for (const file of files) {
    const segment = node('button', file.path === state.selected ? 'selected' : '');
    segment.style.flexGrow = String(Math.max(file.additions + file.deletions, 1));
    segment.title = `${file.path} · +${file.additions} −${file.deletions}`;
    segment.setAttribute('aria-label', segment.title);
    segment.onclick = () => { state.filter = 'all'; state.query = ''; $('search').value = ''; select(file.path); };
    map.append(segment);
  }
  renderDiff();
}
function renderDiff() {
  const area = $('review'); area.replaceChildren(); const file = current();
  if (!file) { const empty = node('div','diff-card empty'); empty.append(node('strong','',state.data.files.length ? 'All clear here.' : 'A clean slate.'), node('span','',state.data.files.length ? 'Try another filter to see more changes.' : 'Your tracked files match this review scope.')); area.append(empty); return; }
  const card = node('article','diff-card'); const header = node('div','diff-header'); const title = node('div','diff-title');
  title.append(node('h2','',file.path), node('span','',file.oldPath ? `Renamed from ${file.oldPath}` : `${file.kind} · ${file.hunks.length} ${file.hunks.length === 1 ? 'hunk' : 'hunks'}`));
  const stats = node('div','line-stats'); stats.append(node('span','green',`+${file.additions}`),node('span','red',`−${file.deletions}`));
  const review = node('button',`review-button${isReviewed(file) ? ' done' : ''}`,isReviewed(file) ? '✓ Reviewed' : 'Mark reviewed'); review.onclick = toggleReview;
  header.append(node('span','file-icon','{ }'),title,stats,review); card.append(header);
  if (file.binary) card.append(node('div','empty','Binary content changed. Open this file with its native viewer.'));
  else if (!file.hunks.length) card.append(node('div','empty','Metadata changed; there are no text hunks to display.'));
  for (const hunk of file.hunks) {
    card.append(node('div','hunk-heading',hunk.header)); const code = node('div','diff-code');
    for (const line of hunk.lines) {
      if (state.hideContext && line.type === 'context') continue;
      const row = node('div',`code-row ${line.type}`);
      row.append(node('span','line-number',line.old ?? ''),node('span','line-number',line.next ?? ''),node('span','code-sign',line.type === 'add' ? '+' : line.type === 'delete' ? '−' : ''),node('span','code-text',line.text)); code.append(row);
    }
    card.append(code);
  }
  if (file.truncated) card.append(node('div','notice','Display capped at 6,000 lines. Use Git or your editor to review the full diff.'));
  const bottom = node('div','diff-footer'); const pos = visibleFiles().findIndex(f => f.path === file.path) + 1;
  const controls = node('div'); const prev = node('button','', '← Previous'); prev.onclick = () => navigate(-1); const next = node('button','','Next →'); next.onclick = () => navigate(1); controls.append(prev,next);
  bottom.append(node('span','',`File ${pos} of ${visibleFiles().length} · Review is saved in this browser`),controls); card.append(bottom); area.append(card);
}
async function load(mode = state.mode) {
  if (state.loading) return;
  state.loading = true; $('refresh').disabled = true;
  try {
    const response = await fetch(demo ? 'demo.json' : `/api/snapshot?mode=${encodeURIComponent(mode)}`);
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Refresh failed.');
    state.mode = mode; state.data = demo && mode === 'staged' ? { ...data, files: data.files.filter(f => f.staged), totalFiles: data.files.filter(f => f.staged).length } : data;
    render();
  } catch (error) {
    $('notice').hidden = false; $('notice').textContent = error.message;
    if (!state.data) $('review').replaceChildren(node('div','diff-card empty','No repository loaded. Run PatchScope from a Git repository, then refresh.'));
  } finally { state.loading = false; $('refresh').disabled = false; }
}
function exportReview() {
  if (!state.data) return;
  const report = { format: 'patchscope-review-v1', repository: state.data.name, head: state.data.head, mode: state.mode, exportedAt: new Date().toISOString(), files: state.data.files.map(f => ({ path: f.path, diffFingerprint: f.id, reviewed: isReviewed(f), additions: f.additions, deletions: f.deletions, displayTruncated: f.truncated })) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})); const a = node('a'); a.href = url; a.download = 'patchscope-review.json'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),1000); toast('Review report exported.');
}
function toggleTheme() { document.documentElement.classList.toggle('dark'); writeStored('patchscope:theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light'); }
const actions = [ { label:'Mark current file reviewed / reopen', key:'R', run:toggleReview }, { label:'Next file',key:'J',run:()=>navigate(1) },{ label:'Previous file',key:'K',run:()=>navigate(-1) },{ label:'Refresh repository',key:'',run:()=>load() },{ label:'Toggle color theme',key:'',run:toggleTheme },{ label:'Export review report',key:'',run:exportReview } ];
function renderCommands() {
  const query = $('command-search').value.toLowerCase(); const list = $('command-list'); list.replaceChildren();
  for (const action of [...actions,...(state.data?.files || []).map(f=>({label:f.path,key:'file',run:()=>{state.filter='all';state.query='';$('search').value='';select(f.path);}}))].filter(a=>a.label.toLowerCase().includes(query))) {
    const b = node('button'); b.append(node('span','',action.label),node('kbd','',action.key)); b.onclick=()=>{$('commands').close();action.run();};list.append(b);
  }
  if (!list.children.length) list.append(node('div','empty','No matching commands or files.'));
}
function openCommands() { $('command-search').value='';renderCommands();$('commands').showModal();$('command-search').focus(); }
$('search').oninput = e => { state.query=e.target.value;render(); };
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render();});
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>load(b.dataset.mode));
$('refresh').onclick=()=>load(); $('theme').onclick=toggleTheme; $('export').onclick=exportReview; $('palette').onclick=openCommands; $('help').onclick=openCommands;
$('close-dialog').onclick=()=> $('commands').close();$('command-search').oninput=renderCommands;
$('hide-context').onclick=()=>{state.hideContext=!state.hideContext;$('hide-context').textContent=state.hideContext?'Show context':'Hide context';$('hide-context').setAttribute('aria-pressed',String(state.hideContext));renderDiff();};
document.addEventListener('keydown',event=>{
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase()==='k') { event.preventDefault(); if (!$('commands').open) openCommands(); return; }
  if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || $('commands').open || event.metaKey || event.ctrlKey || event.altKey) return;
  const key=event.key.toLowerCase(); if(key==='/'){event.preventDefault();$('search').focus();} else if(key==='j')navigate(1); else if(key==='k')navigate(-1); else if(key==='r')toggleReview();else if(key==='?')openCommands();
});
$('demo-badge').hidden=!demo; if(demo)$('privacy-label').textContent='Demo · stored in your browser';
load();
