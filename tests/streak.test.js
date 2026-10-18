import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDreamRecallStreak } from '../statstab.js';

// A dream at 08:00 local time, `daysAgo` days before today
function dreamOn(daysAgo) {
    const date = new Date();
    date.setHours(8, 0, 0, 0);
    date.setDate(date.getDate() - daysAgo);
    return { timestamp: date.toISOString() };
}

// One dream on each day from `first` to `last` days ago
const dreamsOnDays = (first, last) => Array.from({ length: last - first + 1 }, (_, i) => dreamOn(first + i));

test('a streak longer than a year is counted in full', () => {
    assert.equal(calculateDreamRecallStreak(dreamsOnDays(0, 499)), 500);
});

test('a streak with no dream yet today counts from yesterday', () => {
    assert.equal(calculateDreamRecallStreak(dreamsOnDays(1, 10)), 10);
});

test('a day without a dream ends the streak', () => {
    assert.equal(calculateDreamRecallStreak([...dreamsOnDays(0, 2), ...dreamsOnDays(4, 9)]), 3);
});

test('no dream today or yesterday means no streak', () => {
    assert.equal(calculateDreamRecallStreak(dreamsOnDays(2, 9)), 0);
});

test('several dreams on one day count as one day', () => {
    assert.equal(calculateDreamRecallStreak([...dreamsOnDays(0, 4), dreamOn(0), dreamOn(3)]), 5);
});
