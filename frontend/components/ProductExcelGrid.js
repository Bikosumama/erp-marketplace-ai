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

function pick(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function parseMaybeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value).trim().replace(/\s/g, '');
  // 2,5 -> 2.5
  const normalized = s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function pickDesi(product) {
  if (!product) return null;
  const direct = pick(product, 'desi', 'shipping_desi', 'shipment_desi', 'package_desi', 'volumetric_desi', 'volume_desi');
  const directNum = parseMaybeNumber(direct);
  if (directNum !== null) return directNum;

  const attrs = product.attributes && typeof product.attributes === 'object' ? product.attributes : null;
  if (!attrs) return null;

  // common keys
  const common = pick(attrs, 'desi', 'Desi', 'kargo_desi', 'KargoDesi', 'shipping_desi', 'shippingDesi', 'desi_value', 'desiValue');
  const commonNum = parseMaybeNumber(common);
  if (commonNum !== null) return commonNum;

  // fallback: any attribute key containing "desi"
  for (const [k, v] of Object.entries(attrs)) {
    if (String(k).toLowerCase().includes('desi')) {
      const n = parseMaybeNumber(v);
      if (n !== null) return n;
    }
  }

  return null;
}

export default function ProductExcelGrid({
  rows,
  onOpenProduct,
  onSelectionChange,
}) {
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState({});

  const data = useMemo(() => rows || [], [rows]);

  const columns = useMemo(() => {
    const col = (id, header, accessor, opts = {}) => ({
      id,
      header,
      accessorFn: accessor,
      enableSorting: opts.sorting !== false,
      size: opts.size ?? 140,
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
        size: 44,
      },
      col('stock_code', 'Stok Kodu', (r) => (r && String(pick(r, 'stock_code', 'stok_kodu', 'kod', 'stockCode') ?? '')).trim() || '', { meta: { filterable: true }, size: 130, cell: ({ row }) => (String(pick(row.original, 'stock_code', 'stok_kodu', 'kod', 'stockCode') ?? '').trim() || '—') }),
      col('name', 'Ürün Adı', (r) => (r && String(pick(r, 'name', 'ad', 'product_name', 'title', 'urun_adi') ?? '')).trim() || '', { meta: { filterable: true }, size: 220, cell: ({ row }) => (String(pick(row.original, 'name', 'ad', 'product_name', 'title', 'urun_adi') ?? '').trim() || '—') }),
      col('barcode', 'Barkod', (r) => (r && String(pick(r, 'barcode', 'barkod') ?? '')).trim() || '', { meta: { filterable: true }, size: 130, cell: ({ row }) => (String(pick(row.original, 'barcode', 'barkod') ?? '').trim() || '—') }),
      col('brand_name', 'Marka', (r) => (r && String(pick(r, 'brand_name', 'marka', 'brand') ?? '')).trim() || '', { meta: { filterable: true }, size: 120, cell: ({ row }) => (String(pick(row.original, 'brand_name', 'marka', 'brand') ?? '').trim() || '—') }),
      col('category_name', 'Kategori', (r) => (r && String(pick(r, 'category_name', 'kategori', 'category') ?? '')).trim() || '', { meta: { filterable: true }, size: 140, cell: ({ row }) => (String(pick(row.original, 'category_name', 'kategori', 'category') ?? '').trim() || '—') }),
      col('desi', 'Desi', (r) => pickDesi(r), {
        meta: { filterable: true },
        size: 80,
        cell: ({ row }) => {
          const n = pickDesi(row.original);
          return n === null ? '—' : formatNumber(n);
        },
      }),
      col('cost', 'Maliyet', (r) => r.cost, {
        meta: { filterable: true },
        size: 110,
        cell: ({ row }) => formatMoney(row.original.cost, row.original.currency),
      }),
      col('sale_price', 'Satış Fiyatı', (r) => r.sale_price, {
        meta: { filterable: true },
        size: 110,
        cell: ({ row }) => formatMoney(row.original.sale_price, row.original.currency),
      }),
      col('list_price', 'Liste Fiyatı', (r) => r.list_price, {
        meta: { filterable: true },
        size: 110,
        cell: ({ row }) => formatMoney(row.original.list_price, row.original.currency),
      }),
      col('brand_min_price', 'Firma Min', (r) => r.brand_min_price, {
        meta: { filterable: true },
        size: 100,
        cell: ({ row }) => formatMoney(row.original.brand_min_price, row.original.currency),
      }),
      col('currency', 'Para Birimi', (r) => r.currency ?? 'TRY', { meta: { filterable: true }, size: 90, cell: ({ getValue }) => String(getValue() ?? 'TRY').trim() || '—' }),
      col('vat_rate', 'KDV%', (r) => r.vat_rate, {
        meta: { filterable: true },
        size: 70,
        cell: ({ row }) => (row.original.vat_rate != null ? `%${row.original.vat_rate}` : '—'),
      }),
      col('status', 'Durum', (r) => (r?.status === 'passive' ? 'Pasif' : 'Aktif'), { meta: { filterable: true }, size: 80, cell: ({ getValue }) => getValue() ?? '—' }),
    ];
  }, []);

  const columnFiltersArray = useMemo(
    () =>
      Object.entries(columnFilters)
        .filter(([, v]) => v != null && String(v).trim() !== '')
        .map(([id, value]) => ({ id, value })),
    [columnFilters]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
      globalFilter,
      columnFilters: columnFiltersArray,
    },
    onGlobalFilterChange: (updater) => {
      const next = typeof updater === 'function' ? updater(globalFilter) : globalFilter;
      setGlobalFilter(next ?? '');
    },
    onColumnFiltersChange: (updater) => {
      setColumnFilters((prev) => {
        const prevArr = Object.entries(prev)
          .filter(([id]) => id && id !== 'undefined')
          .map(([id, value]) => ({ id, value }));
        const next = typeof updater === 'function' ? updater(prevArr) : prevArr;
        return Array.isArray(next)
          ? next.reduce((acc, { id, value }) => {
              if (!id || id === 'undefined') return acc;
              return { ...acc, [id]: value };
            }, {})
          : prev;
      });
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
      const o = row.original || {};
      const stockCode = pick(o, 'stock_code', 'stok_kodu', 'kod');
      const name = pick(o, 'name', 'ad', 'product_name', 'title');
      const barcode = pick(o, 'barcode', 'barkod');
      return (
        containsText(stockCode, filterValue) ||
        containsText(name, filterValue) ||
        containsText(barcode, filterValue)
      );
    },
    filterFns: {
      containsText: (row, columnId, filterValue) => containsText(row.getValue(columnId), filterValue),
    },
  });

  const visibleColumns = useMemo(() => {
    return table.getAllLeafColumns();
  }, [table]);

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

  const totalColumnsWidth = useMemo(
    () => visibleColumns.reduce((sum, c) => sum + (c.getSize?.() ?? c.columnDef.size ?? 140), 0),
    [visibleColumns]
  );

  const setFilter = (colId, value) => {
    setColumnFilters((prev) => ({ ...prev, [colId]: value }));
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.toolbar}>
        <div style={styles.searchGroup}>
          <input
            style={styles.search}
            placeholder="Ara (stok kodu / barkod / ad)"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
          <button
            type="button"
            style={styles.clearBtn}
            onClick={() => {
              setGlobalFilter('');
              setColumnFilters({});
            }}
          >
            Filtreleri Temizle
          </button>
        </div>

        <div style={styles.metaRight}>
          <div style={styles.counter}>
            Toplam: <b>{data.length}</b> • Listelenen: <b>{rowModel.rows.length}</b> • Seçili: <b>{selectedRows.length}</b>
          </div>
        </div>
      </div>

      <div style={styles.body}>
        <div style={styles.tableArea}>
          <div style={{ ...styles.tableHead, minWidth: totalColumnsWidth }}>
            <table style={{ ...styles.table, minWidth: totalColumnsWidth }}>
              <colgroup>
                {visibleColumns.map((c) => (
                  <col key={c.id} style={{ width: c.getSize?.() ?? c.columnDef.size ?? 140 }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {visibleColumns.map((header) => (
                    <th
                      key={header.id}
                      style={{ ...styles.th, width: header.getSize?.() ?? header.columnDef.size ?? 140 }}
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
                          placeholder="Filtre"
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
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative', minWidth: totalColumnsWidth }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = rowModel.rows[virtualRow.index];
                if (!row) return null;
                const gridCols = visibleColumns.map((c) => `${c.getSize?.() ?? c.columnDef.size ?? 140}px`).join(' ');
                return (
                  <div
                    key={row.id}
                    style={{
                      ...styles.row,
                      gridTemplateColumns: gridCols,
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
                        }) ?? row.getValue(col.id) ?? '—'}
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
  body: { width: '100%' },
  tableArea: {
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    background: '#fff',
    overflow: 'hidden',
  },
  tableHead: { overflowX: 'auto', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' },
  table: { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' },
  th: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: 700,
    textAlign: 'left',
    padding: '10px 10px',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    backgroundColor: '#f1f5f9',
  },
  thInner: { display: 'flex', gap: 8, alignItems: 'center' },
  sortIcon: { opacity: 0.85, fontSize: 11 },
  thFilter: { background: '#f1f5f9', padding: '8px 10px' },
  filterInput: {
    width: '100%',
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#0f172a',
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

