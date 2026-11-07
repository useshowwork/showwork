const {test} = require('node:test');
const assert = require('node:assert/strict');
const {load} = require('./helpers/load-typescript.cjs');
const {calendarWeek, moveCalendarPeriod} = load('lib/calendarView.ts');
const key = date => [date.getFullYear(),date.getMonth()+1,date.getDate()];
test('week spans month and year boundaries and includes its anchor', () => {
  const days = calendarWeek(new Date(2027,0,1));
  assert.equal(days.length,7);
  assert.deepEqual(key(days[0]),[2026,12,27]);
  assert.deepEqual(key(days[6]),[2027,1,2]);
  assert.ok(days.some(date => date.getDate()===1 && date.getMonth()===0));
});
test('day and week navigation work across leap day and return to the anchor', () => {
  const anchor = new Date(2028,1,28);
  assert.deepEqual(key(moveCalendarPeriod(anchor,'day',1)),[2028,2,29]);
  assert.deepEqual(key(moveCalendarPeriod(anchor,'day',2)),[2028,3,1]);
  assert.deepEqual(key(moveCalendarPeriod(moveCalendarPeriod(anchor,'week',1),'week',-1)),key(anchor));
});
test('monthly navigation cannot skip February from a 31-day anchor', () => {
  assert.deepEqual(key(moveCalendarPeriod(new Date(2027,0,31),'month',1)),[2027,2,1]);
  assert.deepEqual(key(moveCalendarPeriod(new Date(2027,0,31),'month',-1)),[2026,12,1]);
});
