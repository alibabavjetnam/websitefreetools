/**
 * Tính lương Gross ↔ Net theo quy định áp dụng tại thời điểm 10/2026.
 * Khi luật thay đổi, chỉ cần sửa khối SALARY_RULES bên dưới.
 */

export const SALARY_RULES = {
  /** Ngày quy định được rà soát lần cuối */
  reviewedAt: '20/10/2026',
  /** Lương cơ sở từ 01/7/2026 (Nghị định 161/2026/NĐ-CP) — dùng tính trần BHXH, BHYT */
  baseSalary: 2_530_000,
  /** Lương tối thiểu vùng từ 01/01/2026 (Nghị định 293/2025/NĐ-CP) — dùng tính trần BHTN */
  regionMinWage: { 1: 5_310_000, 2: 4_730_000, 3: 4_140_000, 4: 3_700_000 } as Record<Region, number>,
  /** Trần đóng bảo hiểm = 20 lần mức lương cơ sở / lương tối thiểu vùng */
  capMultiplier: 20,
  /** Tỷ lệ người lao động đóng */
  employee: { social: 0.08, health: 0.015, unemployment: 0.01 },
  /** Tỷ lệ doanh nghiệp đóng (BHXH 17% + tai nạn lao động, bệnh nghề nghiệp 0,5%) */
  employer: { social: 0.175, health: 0.03, unemployment: 0.01 },
  /** Giảm trừ gia cảnh / tháng (áp dụng từ kỳ tính thuế 2026) */
  personalDeduction: 15_500_000,
  dependentDeduction: 6_200_000,
  /** Biểu thuế luỹ tiến từng phần 5 bậc (thu nhập tính thuế / tháng) */
  brackets: [
    { upTo: 10_000_000, rate: 0.05 },
    { upTo: 30_000_000, rate: 0.1 },
    { upTo: 60_000_000, rate: 0.2 },
    { upTo: 100_000_000, rate: 0.3 },
    { upTo: Infinity, rate: 0.35 },
  ],
};

export type Region = 1 | 2 | 3 | 4;

export interface SalaryInput {
  gross: number;
  /** Lương đóng bảo hiểm; null = đóng trên toàn bộ lương Gross */
  insuranceSalary: number | null;
  region: Region;
  dependents: number;
}

export interface TaxBand {
  from: number;
  to: number;
  rate: number;
  taxable: number;
  tax: number;
}

export interface SalaryResult {
  gross: number;
  socialBase: number;
  unemploymentBase: number;
  employee: { social: number; health: number; unemployment: number; total: number };
  employer: { social: number; health: number; unemployment: number; total: number };
  deductions: { personal: number; dependents: number; total: number };
  incomeBeforeTax: number;
  taxableIncome: number;
  bands: TaxBand[];
  tax: number;
  net: number;
  employerCost: number;
}

export function progressiveTax(taxable: number): { tax: number; bands: TaxBand[] } {
  const bands: TaxBand[] = [];
  let tax = 0;
  let from = 0;
  for (const b of SALARY_RULES.brackets) {
    const portion = Math.max(0, Math.min(taxable, b.upTo) - from);
    const bandTax = portion * b.rate;
    bands.push({ from, to: b.upTo, rate: b.rate, taxable: portion, tax: bandTax });
    tax += bandTax;
    from = b.upTo;
    if (taxable <= b.upTo) break;
  }
  return { tax, bands };
}

export function grossToNet(input: SalaryInput): SalaryResult {
  const r = SALARY_RULES;
  const gross = Math.max(0, input.gross);
  const insured = Math.max(0, input.insuranceSalary ?? gross);
  const socialBase = Math.min(insured, r.baseSalary * r.capMultiplier);
  const unemploymentBase = Math.min(insured, r.regionMinWage[input.region] * r.capMultiplier);

  const emp = {
    social: socialBase * r.employee.social,
    health: socialBase * r.employee.health,
    unemployment: unemploymentBase * r.employee.unemployment,
    total: 0,
  };
  emp.total = emp.social + emp.health + emp.unemployment;

  const er = {
    social: socialBase * r.employer.social,
    health: socialBase * r.employer.health,
    unemployment: unemploymentBase * r.employer.unemployment,
    total: 0,
  };
  er.total = er.social + er.health + er.unemployment;

  const dependents = Math.max(0, Math.floor(input.dependents));
  const deductions = {
    personal: r.personalDeduction,
    dependents: dependents * r.dependentDeduction,
    total: r.personalDeduction + dependents * r.dependentDeduction,
  };

  const incomeBeforeTax = gross - emp.total;
  const taxableIncome = Math.max(0, incomeBeforeTax - deductions.total);
  const { tax, bands } = progressiveTax(taxableIncome);

  return {
    gross,
    socialBase,
    unemploymentBase,
    employee: emp,
    employer: er,
    deductions,
    incomeBeforeTax,
    taxableIncome,
    bands,
    tax,
    net: gross - emp.total - tax,
    employerCost: gross + er.total,
  };
}

/** Tìm lương Gross cho ra đúng mức Net mong muốn (Net tăng đơn điệu theo Gross nên dùng chia đôi) */
export function netToGross(net: number, rest: Omit<SalaryInput, 'gross'>): SalaryResult {
  if (net <= 0) return grossToNet({ ...rest, gross: 0 });
  let lo = net;
  let hi = net * 2 + 10_000_000;
  while (grossToNet({ ...rest, gross: hi }).net < net) hi *= 2;
  for (let i = 0; i < 100 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2;
    if (grossToNet({ ...rest, gross: mid }).net < net) lo = mid;
    else hi = mid;
  }
  return grossToNet({ ...rest, gross: Math.round(hi) });
}
