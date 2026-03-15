export async function downloadExcelFile({
  url,
  token,
  method = 'POST',
  body,
  defaultFilename = 'export.xlsx',
}) {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = 'Excel indirilemedi.';

    try {
      const data = await response.json();
      message = data?.error || message;
    } catch (err) {
      console.error('Excel indirme hatası:', err);
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get('content-disposition') || '';

  let filename = defaultFilename;
  const match = contentDisposition.match(/filename="(.+)"/i);

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
