import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(read('voice/manifest.json'));
test('witness recordings have matching audio hashes, source text and distinct casts',()=>{
 const config=JSON.parse(read('tools/korean_performance.json'));
 const voices=[];
 for(const id of ['tape1',...Array.from({length:6},(_,i)=>`mtape_${i+1}`)]){
  const line=manifest[id],direction=config.lines[id];
  assert.equal(line.nofile,undefined,id);
  assert.equal(sha(read(`voice/${id}.mp3`)),line.generation.audio_sha256,id);
  assert.equal(sha(JSON.stringify(line.text)),direction.source_sha256,id);
  assert.ok(line.dur>3&&line.dur<60,id);
  assert.equal(line.generation.voice_id,config.speakers[line.spk].voice_id,id);
  if(id.startsWith('mtape_'))voices.push(line.generation.voice_id);
 }
 assert.equal(new Set(voices).size,6);
});
test('all school cue files match the credited asset manifest',()=>{
 const pack=JSON.parse(read('assets/sfx/manifest.json'));
 assert.equal(pack.cues.length,3);
 for(const cue of pack.cues){assert.equal(sha(read(`assets/sfx/${cue.file}`)),cue.sha256);assert.ok(read(`assets/sfx/${cue.file}`).length>1000);}
 assert.match(read('assets/sfx/CREDITS.md').toString(),/Membeth[\s\S]*CC0/);
});
