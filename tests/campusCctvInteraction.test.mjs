import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('CCTV interaction opens monitor before using supported click sound',async()=>{
 const source=await readFile(new URL('../game.js',import.meta.url),'utf8');
 assert.match(source,/if \(k === 'guardcctv'\) \{ openGuardCctv\(\); sfx.click\(\); return; \}/);
 assert.doesNotMatch(source,/sfx\.radio\(\)/);
 assert.match(source,/function openGuardCctv\(\) \{ if\(!campusCctv\) return; state='cctv';/);
});
