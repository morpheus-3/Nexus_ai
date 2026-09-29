export interface FraudPaymentRecord {
  paymentStatus: string | null;
  riskScore: string | number | null;
}

export function getFraudPaymentMetrics<T extends FraudPaymentRecord>(records: T[]) {
  const blocked = records.filter(record => record.paymentStatus === "blocked");
  const recommended = records.filter(record => record.paymentStatus === "pending" && Number(record.riskScore || 0) >= 60);
  return { blockedInvoices: blocked, recommendedBlockInvoices: recommended };
}

export interface ReorderFinding {
  materialNumber: string;
  description: string;
  severity: string;
}

export interface PendingRequisition {
  prNumber: string;
  materialNumber: string | null;
}

export function matchPendingRequisitions(findings: ReorderFinding[], requisitions: PendingRequisition[]) {
  const reviewExisting = findings.flatMap(finding => {
    const matches = requisitions.filter(request => request.materialNumber === finding.materialNumber);
    return matches.map(request => ({ materialNumber: finding.materialNumber, description: finding.description, prNumber: request.prNumber }));
  });
  const materialNumbersWithRequests = new Set(reviewExisting.map(match => match.materialNumber));
  const createNew = findings.filter(finding => !materialNumbersWithRequests.has(finding.materialNumber));
  return { reviewExisting, createNew };
}
