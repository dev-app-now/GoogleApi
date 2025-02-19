export async function createSheet(accessToken: string, title: string) {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        {
          properties: {
            title: 'Sheet1',
            gridProperties: {
              rowCount: 100,
              columnCount: 26
            }
          }
        }
      ]
    })
  });

  if (!response.ok) throw new Error('Failed to create sheet');
  const sheet = await response.json() as { spreadsheetId: string };

  await fetch(
    `https://www.googleapis.com/drive/v3/files/${sheet.spreadsheetId}/permissions`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    }
  );

  return sheet;
}

export async function readRange(accessToken: string, spreadsheetId: string, range: string) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  if (!response.ok) throw new Error('Failed to read range');
  return response.json();
}

export async function updateRange(
  accessToken: string, 
  spreadsheetId: string, 
  range: string,
  values: any[][]
) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    }
  );

  if (!response.ok) throw new Error('Failed to update range');
  return response.json();
}

export async function updateStyle(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  style: any
) {
  const keys = Object.keys(style).join(',');
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [{
          repeatCell: {
            range: range,
            cell: { userEnteredFormat: style },
            fields: `userEnteredFormat(${keys})`
          }
        }]
      })
    }
  );

  if (!response.ok) throw new Error('Failed to update style. '+ await response.text());
  return response.json();
}

export async function listDriveFiles(accessToken: string) {
  const response = await fetch(
    'https://www.googleapis.com/drive/v3/files?q=mimeType="application/vnd.google-apps.spreadsheet"&fields=files(id,name,webViewLink,createdTime,owners)',
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  if (!response.ok) throw new Error('Failed to list drive files');
  return response.json();
}

export async function deleteFile(accessToken: string, fileId: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  if (!response.ok) throw new Error('Failed to delete file');
  return;
} 