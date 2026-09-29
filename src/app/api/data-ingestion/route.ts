import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { inventoryItems, purchaseOrders, invoices, vendors, auditLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { databaseErrorResponse } from "@/lib/database-error";
import { aliases, datasets, getIngestionValue as value, validateIngestionRecords as validate, type Dataset } from "@/lib/data-ingestion-validation";

const requestSchema = z.object({ dataset: z.enum(datasets), records: z.array(z.record(z.string(), z.unknown())).min(1).max(5000), confirm: z.boolean().default(false), fileName: z.string().optional() });
const number = (v:string, fallback="0") => v === "" ? fallback : v;
const date = (v:string) => v ? new Date(v) : null;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    if (body?.demo === true) {
      const today = new Date();
      const recent = (days:number) => new Date(today.getTime()+days*86400000).toISOString().slice(0,10);
      const seed = [
        {dataset:"vendors",records:[{vendorNumber:"V-1001",name:"Acme Industrial Supply",country:"USA",city:"Chicago",bankAccount:"US-ACME-001",riskScore:"12"},{vendorNumber:"V-1002",name:"Northstar Components",country:"USA",city:"Detroit",bankAccount:"US-NS-882",riskScore:"74",onWatchlist:"true"},{vendorNumber:"V-1003",name:"Global Parts GmbH",country:"Germany",city:"Munich",bankAccount:"DE-GP-330",riskScore:"22"}]},
        {dataset:"inventory",records:[{materialNumber:"MAT-100",description:"Industrial pump assembly",plant:"P001",currentStock:"12",safetyStock:"40",reorderPoint:"60",unitOfMeasure:"EA",supplier:"Acme Industrial Supply",unitCost:"425",category:"Mechanical"},{materialNumber:"MAT-200",description:"Precision valve kit",plant:"P002",currentStock:"84",safetyStock:"30",reorderPoint:"45",unitOfMeasure:"EA",supplier:"Northstar Components",unitCost:"89",category:"Components"},{materialNumber:"MAT-300",description:"Hydraulic seal pack",plant:"P003",currentStock:"3",safetyStock:"25",reorderPoint:"40",unitOfMeasure:"EA",supplier:"Global Parts GmbH",unitCost:"18",category:"Consumables"}]},
        {dataset:"purchase_orders",records:[{poNumber:"PO-9001",vendorName:"Acme Industrial Supply",materialNumber:"MAT-100",description:"Industrial pump assembly",quantity:"40",unitPrice:"425",status:"delayed",expectedDelivery:recent(-4),plant:"P001"},{poNumber:"PO-9002",vendorName:"Northstar Components",materialNumber:"MAT-200",description:"Precision valve kit",quantity:"60",unitPrice:"89",status:"open",expectedDelivery:recent(8),plant:"P002"}]},
        {dataset:"invoices",records:[{invoiceNumber:"INV-7001",vendorName:"Acme Industrial Supply",amount:"17000",invoiceDate:recent(-20),dueDate:recent(10),bankAccountAtInvoice:"US-ACME-001"},{invoiceNumber:"INV-7002",vendorName:"Northstar Components",amount:"12500",invoiceDate:recent(-12),dueDate:recent(5),bankAccountAtInvoice:"US-CHANGED-882"},{invoiceNumber:"INV-7003",vendorName:"Northstar Components",amount:"12500",invoiceDate:recent(-8),dueDate:recent(9),bankAccountAtInvoice:"US-CHANGED-882"}]},
      ];
      const totals=[];
      for(const entry of seed) {
        const res: NextResponse = await POST(new NextRequest(req.url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...entry,confirm:true,fileName:"realistic-demo-dataset"})}));
        const result = await res.json();
        if (result.code === "NO_NEW_RECORDS") {
          totals.push({ ...result, dataset: entry.dataset });
          continue;
        }
        if (!res.ok) {
          console.error(`Demo dataset import failed for ${entry.dataset}`, { status: res.status, code: result.code });
          return NextResponse.json(
            { error: result.error || "Demo dataset import failed", code: result.code || "DEMO_IMPORT_FAILED", failedDataset: entry.dataset },
            { status: res.status },
          );
        }
        totals.push(result);
      }
      const imported = totals.reduce((count,result) => count + (result.imported || 0), 0);
      if (imported === 0) {
        return NextResponse.json({ error: "Demo dataset completed without importing any records", code: "DEMO_NO_RECORDS_IMPORTED", imported: 0, results: totals }, { status: 422 });
      }
      return NextResponse.json({demo:true,imported,results:totals});
    }
    const parsed = requestSchema.parse(body);
    const results = validate(parsed.dataset, parsed.records);
    if (!parsed.confirm) return NextResponse.json({ preview: true, results, validCount: results.filter(r=>r.valid).length, errorCount: results.filter(r=>!r.valid).length });
    const good = parsed.records.filter((_,i)=>results[i].valid);
    if (good.length === 0) {
      return NextResponse.json({ error: "No records were imported because every row failed validation", code: "NO_VALID_RECORDS", imported: 0, results, errorCount: results.length }, { status: 422 });
    }
    let inserted=0;
    if(parsed.dataset === "inventory") for(const r of good) { const m=value(parsed.dataset, r,"materialNumber"); const [existing]=await db.select({id:inventoryItems.id}).from(inventoryItems).where(eq(inventoryItems.materialNumber,m)).limit(1); const v={materialNumber:m,description:value(parsed.dataset, r,"description"),plant:value(parsed.dataset, r,"plant"),storageLocation:value(parsed.dataset, r,"storageLocation")||null,currentStock:number(value(parsed.dataset, r,"currentStock")),safetyStock:number(value(parsed.dataset, r,"safetyStock")),reorderPoint:number(value(parsed.dataset, r,"reorderPoint")),maxStock:value(parsed.dataset, r,"maxStock")||null,unitOfMeasure:value(parsed.dataset, r,"unitOfMeasure")||"EA",category:value(parsed.dataset, r,"category")||null,supplier:value(parsed.dataset, r,"supplier")||null,leadTimeDays:Number(value(parsed.dataset, r,"leadTimeDays")||7),unitCost:value(parsed.dataset, r,"unitCost")||null,currency:value(parsed.dataset, r,"currency")||"USD",lastUpdated:new Date()}; if(existing) await db.update(inventoryItems).set(v).where(eq(inventoryItems.id,existing.id)); else await db.insert(inventoryItems).values(v); inserted++; }
    if(parsed.dataset === "purchase_orders") for(const r of good) { const po=value(parsed.dataset, r,"poNumber"); const [existing]=await db.select({id:purchaseOrders.id}).from(purchaseOrders).where(eq(purchaseOrders.poNumber,po)).limit(1); const qty=number(value(parsed.dataset, r,"quantity")); const price=number(value(parsed.dataset, r,"unitPrice")); const v={poNumber:po,vendorName:value(parsed.dataset, r,"vendorName"),materialNumber:value(parsed.dataset, r,"materialNumber")||null,description:value(parsed.dataset, r,"description")||null,quantity:qty,unitPrice:price,totalAmount:number(value(parsed.dataset, r,"totalAmount"),(Number(qty)*Number(price)).toFixed(2)),currency:value(parsed.dataset, r,"currency")||"USD",status:value(parsed.dataset, r,"status")||"open",expectedDelivery:date(value(parsed.dataset, r,"expectedDelivery")),plant:value(parsed.dataset, r,"plant")||null,updatedAt:new Date()}; if(existing) await db.update(purchaseOrders).set(v).where(eq(purchaseOrders.id,existing.id)); else await db.insert(purchaseOrders).values(v); inserted++; }
    if(parsed.dataset === "vendors") for(const r of good) { const n=value(parsed.dataset, r,"vendorNumber"); const [existing]=await db.select({id:vendors.id}).from(vendors).where(eq(vendors.vendorNumber,n)).limit(1); const v={vendorNumber:n,name:value(parsed.dataset, r,"name"),country:value(parsed.dataset, r,"country")||null,city:value(parsed.dataset, r,"city")||null,taxId:value(parsed.dataset, r,"taxId")||null,bankAccount:value(parsed.dataset, r,"bankAccount")||null,bankName:value(parsed.dataset, r,"bankName")||null,contactEmail:value(parsed.dataset, r,"contactEmail")||null,riskScore:number(value(parsed.dataset, r,"riskScore")),isActive:value(parsed.dataset, r,"isActive").toLowerCase()!=="false",onWatchlist:value(parsed.dataset, r,"onWatchlist").toLowerCase()==="true",updatedAt:new Date()}; if(existing) await db.update(vendors).set(v).where(eq(vendors.id,existing.id)); else await db.insert(vendors).values(v); inserted++; }
    if(parsed.dataset === "invoices") for(const r of good) { const n=value(parsed.dataset, r,"invoiceNumber"); const [existing]=await db.select({id:invoices.id}).from(invoices).where(eq(invoices.invoiceNumber,n)).limit(1); if(existing) continue; const name=value(parsed.dataset, r,"vendorName"); const [vendor]=await db.select().from(vendors).where(eq(vendors.name,name)).limit(1); const amt=Number(value(parsed.dataset, r,"amount")); const riskFactors:string[]=[]; if(value(parsed.dataset, r,"bankAccountAtInvoice") && vendor?.bankAccount && value(parsed.dataset, r,"bankAccountAtInvoice")!==vendor.bankAccount) riskFactors.push("bank_account_mismatch"); const prior=await db.select().from(invoices).where(eq(invoices.vendorName,name)); const dupe=prior.find(x=>Number(x.amount)===amt); if(dupe) riskFactors.push("possible_duplicate"); const score=Math.min(100,riskFactors.reduce((s,f)=>s+(f==="bank_account_mismatch"?55:45),0)+(vendor?.onWatchlist?35:0)+(Number(vendor?.riskScore||0)*.25)); await db.insert(invoices).values({invoiceNumber:n,vendorId:vendor?.id??null,vendorName:name,poNumber:value(parsed.dataset, r,"poNumber")||null,amount:number(value(parsed.dataset, r,"amount")),currency:value(parsed.dataset, r,"currency")||"USD",invoiceDate:date(value(parsed.dataset, r,"invoiceDate"))!,dueDate:date(value(parsed.dataset, r,"dueDate")),paymentStatus:value(parsed.dataset, r,"paymentStatus")||"pending",riskScore:String(score),riskFactors,isDuplicate:!!dupe,duplicateOf:dupe?.invoiceNumber??null,bankAccountAtInvoice:value(parsed.dataset, r,"bankAccountAtInvoice")||null}); inserted++; }
    if (inserted === 0) {
      return NextResponse.json({ error: "No new records were imported; the submitted records already exist", code: "NO_NEW_RECORDS", imported: 0, results, errorCount: results.filter(r=>!r.valid).length }, { status: 409 });
    }
    await db.insert(auditLog).values({action:"business_data_imported",resourceType:parsed.dataset,description:`Imported ${inserted} ${parsed.dataset} records in demo mode; ${results.filter(r=>!r.valid).length} validation errors.`,severity:results.some(r=>!r.valid)?"warning":"info",metadata:{inserted,errorCount:results.filter(r=>!r.valid).length}});
    return NextResponse.json({ imported: inserted, results, errorCount: results.filter(r=>!r.valid).length });
  } catch(e) {
    if(e instanceof z.ZodError) return NextResponse.json({error:"Invalid ingestion request",code:"INVALID_INGESTION_REQUEST",details:e.issues},{status:400});
    if(e instanceof SyntaxError) return NextResponse.json({error:"Request body must contain valid JSON",code:"INVALID_JSON"},{status:400});
    return databaseErrorResponse(e,"Business data import");
  }
}

export async function GET(req: NextRequest) {
  const dataset = new URL(req.url).searchParams.get("template") as Dataset | null;
  if (!dataset || !datasets.includes(dataset)) return NextResponse.json({error:"Unknown template"},{status:400});
  const fields = Object.keys(aliases[dataset]);
  const examples:Record<Dataset,string[]> = {
    inventory:["MAT-EXAMPLE","Example material","P001","","10","20","30","","EA","Example","Example Vendor","7","25.00","USD"],
    purchase_orders:["PO-EXAMPLE","Example Vendor","MAT-EXAMPLE","Example order","10","25.00","250.00","USD","open","2026-12-01","P001"],
    invoices:["INV-EXAMPLE","Example Vendor","PO-EXAMPLE","250.00","USD","2026-09-01","2026-10-01","pending",""],
    vendors:["V-EXAMPLE","Example Vendor","USA","Chicago","","","","vendor@example.com","0","true","false"],
  };
  const csv = [fields.join(","),examples[dataset].map(v=>`"${v.replaceAll('"','""')}"`).join(",")].join("\r\n");
  return new NextResponse(csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${dataset}-template.csv"`}});
}
