import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  AIRPORT_PART_IDS, AIRPORT_PIVOTS, airportPartOrigin, fitAirportParts,
  identityAirportParts, moveAirportPart, partPoint,
} from './airport-parts';

test('airport retains four independently addressable components', () => {
  assert.deepEqual([...AIRPORT_PART_IDS], ['terminal', 'runway', 'tower', 'airplane']);
  const parts=identityAirportParts();
  for (const id of AIRPORT_PART_IDS) {
    assert.deepEqual(partPoint(AIRPORT_PIVOTS[id],id,parts),AIRPORT_PIVOTS[id]);
  }
});

test('fitting airport does not mutate a separate placement', () => {
  const original=identityAirportParts();
  const fitted=fitAirportParts(0.1);
  assert.equal(original.runway.scale,1);
  assert.equal(original.terminal.scale,1);
  assert.notEqual(fitted.runway.scale,original.runway.scale);
  assert.notEqual(fitted.terminal.scale,original.terminal.scale);
});

test('moving one airport part preserves the other component settings', () => {
  const placement={
    elementKey:'airport-test',glbUrl:'/models/world-assets/airport_cycle_30min.glb',
    position:[10,0,20] as [number,number,number],rotationY:0,scale:0.1,
    airportParts:identityAirportParts(),
  };
  const before=airportPartOrigin(placement,'tower');
  const updated=moveAirportPart(placement,'tower',[before[0]+5,before[1],before[2]-3]);
  const after=airportPartOrigin(updated,'tower');
  assert.ok(Math.abs(after[0]-before[0]-5)<1e-8);
  assert.ok(Math.abs(after[2]-before[2]+3)<1e-8);
  assert.deepEqual(updated.airportParts.terminal,placement.airportParts.terminal);
  assert.deepEqual(updated.airportParts.runway,placement.airportParts.runway);
  assert.deepEqual(updated.airportParts.airplane,placement.airportParts.airplane);
  assert.deepEqual(placement.airportParts.tower.offset,[0,0,0]);
});
