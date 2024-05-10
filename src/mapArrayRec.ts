import {
  type CellArray,
  type MapCell,
  type SheetProxy,
  collector
} from "@okcontract/cells";

/**
 * mapArray recursively implement .map() for array
 */
export const mapArrayRec = <T, NF extends boolean = false>(
  proxy: SheetProxy,
  arr: CellArray<T>,
  mapFn: (v: T) => T = (x: T) => x,
  name = "flatten",
  nf?: NF
) => {
  const coll = collector<MapCell<T[], NF>>(proxy);
  return proxy.mapNoPrevious(
    [arr],
    // @todo wait?
    (cells) =>
      coll(
        proxy.mapNoPrevious(cells, (..._cells) =>
          _cells.map((v, i) =>
            Array.isArray(v)
              ? mapArrayRec(proxy, cells[i] as CellArray<T>, mapFn)
              : mapFn(v)
          )
        )
      ),
    name,
    nf
  );
};
