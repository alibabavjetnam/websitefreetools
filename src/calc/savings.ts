/**
 * Lãi tiền gửi tiết kiệm theo cách ngân hàng thường quảng cáo: kỳ hạn tính theo tháng,
 * lãi kỳ hạn = tiền gửi × lãi suất năm × số tháng / 12 (gửi 12 tháng được trọn lãi suất năm).
 * Rút trước hạn tính theo số ngày thực gửi: lãi = tiền gửi × lãi suất không kỳ hạn × số ngày / 365.
 */

export type InterestMode = 'maturity' | 'monthly';

export interface SavingsInput {
  principal: number;
  /** Kỳ hạn gửi (tháng) */
  termMonths: number;
  /** Lãi suất %/năm */
  annualRate: number;
  mode: InterestMode;
  /** Số kỳ tái tục gốc + lãi (1 = không tái tục) */
  rollovers: number;
  /** Rút trước hạn: số ngày thực gửi và lãi suất không kỳ hạn %/năm (null = không rút sớm) */
  early: { days: number; rate: number } | null;
}

export interface SavingsRow {
  /** Số thứ tự tháng (trả lãi hằng tháng) hoặc kỳ (tái tục) */
  index: number;
  interest: number;
  /** Số dư cuối kỳ (gốc + lãi đã gộp); trả lãi hằng tháng thì là tổng lãi đã nhận */
  balance: number;
}

export interface SavingsResult {
  totalInterest: number;
  totalReceived: number;
  /** Lãi suất thực nhận quy năm */
  effectiveRate: number;
  days: number;
  rows: SavingsRow[];
  /** Lãi nếu gửi đủ kỳ hạn (để so sánh với rút sớm) */
  fullTermInterest: number;
  earlyLoss: number;
}

export const DAYS_PER_YEAR = 365;

const monthsInterest = (amount: number, ratePct: number, months: number) => (amount * ratePct * months) / 100 / 12;
const daysInterest = (amount: number, ratePct: number, days: number) => (amount * ratePct * days) / 100 / DAYS_PER_YEAR;

export function computeSavings(i: SavingsInput): SavingsResult {
  const P = i.principal;
  const termDays = Math.round((i.termMonths * DAYS_PER_YEAR) / 12);
  const rows: SavingsRow[] = [];

  const fullInterest = (() => {
    if (i.mode === 'monthly') return monthsInterest(P, i.annualRate, 1) * i.termMonths;
    let bal = P;
    for (let k = 0; k < Math.max(1, i.rollovers); k++) bal += monthsInterest(bal, i.annualRate, i.termMonths);
    return bal - P;
  })();

  if (i.early) {
    const days = Math.max(0, Math.floor(i.early.days));
    const interest = daysInterest(P, i.early.rate, days);
    rows.push({ index: 1, interest, balance: P + interest });
    return {
      totalInterest: interest,
      totalReceived: P + interest,
      effectiveRate: days > 0 ? (interest / P) * (DAYS_PER_YEAR / days) * 100 : 0,
      days,
      rows,
      fullTermInterest: fullInterest,
      earlyLoss: Math.max(0, fullInterest - interest),
    };
  }

  if (i.mode === 'monthly') {
    const monthly = monthsInterest(P, i.annualRate, 1);
    let acc = 0;
    for (let m = 1; m <= i.termMonths; m++) {
      acc += monthly;
      rows.push({ index: m, interest: monthly, balance: acc });
    }
    return {
      totalInterest: acc,
      totalReceived: P + acc,
      effectiveRate: i.termMonths > 0 ? (acc / P) * (DAYS_PER_YEAR / termDays) * 100 : 0,
      days: termDays,
      rows,
      fullTermInterest: acc,
      earlyLoss: 0,
    };
  }

  const n = Math.max(1, Math.floor(i.rollovers));
  let bal = P;
  for (let k = 1; k <= n; k++) {
    const interest = monthsInterest(bal, i.annualRate, i.termMonths);
    bal += interest;
    rows.push({ index: k, interest, balance: bal });
  }
  const total = bal - P;
  const days = termDays * n;
  return {
    totalInterest: total,
    totalReceived: bal,
    effectiveRate: days > 0 ? (Math.pow(bal / P, DAYS_PER_YEAR / days) - 1) * 100 : 0,
    days,
    rows,
    fullTermInterest: total,
    earlyLoss: 0,
  };
}
