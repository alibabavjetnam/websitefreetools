/**
 * Ước tính lương hưu hằng tháng, trợ cấp một lần và BHXH một lần theo Luật BHXH 2024 (41/2024/QH15, hiệu lực 01/7/2025).
 * Chỉ là ước tính: mức bình quân tiền lương làm căn cứ đóng BHXH do người dùng nhập (chưa tính hệ số trượt giá).
 */

export type Gender = 'male' | 'female';

export const BHXH_RULES = {
  /** Tỷ lệ hưởng tối đa */
  maxRate: 0.75,
  /** Nữ: 15 năm = 45%, mỗi năm thêm 2% */
  female: { baseYears: 15, baseRate: 0.45, step: 0.02, maxYears: 30 },
  /** Nam: 15 năm = 40%, mỗi năm thêm 1% tới 20 năm (45%), sau đó mỗi năm thêm 2% */
  male: { baseYears: 15, baseRate: 0.4, step1: 0.01, midYears: 20, step2: 0.02, maxYears: 35 },
  /** Trợ cấp một lần: mỗi năm vượt mức tối đa = 0,5 tháng lương bình quân */
  extraLumpPerYear: 0.5,
  /** BHXH một lần: số tháng lương bình quân cho mỗi năm đóng */
  lumpBefore2014: 1.5,
  lumpFrom2014: 2,
  /** Tỷ lệ đóng BHXH (hưu trí, tử tuất) của cả người lao động và doanh nghiệp: 8% + 14% */
  contributionRate: 0.22,
};

/** Tuổi nghỉ hưu điều kiện bình thường (Bộ luật Lao động 2019) theo năm nghỉ hưu, tính bằng tháng */
export function retirementAgeMonths(gender: Gender, year: number): number {
  if (gender === 'male') {
    // 60 tuổi 3 tháng năm 2021, mỗi năm +3 tháng tới 62 tuổi (2028)
    return Math.min(62 * 12, 60 * 12 + 3 + Math.max(0, year - 2021) * 3);
  }
  // 55 tuổi 4 tháng năm 2021, mỗi năm +4 tháng tới 60 tuổi (2035)
  return Math.min(60 * 12, 55 * 12 + 4 + Math.max(0, year - 2021) * 4);
}

/** Tháng lẻ: 1–6 tháng tính nửa năm, 7–11 tháng tính một năm */
export function roundContributionYears(totalMonths: number): number {
  const m = Math.max(0, Math.floor(totalMonths));
  const years = Math.floor(m / 12);
  const rest = m % 12;
  return years + (rest === 0 ? 0 : rest <= 6 ? 0.5 : 1);
}

/** Tỷ lệ hưởng lương hưu (0 nếu chưa đủ 15 năm) */
export function pensionRate(gender: Gender, years: number): number {
  const R = BHXH_RULES;
  if (years < 15) return 0;
  if (gender === 'female') {
    const f = R.female;
    return Math.min(R.maxRate, f.baseRate + (Math.min(years, f.maxYears) - f.baseYears) * f.step);
  }
  const m = R.male;
  if (years <= m.midYears) return m.baseRate + (years - m.baseYears) * m.step1;
  const mid = m.baseRate + (m.midYears - m.baseYears) * m.step1; // 45%
  return Math.min(R.maxRate, mid + (Math.min(years, m.maxYears) - m.midYears) * m.step2);
}

export interface PensionInput {
  gender: Gender;
  /** Tổng số tháng đã đóng BHXH khi nghỉ hưu */
  totalMonths: number;
  /** Mức bình quân tiền lương làm căn cứ đóng BHXH */
  avgSalary: number;
  /** Năm dự kiến nghỉ hưu (để tra tuổi nghỉ hưu) */
  retireYear: number;
}

export interface PensionResult {
  years: number;
  eligible: boolean;
  rate: number;
  monthly: number;
  yearly: number;
  /** Số năm vượt mức tối đa (nữ 30, nam 35) */
  extraYears: number;
  extraLump: number;
  retireAgeMonths: number;
}

export function computePension(i: PensionInput): PensionResult {
  const R = BHXH_RULES;
  const years = roundContributionYears(i.totalMonths);
  const rate = pensionRate(i.gender, years);
  const avg = Math.max(0, i.avgSalary);
  const maxYears = i.gender === 'female' ? R.female.maxYears : R.male.maxYears;
  const extraYears = Math.max(0, years - maxYears);
  const monthly = avg * rate;
  return {
    years,
    eligible: years >= 15,
    rate,
    monthly,
    yearly: monthly * 12,
    extraYears,
    extraLump: extraYears * R.extraLumpPerYear * avg,
    retireAgeMonths: retirementAgeMonths(i.gender, i.retireYear),
  };
}

export interface LumpInput {
  /** Số tháng đã đóng trước 01/01/2014 */
  monthsBefore2014: number;
  /** Số tháng đã đóng từ 01/01/2014 */
  monthsFrom2014: number;
  /** Mức bình quân tiền lương tháng đóng BHXH */
  avgSalary: number;
}

export interface LumpResult {
  yearsBefore: number;
  yearsFrom: number;
  amountBefore: number;
  amountFrom: number;
  total: number;
  /** Trường hợp dưới 1 năm: bằng số tiền đã đóng (tối đa 2 tháng lương bình quân) */
  underOneYear: boolean;
  /** Tổng số tiền cả hai bên đã đóng cho BHXH (22%) để so sánh */
  contributed: number;
}

export function computeLump(i: LumpInput): LumpResult {
  const R = BHXH_RULES;
  const avg = Math.max(0, i.avgSalary);
  const mb = Math.max(0, Math.floor(i.monthsBefore2014));
  const mf = Math.max(0, Math.floor(i.monthsFrom2014));
  const contributed = (mb + mf) * avg * R.contributionRate;
  if (mb + mf < 12) {
    const total = Math.min(contributed, 2 * avg);
    return { yearsBefore: 0, yearsFrom: 0, amountBefore: 0, amountFrom: 0, total, underOneYear: true, contributed };
  }
  const yb = roundContributionYears(mb);
  const yf = roundContributionYears(mf);
  const amountBefore = yb * R.lumpBefore2014 * avg;
  const amountFrom = yf * R.lumpFrom2014 * avg;
  return { yearsBefore: yb, yearsFrom: yf, amountBefore, amountFrom, total: amountBefore + amountFrom, underOneYear: false, contributed };
}
