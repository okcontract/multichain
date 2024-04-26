import { expect, test } from "vitest";

import {
  type AnyCell,
  Cell,
  type CellArray,
  Sheet,
  SheetProxy,
  type Uncellified,
  isObject
} from "@okcontract/cells";

import { mapArrayRec } from "./mapArrayRec";

/**
 * _uncellify is used in tests to flatten a value tree that contains multiple cells.
 * @param v any value
 * @returns value without cells
 */
const _uncellify = async <T>(v: T | AnyCell<T>): Promise<Uncellified<T>> => {
  const value = v instanceof Cell ? await v.consolidatedValue : v;
  if (value instanceof Error) throw value;
  if (Array.isArray(value))
    return Promise.all(
      value.map((_element) => _uncellify(_element))
    ) as Promise<Uncellified<T>>;
  if (isObject(value))
    return Object.fromEntries(
      await Promise.all(
        Object.entries(value).map(async ([k, vv]) => [k, await _uncellify(vv)])
      )
    );
  // Classes, null or base types (string, number, ...)
  return value as Uncellified<T>;
};

test("mapArrayRec array", async () => {
  const sheet = new Sheet();
  const proxy = new SheetProxy(sheet);
  const arr = proxy.new([
    proxy.new(1),
    proxy.new(2),
    proxy.new([proxy.new(3), proxy.new([proxy.new(4)])])
  ]) as CellArray<number>;
  const fl = mapArrayRec(proxy, arr, (x: number) => x + 1);
  await expect(_uncellify(fl)).resolves.toEqual([2, 3, [4, [5]]]);
});
