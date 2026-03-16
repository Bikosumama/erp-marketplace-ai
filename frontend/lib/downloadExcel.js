export async function downloadExcelFile({
  url,
  token,
  method = 'GET',
  body,
  defaultFilename = 'export.xlsx',
}) {
  const normalizedMethod = String(method || 'GET').toUpperCase();
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  let requestBody;
  if (body instanceof FormData) {
    requestBody = body;
  } else if (body !== undefined && normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(url, {
    method: normalizedMethod,
    headers,
    body: requestBody,
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
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  const simpleMatch = contentDisposition.match(/filename="?([^";]+)"?/i);

  if (utf8Match?.[1]) {
    filename = decodeURIComponent(utf8Match[1]);
  } else if (simpleMatch?.[1]) {
    filename = simpleMatch[1];
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