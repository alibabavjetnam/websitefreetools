/** Nội dung mã QR chuyển khoản theo chuẩn VietQR / NAPAS 247 (EMVCo) — tự tạo, không cần API */
export const BANKS: [string, string, string][] = [
  ['970436', 'Vietcombank', 'VCB'], ['970415', 'VietinBank', 'CTG'], ['970418', 'BIDV', 'BIDV'], ['970405', 'Agribank', 'AGR'], ['970407', 'Techcombank', 'TCB'],
  ['970422', 'MB Bank', 'MB'], ['970416', 'ACB', 'ACB'], ['970432', 'VPBank', 'VPB'], ['970423', 'TPBank', 'TPB'], ['970403', 'Sacombank', 'STB'],
  ['970437', 'HDBank', 'HDB'], ['970441', 'VIB', 'VIB'], ['970443', 'SHB', 'SHB'], ['970431', 'Eximbank', 'EIB'], ['970426', 'MSB', 'MSB'],
  ['970448', 'OCB', 'OCB'], ['970440', 'SeABank', 'SEAB'], ['970449', 'LPBank', 'LPB'], ['970428', 'Nam A Bank', 'NAB'], ['970409', 'Bac A Bank', 'BAB'],
  ['970425', 'ABBANK', 'ABB'], ['970427', 'VietABank', 'VAB'], ['970412', 'PVcomBank', 'PVCB'], ['970400', 'Saigonbank', 'SGICB'], ['970419', 'NCB', 'NCB'],
  ['970452', 'KienlongBank', 'KLB'], ['970438', 'BaoViet Bank', 'BVB'], ['970433', 'Vietbank', 'VIETBANK'], ['970430', 'PGBank', 'PGB'], ['970406', 'DongA Bank', 'DOB'],
  ['970408', 'GPBank', 'GPB'], ['970414', 'MBV (OceanBank)', 'MBV'], ['970444', 'CBBank', 'CBB'], ['970429', 'SCB', 'SCB'], ['970454', 'Viet Capital Bank', 'BVBANK'],
  ['970424', 'Shinhan Bank', 'SHBVN'], ['970457', 'Woori Bank', 'WVN'], ['970458', 'UOB', 'UOB'], ['970410', 'Standard Chartered', 'SCVN'], ['970439', 'Public Bank', 'PBVN'],
  ['970442', 'Hong Leong Bank', 'HLBVN'], ['970434', 'Indovina Bank', 'IVB'], ['970421', 'VRB', 'VRB'], ['546034', 'CAKE by VPBank', 'CAKE'], ['546035', 'Ubank by VPBank', 'UBANK'],
  ['963388', 'Timo', 'TIMO'], ['668888', 'KBank', 'KBANK'], ['422589', 'CIMB', 'CIMB'], ['458761', 'HSBC', 'HSBC'], ['970455', 'IBK', 'IBK'],
];
const tlv = (id: string, v: string): string => id + String(v.length).padStart(2, '0') + v;
export function crc16(s: string): string {
  let crc = 0xffff;
  for (const b of new TextEncoder().encode(s)) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
/** Nội dung chuyển khoản: bỏ dấu, chỉ giữ chữ số, chữ cái và dấu cách (nhiều ngân hàng không nhận ký tự khác) */
export const cleanMemo = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50);
export function vietQrPayload(bin: string, account: string, amount: number | null, memo: string): string {
  const acct = tlv('00', bin) + tlv('01', account.replace(/\s/g, ''));
  const mai = tlv('00', 'A000000727') + tlv('01', acct) + tlv('02', 'QRIBFTTA');
  let s = tlv('00', '01') + tlv('01', amount ? '12' : '11') + tlv('38', mai) + tlv('53', '704');
  if (amount) s += tlv('54', String(Math.round(amount)));
  s += tlv('58', 'VN');
  const m = cleanMemo(memo);
  if (m) s += tlv('62', tlv('08', m));
  s += '6304';
  return s + crc16(s);
}
