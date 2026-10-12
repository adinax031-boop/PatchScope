import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../src/server.js';
async function fixture(t) { const server=createServer({cwd:'/not/a/repository'});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));return `http://127.0.0.1:${server.address().port}`; }
test('serves UI with restrictive security headers',async t=>{const base=await fixture(t);const response=await fetch(base);assert.equal(response.status,200);assert.match(await response.text(),/PatchScope/);assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);});
test('host check rejects DNS rebinding',async t=>{const base=await fixture(t);const status=await new Promise((resolve,reject)=>{http.get(base,{headers:{host:'attacker.example'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});assert.equal(status,403);});
test('cross-origin requests are rejected',async t=>{const base=await fixture(t);assert.equal((await fetch(base,{headers:{origin:'https://attacker.example'}})).status,403);assert.equal((await fetch(base,{headers:{'sec-fetch-site':'cross-site'}})).status,403);});
test('writes and unknown asset paths are rejected',async t=>{const base=await fixture(t);assert.equal((await fetch(base,{method:'POST'})).status,405);assert.equal((await fetch(`${base}/src/git.js`)).status,404);});
test('invalid mode is rejected without Git execution',async t=>{const base=await fixture(t);assert.equal((await fetch(`${base}/api/snapshot?mode=invalid`)).status,400);});
test('failure messages do not leak local paths',async t=>{const base=await fixture(t);const response=await fetch(`${base}/api/snapshot`);assert.equal(response.status,500);assert.doesNotMatch(await response.text(),/\/not\/a\/repository/);});
