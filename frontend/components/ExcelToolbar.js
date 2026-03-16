'use client';

import { useRef, useState } from 'react';

export default function ExcelToolbar({
  onExport,
  onTemplateDownload,
  onImportFile,
  exportLabel = 'Excel Dışa Aktar',
  importLabel = 'Excel İçe Aktar',
  templateLabel = 'Şablon İndir',
}) {
  const fileInputRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  async function runAction(action, setBusy) {
    if (!action) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onImportFile) return;

    setImporting(true);
    try {
      await onImportFile(file);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={styles.wrap}>
      <button
        type="button"
        onClick={() => runAction(onExport, setExporting)}
        disabled={exporting || importing || downloadingTemplate}
        style={styles.primaryButton}
      >
        {exporting ? 'İndiriliyor...' : exportLabel}
      </button>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={exporting || importing || downloadingTemplate}
        style={styles.secondaryButton}
      >
        {importing ? 'İçe Aktarılıyor...' : importLabel}
      </button>

      <button
        type="button"
        onClick={() => runAction(onTemplateDownload, setDownloadingTemplate)}
        disabled={exporting || importing || downloadingTemplate}
        style={styles.secondaryButton}
      >
        {downloadingTemplate ? 'Şablon Hazırlanıyor...' : templateLabel}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: '20px',
  },
  primaryButton: {
    padding: '10px 16px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '10px 16px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
