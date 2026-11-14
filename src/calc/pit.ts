/**
 * Quyết toán thuế thu nhập cá nhân (TNCN) từ tiền lương, tiền công theo năm.
 * Năm 2026: Luật Thuế TNCN 109/2025/QH15 (biểu thuế 5 bậc) + Nghị quyết 110/2025/UBTVQH15 (giảm trừ 15,5 / 6,2 triệu).
 * Năm 2025: Luật 04/2007/QH12 (biểu thuế 7 bậc) + Nghị quyết 954/2020/UBTVQH14 (giảm trừ 11 / 4,4 triệu).
 * Biểu thuế năm = biểu thuế tháng × 12.
 */
import { SALARY_RULES, type Region } from './salary';

export type PitYear = 2026 | 2025;

interface YearRules {
  personal: number;
  dependent: number;
  /** Bậc thuế theo THÁNG (nhân 12 khi quyết toán năm) */
  brackets: { upTo: number; rate: number }[];
}

export const PIT_RULES: Record<PitYear, YearRules> = {
  2026: {
    personal: SALARY_RULES.personalDeduction,
    dependent: SALARY_RULES.dependentDeduction,
    brackets: SALARY_RULES.brackets,
  },
  2025: {
    personal: 11_000_000,
    dependent: 4_400_000,
    brackets: [
      { upTo: 5_000_000, rate: 0.05 },
      { upTo: 10_000_000, rate: 0.1 },
      { upTo: 18_000_000, rate: 0.15 },
      { upTo: 32_000_000, rate: 0.2 },
      { upTo: 52_000_000, rate: 0.25 },
      { upTo: 80_000_000, rate: 0.3 },
      { upTo: Infinity, rate: 0.35 },
    ],
  },
};

export interface PitInput {
  year: PitYear;
  /** Lương bình quân mỗi tháng (đã gồm phụ cấp chịu thuế) */
  monthlySalary: number;
  /** Số tháng có lương trong năm (1–12) */
  months: number;
  /** Thưởng và thu nhập chịu thuế khác trong năm (thưởng Tết, tháng 13…) */
  bonus: number;
  /** Phụ cấp, khoản miễn thuế trong năm (không tính vào thu nhập chịu thuế) */
  exempt: number;
  /** Lương đóng bảo hiểm mỗi tháng; null = bằng lương */
  insuranceSalary: number | null;
  region: Region;
  dependents: number;
  /** Số tháng được tính giảm trừ gia cảnh (1–12) */
  deductionMonths: number;
  /** Đóng góp từ thiện, nhân đạo, khuyến học được trừ */
  charity: number;
  /** Thuế đã tạm khấu trừ / tạm nộp trong năm */
  withheld: number;
}

export interface PitBand {
  from: number;
  to: number;
  rate: number;
  taxable: number;
  tax: number;
}

export interface PitResult {
  totalIncome: number;
  taxableGross: number;
  insurance: number;
  personal: number;
  dependents: number;
  charity: number;
  taxableIncome: number;
  bands: PitBand[];
  tax: number;
  averageRate: number;
  /** > 0: phải nộp thêm; < 0: được hoàn */
  settle: number;
  /** Thuế phải nộp nếu không có khoản thưởng */
  taxWithoutBonus: number;
  bonusTax: number;
  bonusNet: number;
  net: number;
}

export function annualTax(taxable: number, year: PitYear): { tax: number; bands: PitBand[] } {
  const bands: PitBand[] = [];
  let tax = 0;
  let from = 0;
  for (const b of PIT_RULES[year].brackets) {
    const upTo = b.upTo * 12;
    const portion = Math.max(0, Math.min(taxable, upTo) - from);
    const bandTax = portion * b.rate;
    bands.push({ from, to: upTo, rate: b.rate, taxable: portion, tax: bandTax });
    tax += bandTax;
    from = upTo;
    if (taxable <= upTo) break;
  }
  return { tax, bands };
}

/** Bảo hiểm bắt buộc người lao động đóng mỗi tháng (BHXH 8% + BHYT 1,5% + BHTN 1%) */
export function monthlyInsurance(insured: number, region: Region): number {
  const r = SALARY_RULES;
  const socialBase = Math.min(Math.max(0, insured), r.baseSalary * r.capMultiplier);
  const unempBase = Math.min(Math.max(0, insured), r.regionMinWage[region] * r.capMultiplier);
  return socialBase * (r.employee.social + r.employee.health) + unempBase * r.employee.unemployment;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function computePit(input: PitInput): PitResult {
  const rules = PIT_RULES[input.year];
  const months = clamp(Math.round(input.months), 1, 12);
  const dedMonths = clamp(Math.round(input.deductionMonths), 0, 12);
  const deps = Math.max(0, Math.floor(input.dependents));
  const salary = Math.max(0, input.monthlySalary);
  const bonus = Math.max(0, input.bonus);
  const exempt = Math.max(0, input.exempt);

  const totalIncome = salary * months + bonus + exempt;
  const taxableGross = salary * months + bonus;
  const insured = input.insuranceSalary == null ? salary : Math.max(0, input.insuranceSalary);
  const insurance = monthlyInsurance(insured, input.region) * months;
  const personal = rules.personal * dedMonths;
  const dependents = rules.dependent * deps * dedMonths;
  const charity = Math.max(0, input.charity);

  const taxableOf = (gross: number) => Math.max(0, gross - insurance - personal - dependents - charity);
  const taxableIncome = taxableOf(taxableGross);
  const { tax, bands } = annualTax(taxableIncome, input.year);
  const taxWithoutBonus = annualTax(taxableOf(taxableGross - bonus), input.year).tax;
  const bonusTax = tax - taxWithoutBonus;

  return {
    totalIncome,
    taxableGross,
    insurance,
    personal,
    dependents,
    charity,
    taxableIncome,
    bands,
    tax,
    averageRate: taxableGross > 0 ? tax / taxableGross : 0,
    settle: tax - Math.max(0, input.withheld),
    taxWithoutBonus,
    bonusTax,
    bonusNet: bonus - bonusTax,
    net: totalIncome - insurance - tax,
  };
}
