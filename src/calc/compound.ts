/** Tính lãi kép với khoản góp thêm hằng tháng */

export type Compounding = 12 | 4 | 1;

export interface CompoundInput {
  initial: number;
  monthly: number;
  /** Lãi suất %/năm */
  annualRate: number;
  years: number;
  /** Số lần nhập lãi mỗi năm: 12 (tháng), 4 (quý), 1 (năm) */
  compounding: Compounding;
}

export interface CompoundYear {
  year: number;
  contributed: number;
  interest: number;
  balance: number;
}

export interface CompoundResult {
  years: CompoundYear[];
  finalBalance: number;
  totalContributed: number;
  totalInterest: number;
}

/**
 * Mô phỏng theo tháng: tiền góp vào cuối mỗi tháng; lãi tính trên số dư và nhập gốc vào cuối mỗi kỳ.
 * Tiền góp giữa kỳ chưa được tính lãi cho đến kỳ sau, giống cách ngân hàng tính.
 */
export function compoundGrowth(input: CompoundInput): CompoundResult {
  const months = Math.max(0, Math.round(input.years * 12));
  const monthsPerPeriod = 12 / input.compounding;
  const periodRate = input.annualRate / 100 / input.compounding;

  let balance = input.initial;
  let contributed = input.initial;
  let periodStartBalance = balance;
  const years: CompoundYear[] = [];

  for (let m = 1; m <= months; m++) {
    if (m % monthsPerPeriod === 0) {
      balance += periodStartBalance * periodRate;
    }
    balance += input.monthly;
    contributed += input.monthly;
    if (m % monthsPerPeriod === 0) periodStartBalance = balance;
    if (m % 12 === 0 || m === months) {
      years.push({ year: Math.ceil(m / 12), contributed, interest: balance - contributed, balance });
    }
  }

  return {
    years,
    finalBalance: balance,
    totalContributed: contributed,
    totalInterest: balance - contributed,
  };
}
