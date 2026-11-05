import { describe, it, expect } from 'vitest';
import { bellsIn, loadForVolume, ownedDown, ownedFloor, ownedUp, stepOwned } from './dumbbells';

const OWNED = [2, 4, 6, 8, 10, 12.5, 14, 16];

describe('owned-weight stepping', () => {
  it('next owned bell up and down', () => {
    expect(ownedUp(OWNED, 8)).toBe(10);
    expect(ownedDown(OWNED, 8)).toBe(6);
  });

  it('uneven steps are followed exactly', () => {
    expect(ownedUp(OWNED, 12)).toBe(12.5);
    expect(ownedUp(OWNED, 12.5)).toBe(14);
  });

  it('null at the ends of the list', () => {
    expect(ownedUp(OWNED, 16)).toBeNull();
    expect(ownedDown(OWNED, 2)).toBeNull();
  });

  it('double jump = two bells up', () => {
    expect(ownedUp(OWNED, 8, 2)).toBe(12.5);
  });

  it('a double jump with fewer than two bells above is null, not the top bell', () => {
    expect(ownedUp(OWNED, 14, 2)).toBeNull();
  });

  it('stepOwned stays on the list and holds at the ends', () => {
    expect(stepOwned(OWNED, 8, 1)).toBe(10);
    expect(stepOwned(OWNED, 16, 1)).toBe(16);
    expect(stepOwned(OWNED, 2, -1)).toBe(2);
  });

  it('ownedFloor returns an owned weight at or under the input', () => {
    expect(ownedFloor(OWNED, 11)).toBe(10);
    expect(ownedFloor(OWNED, 1)).toBe(2);
  });
});

describe('bells in a load', () => {
  it('one-arm = 1 bell, otherwise 2', () => {
    expect(bellsIn(true)).toBe(1);
    expect(bellsIn(false)).toBe(2);
  });
});

describe('loadForVolume (as entered / each bell / total)', () => {
  it('as entered counts the number as typed', () => {
    expect(loadForVolume(10, 'as', 2)).toBe(10);
  });

  it('each bell counts the number per bell, times the bells in use', () => {
    expect(loadForVolume(10, 'each', 2)).toBe(20);
    expect(loadForVolume(10, 'each', 1)).toBe(10);
  });

  it('total counts the number as the whole load', () => {
    expect(loadForVolume(20, 'total', 2)).toBe(20);
  });
});
