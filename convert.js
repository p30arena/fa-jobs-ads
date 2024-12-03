const fs = require("fs");
const readline = require("readline");
const XLSX = require("xlsx");

async function convertJsonlToXlsx(jsonlFilePath, xlsxFilePath) {
  try {
    const columnData = {};
    const rows = [];

    // Read JSONL file line by line
    const fileStream = fs.createReadStream(jsonlFilePath);
    const rl = readline.createInterface({ input: fileStream });

    for await (const line of rl) {
      if (line.trim()) {
        const json = JSON.parse(line);
        rows.push(json);

        // Track maximum length of data in each column
        Object.entries(json).forEach(([key, value]) => {
          const length = String(value || "").length;
          if (!columnData[key]) {
            columnData[key] = { maxLength: 0, occurrences: 0 };
          }
          columnData[key].maxLength = Math.max(
            columnData[key].maxLength,
            length
          );
          columnData[key].occurrences++;
        });
      }
    }

    // Sort columns: shorter maxLength first, and lengthy ones last
    const columns = Object.keys(columnData).sort((a, b) => {
      return columnData[a].maxLength - columnData[b].maxLength;
    });

    // Create Excel data array
    const excelData = [];

    // Add header row
    excelData.push(columns);

    // Add data rows
    for (const row of rows) {
      const dataRow = columns.map((key) => (key in row ? row[key] : ""));
      excelData.push(dataRow);
    }

    // Create a new workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(excelData);

    // Append worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    // Write to XLSX file
    XLSX.writeFile(workbook, xlsxFilePath);

    console.log(`Conversion complete! XLSX saved to: ${xlsxFilePath}`);
  } catch (error) {
    console.error("Error during conversion:", error.message);
  }
}

async function convertJsonlToCsv(jsonlFilePath, csvFilePath) {
  try {
    const columnData = {};
    const rows = [];

    // Read JSONL file line by line
    const fileStream = fs.createReadStream(jsonlFilePath);
    const rl = readline.createInterface({ input: fileStream });

    for await (const line of rl) {
      if (line.trim()) {
        const json = JSON.parse(line);
        rows.push(json);

        // Track maximum length of data in each column
        Object.entries(json).forEach(([key, value]) => {
          const length = String(value || "").length;
          if (!columnData[key]) {
            columnData[key] = { maxLength: 0, occurrences: 0 };
          }
          columnData[key].maxLength = Math.max(
            columnData[key].maxLength,
            length
          );
          columnData[key].occurrences++;
        });
      }
    }

    // Sort columns: shorter maxLength first, and lengthy ones last
    const columns = Object.keys(columnData).sort((a, b) => {
      return columnData[a].maxLength - columnData[b].maxLength;
    });

    const csvRows = [];

    // Add header row
    csvRows.push(columns.join(","));

    // Add data rows
    for (const row of rows) {
      const csvRow = columns.map((key) =>
        key in row ? `"${String(row[key]).replace(/"/g, '""')}"` : ""
      );
      csvRows.push(csvRow.join(","));
    }

    // Write to CSV file
    fs.writeFileSync(csvFilePath, csvRows.join("\n"), "utf8");

    console.log(`Conversion complete! CSV saved to: ${csvFilePath}`);
  } catch (error) {
    console.error("Error during conversion:", error.message);
  }
}

module.exports = {
  convertJsonlToCsv,
  convertJsonlToXlsx,
};
