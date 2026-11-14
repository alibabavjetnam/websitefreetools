/** Tính mạng con IPv4 / IPv6 — phần thuần */
export const ipToInt = (ip: string): number => {
  const p = ip.trim().split('.');
  if (p.length !== 4 || p.some((x) => !/^\d{1,3}$/.test(x) || Number(x) > 255)) throw new Error('ip');
  return p.reduce((a, x) => a * 256 + Number(x), 0);
};
export const intToIp = (n: number): string => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
export interface V4 { network: string; broadcast: string; first: string; last: string; mask: string; wildcard: string; prefix: number; hosts: number; total: number; cls: string; priv: string; bin: string }
export function parseCidr4(s: string): { ip: number; prefix: number } {
  const m = s.trim().match(/^([\d.]+)\s*(?:\/\s*(\d{1,2})|\s+([\d.]+))?$/);
  if (!m) throw new Error('fmt');
  const ip = ipToInt(m[1]);
  let prefix = 24;
  if (m[2] !== undefined) prefix = Number(m[2]);
  else if (m[3]) { const mk = ipToInt(m[3]); const b = mk.toString(2).padStart(32, '0'); if (!/^1*0*$/.test(b)) throw new Error('mask'); prefix = b.indexOf('0') < 0 ? 32 : b.indexOf('0'); }
  if (prefix < 0 || prefix > 32) throw new Error('prefix');
  return { ip, prefix };
}
export function subnet4(ip: number, prefix: number): V4 {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const net = (ip & mask) >>> 0;
  const bc = (net | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);
  const hosts = prefix >= 31 ? total : total - 2;
  const first = prefix >= 31 ? net : net + 1, last = prefix >= 31 ? bc : bc - 1;
  const a = ip >>> 24;
  const cls = a < 128 ? 'A' : a < 192 ? 'B' : a < 224 ? 'C' : a < 240 ? 'D' : 'E';
  const priv = a === 10 || (a === 172 && ((ip >>> 16) & 255) >= 16 && ((ip >>> 16) & 255) <= 31) || (a === 192 && ((ip >>> 16) & 255) === 168) ? 'private'
    : a === 127 ? 'loopback' : a === 169 && ((ip >>> 16) & 255) === 254 ? 'linklocal' : a === 100 && ((ip >>> 16) & 255) >= 64 && ((ip >>> 16) & 255) <= 127 ? 'cgnat' : a >= 224 ? 'multicast' : 'public';
  const bin = (n: number) => n.toString(2).padStart(32, '0').replace(/(.{8})(?!$)/g, '$1.');
  return { network: intToIp(net), broadcast: intToIp(bc), first: intToIp(first), last: intToIp(last), mask: intToIp(mask), wildcard: intToIp(~mask >>> 0), prefix, hosts, total, cls, priv, bin: bin(ip) };
}
/** Chia mạng thành các mạng con /newPrefix */
export function split4(ip: number, prefix: number, newPrefix: number, limit = 256): string[] {
  if (newPrefix < prefix || newPrefix > 32) return [];
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const net = (ip & mask) >>> 0;
  const step = 2 ** (32 - newPrefix);
  const n = Math.min(limit, 2 ** (newPrefix - prefix));
  return Array.from({ length: n }, (_, i) => `${intToIp(net + i * step)}/${newPrefix}`);
}
/** IPv6: mở rộng, rút gọn, dải mạng */
export function expand6(s: string): bigint {
  let t = s.trim().toLowerCase().replace(/%.*$/, '').replace(/^\[|\]$/g, '');
  if (!/^[0-9a-f:.]+$/.test(t)) throw new Error('v6');
  if (t.includes('.')) {
    const i = t.lastIndexOf(':');
    const v4 = ipToInt(t.slice(i + 1));
    t = t.slice(0, i + 1) + ((v4 >>> 16) & 0xffff).toString(16) + ':' + (v4 & 0xffff).toString(16);
  }
  const parts = t.split('::');
  if (parts.length > 2) throw new Error('v6');
  const head = parts[0] ? parts[0].split(':') : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  const fill = 8 - head.length - tail.length;
  if ((parts.length === 1 && fill !== 0) || fill < 0) throw new Error('v6');
  const groups = [...head, ...Array(parts.length === 2 ? fill : 0).fill('0'), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) throw new Error('v6');
  return groups.reduce((a, g) => (a << 16n) | BigInt(parseInt(g, 16)), 0n);
}
export function full6(v: bigint): string {
  return Array.from({ length: 8 }, (_, i) => ((v >> BigInt((7 - i) * 16)) & 0xffffn).toString(16).padStart(4, '0')).join(':');
}
export function short6(v: bigint): string {
  const g = Array.from({ length: 8 }, (_, i) => Number((v >> BigInt((7 - i) * 16)) & 0xffffn));
  let bs = -1, bl = 0;
  for (let i = 0; i < 8; ) {
    if (g[i] !== 0) { i++; continue; }
    let j = i;
    while (j < 8 && g[j] === 0) j++;
    if (j - i > bl && j - i > 1) { bs = i; bl = j - i; }
    i = j;
  }
  const h = g.map((x) => x.toString(16));
  if (bs < 0) return h.join(':');
  return `${h.slice(0, bs).join(':')}::${h.slice(bs + bl).join(':')}`;
}
export function subnet6(v: bigint, prefix: number): { network: string; last: string; total: bigint } {
  const host = 128n - BigInt(prefix);
  const mask = ((1n << 128n) - 1n) ^ ((1n << host) - 1n);
  const net = v & mask;
  return { network: short6(net), last: short6(net | ((1n << host) - 1n)), total: 1n << host };
}
