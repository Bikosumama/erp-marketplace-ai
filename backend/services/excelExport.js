const ExcelJS = require('exceljs');

function autoFitColumns(worksheet, minimumWidth = 12) {
  worksheet.columns.forEach((column) => {
    let maxLength = minimumWidth;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value == null ? '' : String(cell.value);
      maxLength = Math.max(maxLength, value.length + 2);
    });
    column.width = Math.min(maxLength, 40);
  });
}

async function sendWorkbook(res, { filename = 'export.xlsx', sheets = [] }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ChatGPT';
  workbook.created = new Date();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name || 'Sheet1');
    worksheet.columns = (sheet.columns || []).map((column) => ({
      header: column.header,
      key: column.key,
      width: column.width || 16,
      style: column.style || {},
    }));

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle' };

    for (const row of sheet.rows || []) {
      worksheet.addRow(row);
    }

    autoFitColumns(worksheet);
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(Buffer.from(buffer));
}

module.exports = {
  sendWorkbook,
};
