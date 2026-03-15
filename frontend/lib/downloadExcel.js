export async function downloadExcelFile({ url, token, defaultFilename = 'export.xlsx' }) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    let message = 'Excel indirilemedi.';
    try {
      const data = await response.json();
      message = data?.error || message;
    } catch (error) {}
    throw new Error(message);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get('content-disposition') || '';
  let filename = defaultFilename;
  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (match?.[1]) {
    filename = match[1];
  }

  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}
