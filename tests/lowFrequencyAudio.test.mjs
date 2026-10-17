import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../audio.js',import.meta.url),'utf8');
test('continuous low-frequency drones and mechanical hum sources are removed',()=>{ for(const text of ['[43.6, 44.4','const hum =','const mh =','function buildGen','[55, 58.3, 82.4, 87.3]','o.frequency.setTargetAtTime(f / 2']) assert.equal(source.includes(text),false,text); assert.match(source,/export function setGenHum\(v, dt\) \{ \/\*/); });
test('nonvoice buses use two high-pass stages while voice remains unfiltered',()=>{assert.ok(source.includes("if (k === 'voice') { bus[k].connect(master); return; }"));assert.ok(source.includes('i < 2'));assert.ok(source.includes("hp.type = 'highpass'"));assert.ok(source.includes('hp.frequency.value = 180'));assert.ok(source.includes('node.connect(master)'));});
