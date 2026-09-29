export const datasets = ["inventory", "purchase_orders", "invoices", "vendors"] as const;
export type Dataset = typeof datasets[number];
export type ImportRow = Record<string, unknown>;

export const aliases: Record<Dataset, Record<string, string[]>> = {
  inventory: { materialNumber:["materialnumber","material_number","material","sku"], description:["description","materialdescription"], plant:["plant"], storageLocation:["storagelocation","storage_location"], currentStock:["currentstock","current_stock","stock","quantity"], safetyStock:["safetystock","safety_stock"], reorderPoint:["reorderpoint","reorder_point"], maxStock:["maxstock","max_stock"], unitOfMeasure:["unitofmeasure","unit_of_measure","unit","uom"], category:["category"], supplier:["supplier","vendorname"], leadTimeDays:["leadtimedays","lead_time_days"], unitCost:["unitcost","unit_cost","cost"], currency:["currency"] },
  purchase_orders: { poNumber:["ponumber","po_number","purchaseordernumber"], vendorName:["vendorname","vendor_name","vendor"], materialNumber:["materialnumber","material_number","material"], description:["description"], quantity:["quantity","qty"], unitPrice:["unitprice","unit_price","price"], totalAmount:["totalamount","total_amount","amount"], currency:["currency"], status:["status"], expectedDelivery:["expecteddelivery","expected_delivery","deliverydate"], plant:["plant"] },
  vendors: { vendorNumber:["vendornumber","vendor_number","vendorid","vendor_id"], name:["name","vendorname","vendor_name"], country:["country"], city:["city"], taxId:["taxid","tax_id"], bankAccount:["bankaccount","bank_account"], bankName:["bankname","bank_name"], contactEmail:["contactemail","contact_email","email"], riskScore:["riskscore","risk_score"], isActive:["isactive","is_active"], onWatchlist:["onwatchlist","on_watchlist"] },
  invoices: { invoiceNumber:["invoicenumber","invoice_number","invoice"], vendorName:["vendorname","vendor_name","vendor"], poNumber:["ponumber","po_number"], amount:["amount","totalamount","total_amount"], currency:["currency"], invoiceDate:["invoicedate","invoice_date","date"], dueDate:["duedate","due_date"], paymentStatus:["paymentstatus","payment_status"], bankAccountAtInvoice:["bankaccountatinvoice","bank_account_at_invoice","bankaccount","bank_account"] },
};

const normalizeHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");

export function getIngestionValue(dataset: Dataset, row: ImportRow, field: string): string {
  const acceptedHeaders = aliases[dataset][field] ?? [];
  const matchedHeader = Object.keys(row).find(header => acceptedHeaders.includes(normalizeHeader(header)));
  return matchedHeader ? String(row[matchedHeader] ?? "").trim() : "";
}

export function validateIngestionRecords(dataset: Dataset, rows: ImportRow[]) {
  const required: Record<Dataset, string[]> = {
    inventory: ["materialNumber", "description", "plant", "currentStock"],
    purchase_orders: ["poNumber", "vendorName", "quantity", "unitPrice"],
    vendors: ["vendorNumber", "name"],
    invoices: ["invoiceNumber", "vendorName", "amount", "invoiceDate"],
  };
  const numericFields = ["currentStock", "safetyStock", "reorderPoint", "quantity", "unitPrice", "totalAmount", "amount", "riskScore", "leadTimeDays"];
  const dateFields = ["invoiceDate", "dueDate", "expectedDelivery"];

  return rows.map((row, index) => {
    const errors: string[] = [];
    for (const field of required[dataset]) {
      if (!getIngestionValue(dataset, row, field)) errors.push(`${field} is required`);
    }
    for (const field of numericFields) {
      const fieldValue = getIngestionValue(dataset, row, field);
      if (fieldValue && !Number.isFinite(Number(fieldValue))) errors.push(`${field} must be numeric`);
    }
    for (const field of dateFields) {
      const fieldValue = getIngestionValue(dataset, row, field);
      if (fieldValue && Number.isNaN(Date.parse(fieldValue))) errors.push(`${field} must be a valid date`);
    }
    const email = getIngestionValue(dataset, row, "contactEmail");
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push("contactEmail must be a valid email");
    return { row: index + 1, valid: errors.length === 0, errors };
  });
}
