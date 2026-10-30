// DOM 없이 실제 소스의 지도 좌표와 장소 판정을 검사한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUARD_LAYOUT, GUARD_SPUR } from '../guardRoomLayout.js';
const world = readFileSync(new URL('../world.js', import.meta.url), 'utf8');
const map = readFileSync(new URL('../map.js', import.meta.url), 'utf8');
const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const names = ['SLOTS','LAYOUT','GATE_Z','ANNEX','LAYOUT_S','ANNEX_S','MAIN_ZS','WALKWAY','NORTH_Z','ANNEX_DZ','MEGA'];
names.sort((a,b) => world.indexOf('export const '+a+' =') - world.indexOf('export const '+b+' ='));
const constants = names.map(n => { const m = world.match(new RegExp('export const '+n+' = [\\s\\S]*?;')); assert.ok(m, n); return m[0].replace('export ', ''); }).join('\n');
const draw = new Function('GUARD_LAYOUT', 'GUARD_SPUR', constants + '\n' + map.replace(/^import .*;\s*$/gm, '').replace(/export /g, '') + '\nreturn drawMap;')(GUARD_LAYOUT, GUARD_SPUR);
const roomSource = game.match(/function roomAt\([^]*?\n}/)[0];
const roomAt = new Function(constants + '\n' + roomSource + '\nreturn roomAt;')();
function record(floor, labels = false, doors = []) {
  const calls = [], ctx = { measureText: t => ({ width: t.length * 7 }) };
  ctx.fillRect = (...args) => calls.push({ kind: 'fill', color: ctx.fillStyle, args });
  ctx.strokeRect = (...args) => calls.push({ kind: 'stroke', color: ctx.strokeStyle, args });
  ctx.fillText = (...args) => calls.push({ kind: 'text', args });
  for (const name of ['clearRect','save','restore','beginPath','moveTo','lineTo','arc','stroke','fill','closePath','translate','rotate']) ctx[name] = () => {};
  draw(ctx, 0, 0, { floor, cx: 0, cz: 0, scale: 1, labels, doors });
  return calls;
}
const hasRect = (calls, x, z, w, h) => calls.some(c => c.kind === 'fill' && c.args.every((v,i) => Math.abs(v - [x,z,w,h][i]) < 1e-8));
test('11개 층의 미니맵과 전체 지도 렌더링', () => {
  for (let f = 0; f <= 10; f++) for (const labels of [false,true]) assert.ok(record(f, labels).length > 0);
});
test('옥상 남쪽과 확장 구역이 지도에 포함된다', () => {
  assert.ok(hasRect(record(3), -36.3, -9.9, 72.6, 19.8));
  const outside = record(0);
  assert.ok(hasRect(outside, -20, -32, 40, 11.5));
  assert.ok(hasRect(outside, -59, 29.8, 18, 24));   // 대강당 (운동장 서남쪽으로 이전)
  assert.ok(hasRect(outside, -5, -60, 16, 16));
  assert.ok(hasRect(outside, -1.6, -20.5, 5.2, 10.6));
  assert.ok(hasRect(record(4), 12, -34, 12, 20));
});
test('북쪽 외부 공간을 본관 교실로 오인하지 않는다', () => {
  for (const [f,x,z] of [[4,18,-24],[0,-25,-48],[0,0,-26],[0,8,-9.61],[0,8,-9.6]]) assert.equal(roomAt(f,x,z), null);
  for (const [f,x,z,name] of [[0,8,-9.59,'1-1'],[0,8,-3,'1-1'],[0,8,3,'인쇄실'],[1,-16,3,'교장실'],[1,-8,3,'회의실'],[9,0,-3,'언어실 (202)'],[9,0,3,'2층 연결 홀']]) assert.equal(roomAt(f,x,z).name, name);
});
test('이동 출입구는 일반 문 상태와 구분된다', () => {
  const calls = record(0, false, [{x:0,z:0,transition:true},{x:1,z:0,open:true},{x:2,z:0,open:false}]);
  for (const color of ['#74b9e8','#5fc47a','#b04040']) assert.ok(calls.some(c => c.color === color));
  assert.ok(game.includes('...world.doors.filter(d => d.floor === f && d.to)'));
});
test('기계실 사다리 착지점이 필터 탱크를 피한다', () => {
  assert.ok(world.includes('to: { floor: 6, x: -39.4, z: 55.4, yaw: 0 }'));
  const x=-39.4,z=55.4,r=.3;
  assert.equal(x > -41.7-r && x < -40.1+r && z > 55.5-r && z < 57.1+r, false);
});
