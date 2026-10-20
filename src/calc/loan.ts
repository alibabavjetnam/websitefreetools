/** Tính lịch trả nợ khoản vay */

export type LoanMethod = 'declining' | 'annuity';

export interface LoanInput {
  principal: number;
  months: number;
  /** Lãi suất %/năm */
  annualRate: number;
  method: LoanMethod;
  /** Số tháng hưởng lãi ưu đãi (0 = không có) */
  promoMonths: number;
  /** Lãi suất ưu đãi %/năm */
  promoRate: number;
}

export interface LoanRow {
  month: number;
  rate: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface LoanResult {
  rows: LoanRow[];
  totalInterest: number;
  totalPaid: number;
  firstPayment: number;
  maxPayment: number;
  minPayment: number;
}

export function annuityPayment(principal: number, monthlyRate: number, months: number): number {
  if (months <= 0) return principal;
  if (monthlyRate === 0) return principal / months;
  const f = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * f) / (f - 1);
}

export function loanSchedule(input: LoanInput): LoanResult {
  const months = Math.max(1, Math.round(input.months));
  const promoMonths = Math.min(months, Math.max(0, Math.round(input.promoMonths)));
  const principalPart = input.principal / months; // dùng cho phương thức gốc đều
  const rows: LoanRow[] = [];
  let balance = input.principal;
  let payment = 0;
  let currentRate = NaN;

  for (let m = 1; m <= months; m++) {
    const annual = m <= promoMonths ? input.promoRate : input.annualRate;
    const r = annual / 100 / 12;
    const interest = balance * r;
    let principal: number;

    if (input.method === 'declining') {
      principal = Math.min(principalPart, balance);
      payment = principal + interest;
    } else {
      // Trả góp đều: khi lãi suất đổi (hết ưu đãi), tính lại số tiền trả cho các tháng còn lại
      if (annual !== currentRate) {
        payment = annuityPayment(balance, r, months - m + 1);
        currentRate = annual;
      }
      principal = m === months ? balance : payment - interest;
    }

    balance = Math.max(0, balance - principal);
    rows.push({ month: m, rate: annual, payment: principal + interest, principal, interest, balance });
  }

  const totalInterest = rows.reduce((s, x) => s + x.interest, 0);
  const payments = rows.map((x) => x.payment);
  return {
    rows,
    totalInterest,
    totalPaid: input.principal + totalInterest,
    firstPayment: payments[0] ?? 0,
    maxPayment: Math.max(...payments),
    minPayment: Math.min(...payments),
  };
}
