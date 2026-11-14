/**
 * Đổi lịch dương ↔ âm (múi giờ Việt Nam UTC+7) theo thuật toán thiên văn của Hồ Ngọc Đức.
 * Kèm Can Chi của năm và ngày (chỉ số, phần hiển thị tên do giao diện chọn).
 */
const TZ = 7;
const PI = Math.PI;
const floor = Math.floor;

export function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + floor((153 * m + 2) / 5) + 365 * y + floor(y / 4) - floor(y / 100) + floor(y / 400) - 32045;
  if (jd < 2299161) jd = dd + floor((153 * m + 2) / 5) + 365 * y + floor(y / 4) - 32083;
  return jd;
}

export function jdToDate(jd: number): [number, number, number] {
  let b: number;
  let c: number;
  if (jd > 2299160) {
    const a = jd + 32044;
    b = floor((4 * a + 3) / 146097);
    c = a - floor((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = floor((4 * c + 3) / 1461);
  const e = c - floor((1461 * d) / 4);
  const m = floor((5 * e + 2) / 153);
  return [e - floor((153 * m + 2) / 5) + 1, m + 3 - 12 * floor(m / 10), b * 100 + d - 4800 + floor(m / 10)];
}

function newMoon(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 -= 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const dt = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3 : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return floor(Jd1 + C1 - dt + 0.5 + TZ / 24);
}

function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0 - 0.5 - TZ / 24) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L -= PI * 2 * floor(L / (PI * 2));
  return floor((L / PI) * 6);
}

function lunarMonth11(yy: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = floor(off / 29.530588853);
  let nm = newMoon(k);
  if (sunLongitude(nm) >= 9) nm = newMoon(k - 1);
  return nm;
}

function leapMonthOffset(a11: number): number {
  const k = floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = sunLongitude(newMoon(k + i));
  do {
    last = arc;
    i++;
    arc = sunLongitude(newMoon(k + i));
  } while (arc !== last && i < 14);
  return i - 1;
}

export interface LunarDate { day: number; month: number; year: number; leap: boolean }

export function solarToLunar(dd: number, mm: number, yy: number): LunarDate {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = newMoon(k + 1);
  if (monthStart > dayNumber) monthStart = newMoon(k);
  let a11 = lunarMonth11(yy);
  let b11 = a11;
  let year: number;
  if (a11 >= monthStart) {
    year = yy;
    a11 = lunarMonth11(yy - 1);
  } else {
    year = yy + 1;
    b11 = lunarMonth11(yy + 1);
  }
  const day = dayNumber - monthStart + 1;
  const diff = floor((monthStart - a11) / 29);
  let leap = false;
  let month = diff + 11;
  if (b11 - a11 > 365) {
    const lmd = leapMonthOffset(a11);
    if (diff >= lmd) {
      month = diff + 10;
      if (diff === lmd) leap = true;
    }
  }
  if (month > 12) month -= 12;
  if (month >= 11 && diff < 4) year -= 1;
  return { day, month, year, leap };
}

/** Trả về null nếu ngày âm không tồn tại (ví dụ tháng nhuận không có) */
export function lunarToSolar(ld: number, lm: number, ly: number, leap: boolean): [number, number, number] | null {
  let a11: number;
  let b11: number;
  if (lm < 11) {
    a11 = lunarMonth11(ly - 1);
    b11 = lunarMonth11(ly);
  } else {
    a11 = lunarMonth11(ly);
    b11 = lunarMonth11(ly + 1);
  }
  const k = floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lm - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = leapMonthOffset(a11);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (leap && lm !== leapMonth) return null;
    if (leap || off >= leapOff) off += 1;
  } else if (leap) return null;
  const start = newMoon(k + off);
  const nextStart = newMoon(k + off + 1);
  if (ld < 1 || ld > nextStart - start) return null;
  return jdToDate(start + ld - 1);
}

/** Chỉ số Can (0-9) và Chi (0-11) của năm âm lịch */
export const yearCanChi = (y: number): [number, number] => [(((y + 6) % 10) + 10) % 10, (((y + 8) % 12) + 12) % 12];
/** Chỉ số Can Chi của ngày (theo số ngày Julius) */
export const dayCanChi = (dd: number, mm: number, yy: number): [number, number] => {
  const jd = jdFromDate(dd, mm, yy);
  return [(jd + 9) % 10, (jd + 1) % 12];
};
export const CAN_VI = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
export const CHI_VI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
export const CAN_ZH = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const CHI_ZH = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
