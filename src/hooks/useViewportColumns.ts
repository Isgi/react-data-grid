import { useMemo } from 'react';

import { getColSpan } from '../utils';
import type { CalculatedColumn, GroupRow, Maybe } from '../types';

interface ViewportColumnsArgs<R, SR> {
  columns: readonly CalculatedColumn<R, SR>[];
  colSpanColumns: readonly CalculatedColumn<R, SR>[];
  rows: readonly (R | GroupRow<R>)[];
  topSummaryRows: Maybe<readonly SR[]>;
  bottomSummaryRows: Maybe<readonly SR[]>;
  colOverscanStartIdx: number;
  colOverscanEndIdx: number;
  lastFrozenColumnIndex: number;
  rowOverscanStartIdx: number;
  rowOverscanEndIdx: number;
  columnWidths: ReadonlyMap<string, number>;
  isGroupRow: (row: R | GroupRow<R>) => row is GroupRow<R>;
}

export function useViewportColumns<R, SR>({
  columns,
  colSpanColumns,
  rows,
  topSummaryRows,
  bottomSummaryRows,
  colOverscanStartIdx,
  colOverscanEndIdx,
  lastFrozenColumnIndex,
  rowOverscanStartIdx,
  rowOverscanEndIdx,
  columnWidths,
  isGroupRow
}: ViewportColumnsArgs<R, SR>) {
  // find the column that spans over a column within the visible columns range and adjust colOverscanStartIdx
  const startIdx = useMemo(() => {
    if (colOverscanStartIdx === 0) return 0;

    let startIdx = colOverscanStartIdx;

    const updateStartIdx = (colIdx: number, colSpan: number | undefined) => {
      if (colSpan !== undefined && colIdx + colSpan > colOverscanStartIdx) {
        startIdx = colIdx;
        return true;
      }
      return false;
    };

    for (const column of colSpanColumns) {
      // check header row
      const colIdx = column.idx;
      if (colIdx >= startIdx) break;
      if (updateStartIdx(colIdx, getColSpan(column, lastFrozenColumnIndex, { type: 'HEADER' }))) {
        break;
      }

      // check viewport rows
      for (let rowIdx = rowOverscanStartIdx; rowIdx <= rowOverscanEndIdx; rowIdx++) {
        const row = rows[rowIdx];
        if (isGroupRow(row)) continue;
        if (
          updateStartIdx(colIdx, getColSpan(column, lastFrozenColumnIndex, { type: 'ROW', row }))
        ) {
          break;
        }
      }

      // check summary rows
      if (topSummaryRows != null) {
        for (const row of topSummaryRows) {
          if (
            updateStartIdx(
              colIdx,
              getColSpan(column, lastFrozenColumnIndex, { type: 'SUMMARY', row })
            )
          ) {
            break;
          }
        }
      }

      if (bottomSummaryRows != null) {
        for (const row of bottomSummaryRows) {
          if (
            updateStartIdx(
              colIdx,
              getColSpan(column, lastFrozenColumnIndex, { type: 'SUMMARY', row })
            )
          ) {
            break;
          }
        }
      }
    }

    return startIdx;
  }, [
    rowOverscanStartIdx,
    rowOverscanEndIdx,
    rows,
    topSummaryRows,
    bottomSummaryRows,
    colOverscanStartIdx,
    lastFrozenColumnIndex,
    colSpanColumns,
    isGroupRow
  ]);

  const { viewportColumns, flexWidthViewportColumns } = useMemo((): {
    viewportColumns: readonly CalculatedColumn<R, SR>[];
    flexWidthViewportColumns: readonly CalculatedColumn<R, SR>[];
  } => {
    const viewportColumns: CalculatedColumn<R, SR>[] = [];
    const flexWidthViewportColumns: CalculatedColumn<R, SR>[] = [];
    for (let colIdx = 0; colIdx <= colOverscanEndIdx; colIdx++) {
      const column = columns[colIdx];

      if (colIdx < startIdx && !column.frozen) continue;
      viewportColumns.push(column);
      if (typeof column.width === 'string') {
        flexWidthViewportColumns.push(column);
      }
    }

    if(viewportColumns.find(i => i.key !== 'FROZEN_RIGHT_COLUMN') && columns.find(i => i.key === 'FROZEN_RIGHT_COLUMN')) {
      viewportColumns.push({...columns[columns.length - 1], cellClass: 'RIGHT_COLUMN_FROZEN_CLASS'});
    }
    
    return { viewportColumns, flexWidthViewportColumns };
  }, [startIdx, colOverscanEndIdx, columns]);

  const unsizedFlexWidthViewportColumns = useMemo((): readonly CalculatedColumn<R, SR>[] => {
    return flexWidthViewportColumns.filter((column) => !columnWidths.has(column.key));
  }, [flexWidthViewportColumns, columnWidths]);

  return {
    viewportColumns,
    flexWidthViewportColumns: unsizedFlexWidthViewportColumns
  };
}
