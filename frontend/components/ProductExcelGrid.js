/* eslint-disable react/jsx-key */
'use client';

import { useMemo, useRef, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim();
}

function containsText(rowValue, filterValue) {
  const hay = normalizeText(rowValue);
  const needle = normalizeText(filterValue);
  if (!needle) return true;
  return hay.includes(needle);
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? n : '—';
}

function formatMoney(value, currency = 'TRY') {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency || 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency || 'TRY'}`;
  }
}

export default function ProductExcelGrid({
  rows,
  onOpenProduct,
  onSelectionChange,
  initialVisibleColumnIds,
}) {
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [visibleColumnIds, setVisibleColumnIds] = useState(
    new Set(initialVisibleColumnIds || [])
  );

  const data = useMemo(() => rows || [], [rows]);

  const columns = useMemo(() => {
    const col = (id, header, accessor, opts = {}) => ({
      id,
      header,
      accessorFn: accessor,
      enableSorting: opts.sorting !== false,
      meta: opts.meta || {},
      cell: opts.cell,
    });

    return [
      {
        id: '__select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            ref={(el) => {
              if (!el) return;
              el.indeterminate = table.getIsSomePageRowsSelected();
            }}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            ref={(el) => {
              if (!el) return;
              el.indeterminate = row.getIsSomeSelected();
            }}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
        size: 34,
      },
      col('stock_code', 'Stok Kodu', (r) => r.stock_code, { meta: { filterable: true } }),
      col('name', 'Ad', (r) => r.name, { meta: { filterable: true } }),
      col('barcode', 'Barkod', (r) => r.barcode, { meta: { filterable: true } }),
      col('brand_name', 'Marka', (r) => r.brand_name, { meta: { filterable: true } }),
      col('category_name', 'Kategori', (r) => r.category_name, { meta: { filterable: true } }),
      col('cost', 'Maliyet', (r) => r.cost, {
        meta: { filterable: true },
        cell: ({ row }) => formatMoney(row.original.cost, row.original.currency),
      }),
      col('sale_price', 'Satış Fiyatı', (r) => r.sale_price, {
        meta: { filterable: true },
        cell: ({ row }) => formatMoney(row.original.sale_price, row.original.currency),
      }),
      col('list_price', 'Liste Fiyatı', (r) => r.list_price, {
        meta: { filterable: true },
        cell: ({ row }) => formatMoney(row.original.list_price, row.original.currency),
      }),
      col('brand_min_price', 'Firma Min', (r) => r.brand_min_price, {
        meta: { filterable: true },
        cell: ({ row }) => formatMoney(row.original.brand_min_price, row.original.currency),
      }),
      col('desi', 'Desi', (r) => r.desi ?? r?.attributes?.desi, {
        meta: { filterable: true },
        cell: ({ row }) => formatNumber(row.original.desi ?? row.original?.attributes?.desi),
      }),
      col('currency', 'Para Birimi', (r) => r.currency, { meta: { filterable: true } }),
      col('vat_rate', 'KDV%', (r) => r.vat_rate, {
        meta: { filterable: true },
        cell: ({ row }) => (row.original.vat_rate != null ? `%${row.original.vat_rate}` : '—'),
      }),
      col('status', 'Durum', (r) => r.status, { meta: { filterable: true } }),
    ];
  }, []);

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: (updater) => {
      setRowSelection((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        return next;
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      if (!filterValue) return true;
      const original = row.original || {};
      return (
        containsText(original.stock_code, filterValue) ||
        containsText(original.name, filterValue) ||
        containsText(original.barcode, filterValue)
      );
    },
    filterFns: {
      containsText: (row, columnId, filterValue) => containsText(row.getValue(columnId), filterValue),
    },
  });

  const visibleColumns = useMemo(() => {
    return table
      .getAllLeafColumns()
      .filter((c) => c.id === '__select' || visibleColumnIds.has(c.id));
  }, [table, visibleColumnIds]);

  const selectedRows = useMemo(() => {
    return table.getSelectedRowModel().rows.map((r) => r.original);
  }, [table, rowSelection]);

  // notify selection change
  useMemo(() => {
    onSelectionChange?.(selectedRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRows]);

  const parentRef = useRef(null);
  const rowModel = table.getRowModel();
  const rowVirtualizer = useVirtualizer({
    count: rowModel.rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const toggleColumn = (id) => {
    setVisibleColumnIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setFilter = (colId, value) => {
    setColumnFilters((prev) => ({ ...prev, [colId]: value }));
    table.getColumn(colId)?.setFilterValue(value);
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.toolbar}>
        <div style={styles.searchGroup}>
          <input
            style={styles.search}
            placeholder="Ara (stok kodu / barkod / ad)"
            value={globalFilter}
            onChange={(e) => {
              setGlobalFilter(e.target.value);
              table.setGlobalFilter(e.target.value);
            }}
          />
          <button
            type="button"
            style={styles.clearBtn}
            onClick={() => {
              setGlobalFilter('');
              table.setGlobalFilter('');
              setColumnFilters({});
              table.resetColumnFilters();
            }}
          >
            Filtreleri Temizle
          </button>
        </div>

        <div style={styles.metaRight}>
          <div style={styles.counter}>
            Toplam: <b>{data.length}</b> • Seçili: <b>{selectedRows.length}</b>
          </div>
        </div>
      </div>

      <div style={styles.body}>
        <aside style={styles.side}>
          <div style={styles.sideTitle}>Kolonlar</div>
          <div style={styles.sideList}>
            {table
              .getAllLeafColumns()
              .filter((c) => c.id !== '__select')
              .map((c) => (
                <label key={c.id} style={styles.sideItem}>
                  <input
                    type="checkbox"
                    checked={visibleColumnIds.has(c.id)}
                    onChange={() => toggleColumn(c.id)}
                  />
                  <span>{typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id}</span>
                </label>
              ))}
          </div>
        </aside>

        <div style={styles.tableArea}>
          <div style={styles.tableHead}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {visibleColumns.map((header) => (
                    <th
                      key={header.id}
                      style={{ ...styles.th, width: header.getSize?.() || undefined }}
                      onClick={header.getToggleSortingHandler?.()}
                      title="Sırala"
                    >
                      <div style={styles.thInner}>
                        {flexRender(header.columnDef.header, { table })}
                        {header.getCanSort?.() ? (
                          <span style={styles.sortIcon}>
                            {header.getIsSorted?.() === 'asc'
                              ? '▲'
                              : header.getIsSorted?.() === 'desc'
                                ? '▼'
                                : '↕'}
                          </span>
                        ) : null}
                      </div>
                    </th>
                  ))}
                </tr>
                <tr>
                  {visibleColumns.map((c) => (
                    <th key={`${c.id}__filter`} style={styles.thFilter}>
                      {c.id === '__select' ? null : c.columnDef.meta?.filterable ? (
                        <input
                          value={columnFilters[c.id] || ''}
                          onChange={(e) => setFilter(c.id, e.target.value)}
                          placeholder="Filtre..."
                          style={styles.filterInput}
                        />
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>

          <div ref={parentRef} style={styles.scroll}>
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rowModel.rows[virtualRow.index];
                if (!row) return null;
                return (
                  <div
                    key={row.id}
                    style={{
                      ...styles.row,
                      transform: `translateY(${virtualRow.start}px)`,
                      background: row.getIsSelected() ? '#eef2ff' : '#fff',
                    }}
                    onDoubleClick={() => onOpenProduct?.(row.original)}
                    onClick={() => row.toggleSelected()}
                  >
                    {visibleColumns.map((col) => (
                      <div key={col.id} style={styles.cell}>
                        {flexRender(col.columnDef.cell ?? col.columnDef.accessorFn, {
                          row,
                          getValue: row.getValue,
                        }) || row.getValue(col.id)}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 12 },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchGroup: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  search: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #d1d5db',
    minWidth: 320,
    fontSize: 14,
  },
  clearBtn: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 14,
  },
  metaRight: { display: 'flex', alignItems: 'center', gap: 10 },
  counter: { fontSize: 13, color: '#334155' },
  body: { display: 'grid', gridTemplateColumns: '240px 1fr', gap: 12, alignItems: 'start' },
  side: {
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    background: '#fff',
    padding: 12,
    position: 'sticky',
    top: 12,
    maxHeight: 'calc(100vh - 140px)',
    overflow: 'auto',
  },
  sideTitle: { fontWeight: 800, color: '#0f172a', marginBottom: 10 },
  sideList: { display: 'flex', flexDirection: 'column', gap: 8 },
  sideItem: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#334155' },
  tableArea: {
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    background: '#fff',
    overflow: 'hidden',
  },
  tableHead: { overflowX: 'auto', borderBottom: '1px solid #e2e8f0', background: '#0b1220' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 1200 },
  th: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'left',
    padding: '10px 10px',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  thInner: { display: 'flex', gap: 8, alignItems: 'center' },
  sortIcon: { opacity: 0.85, fontSize: 11 },
  thFilter: { background: '#0b1220', padding: '8px 10px' },
  filterInput: {
    width: '100%',
    padding: '7px 8px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    outline: 'none',
    fontSize: 12,
  },
  scroll: { height: 560, overflow: 'auto' },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 40,
    display: 'grid',
    gridAutoFlow: 'column',
    gridAutoColumns: 'minmax(140px, 1fr)',
    borderBottom: '1px solid #f1f5f9',
    alignItems: 'center',
    cursor: 'pointer',
  },
  cell: { padding: '0 10px', fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
};

