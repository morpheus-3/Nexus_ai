import Papa from "papaparse";
import * as XLSX from "xlsx";
type ImportRow = Record<string, unknown>;

export function parseCsvRows(contents: string): ImportRow[] {
  const parsed = Papa.parse<ImportRow>(contents, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) throw new Error(`CSV parsing failed: ${parsed.errors[0].message}`);
  return parsed.data;
}

export function parseXlsxRows(bytes: ArrayBuffer): ImportRow[] {
  const workbook = XLSX.read(bytes, { type: "array", cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error("The XLSX file does not contain a worksheet.");
  return XLSX.utils.sheet_to_json<ImportRow>(firstSheet, { raw: false, defval: "" });
}
