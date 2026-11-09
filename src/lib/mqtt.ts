/**
 * Client MQTT 3.1.1 tối giản chạy qua WebSocket, tự viết (không thư viện ngoài).
 * Đủ cho việc chơi cờ online: CONNECT (kèm di chúc - Last Will), SUBSCRIBE, UNSUBSCRIBE, PUBLISH QoS 0 (có retain), PING.
 * Không lưu gì ở máy chủ ngoài các tin nhắn "retain" mà chính trang tự đặt và tự xoá.
 */

export interface MqttOptions {
  url: string;
  clientId: string;
  keepAlive?: number;
  /** Di chúc: máy chủ tự gửi khi kết nối bị đứt mà không ngắt chủ động */
  will?: { topic: string; payload: Uint8Array | string; retain?: boolean };
  timeoutMs?: number;
}

type Handler = (topic: string, payload: Uint8Array, retained: boolean) => void;

const enc = new TextEncoder();
const dec = new TextDecoder();

const u8 = (x: Uint8Array | string): Uint8Array => (typeof x === 'string' ? enc.encode(x) : x);

function str(s: string): number[] {
  const b = enc.encode(s);
  return [b.length >> 8, b.length & 255, ...b];
}

function bin(b: Uint8Array): number[] {
  return [b.length >> 8, b.length & 255, ...b];
}

function remLen(n: number): number[] {
  const out: number[] = [];
  do {
    let d = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) d |= 128;
    out.push(d);
  } while (n > 0);
  return out;
}

function packet(first: number, body: number[] | Uint8Array): Uint8Array {
  const len = remLen(body.length);
  const out = new Uint8Array(1 + len.length + body.length);
  out[0] = first;
  out.set(len, 1);
  out.set(body, 1 + len.length);
  return out;
}

/** Khớp chủ đề với bộ lọc có + và # */
export function topicMatch(filter: string, topic: string): boolean {
  const f = filter.split('/');
  const t = topic.split('/');
  for (let i = 0; i < f.length; i++) {
    if (f[i] === '#') return true;
    if (i >= t.length) return false;
    if (f[i] !== '+' && f[i] !== t[i]) return false;
  }
  return f.length === t.length;
}

export class MqttClient {
  private ws: WebSocket | null = null;
  private buf = new Uint8Array(0);
  private pid = 1;
  private subs = new Map<string, Set<Handler>>();
  private ping = 0;
  private closedByUs = false;
  onClose: (() => void) | null = null;
  connected = false;

  constructor(private opt: MqttOptions) {}

  connect(): Promise<void> {
    const o = this.opt;
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (e: Error) => {
        if (settled) return;
        settled = true;
        try { this.ws?.close(); } catch { /* bỏ qua */ }
        reject(e);
      };
      const timer = window.setTimeout(() => fail(new Error('timeout')), o.timeoutMs ?? 7000);
      let ws: WebSocket;
      try {
        ws = new WebSocket(o.url, 'mqtt');
      } catch (e) {
        window.clearTimeout(timer);
        fail(e as Error);
        return;
      }
      this.ws = ws;
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => {
        const keep = o.keepAlive ?? 30;
        let flags = 0x02; // clean session
        const payload: number[] = [...str(o.clientId)];
        if (o.will) {
          flags |= 0x04 | (o.will.retain ? 0x20 : 0);
          payload.push(...str(o.will.topic), ...bin(u8(o.will.payload)));
        }
        const body = [...str('MQTT'), 4, flags, keep >> 8, keep & 255, ...payload];
        ws.send(packet(0x10, body) as Uint8Array<ArrayBuffer>);
      };
      ws.onmessage = (ev) => {
        const data = new Uint8Array(ev.data as ArrayBuffer);
        const joined = new Uint8Array(this.buf.length + data.length);
        joined.set(this.buf);
        joined.set(data, this.buf.length);
        this.buf = joined;
        this.drain((type, flags, body) => {
          if (type === 2) {
            window.clearTimeout(timer);
            if (body[1] !== 0) return fail(new Error(`refused ${body[1]}`));
            settled = true;
            this.connected = true;
            const keep = (o.keepAlive ?? 30) * 1000;
            this.ping = window.setInterval(() => this.send(new Uint8Array([0xc0, 0])), Math.max(5000, keep * 0.6));
            resolve();
          } else if (type === 3) this.onPublish(flags, body);
        });
      };
      ws.onerror = () => fail(new Error('ws error'));
      ws.onclose = () => {
        window.clearTimeout(timer);
        window.clearInterval(this.ping);
        const was = this.connected;
        this.connected = false;
        if (!settled) fail(new Error('closed'));
        else if (was && !this.closedByUs) this.onClose?.();
      };
    });
  }

  /** Tách các gói đầy đủ khỏi bộ đệm (một khung WebSocket có thể chứa nhiều gói hoặc nửa gói) */
  private drain(cb: (type: number, flags: number, body: Uint8Array) => void): void {
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      let mult = 1, len = 0, i = 1, byte = 0;
      do {
        if (i >= b.length) return;
        byte = b[i++];
        len += (byte & 127) * mult;
        mult *= 128;
        if (i > 5) { this.buf = new Uint8Array(0); return; }
      } while (byte & 128);
      if (b.length < i + len) return;
      const body = b.slice(i, i + len);
      this.buf = b.slice(i + len);
      cb(b[0] >> 4, b[0] & 15, body);
    }
  }

  private onPublish(flags: number, body: Uint8Array): void {
    const tl = (body[0] << 8) | body[1];
    const topic = dec.decode(body.subarray(2, 2 + tl));
    const qos = (flags >> 1) & 3;
    const start = 2 + tl + (qos > 0 ? 2 : 0);
    const payload = body.subarray(start);
    if (qos === 1) {
      // Xác nhận PUBACK (chỉ xảy ra nếu máy chủ nâng QoS)
      this.send(new Uint8Array([0x40, 2, body[2 + tl], body[3 + tl]]));
    }
    const retained = (flags & 1) === 1;
    for (const [f, hs] of this.subs) if (topicMatch(f, topic)) hs.forEach((h) => h(topic, payload, retained));
  }

  private send(p: Uint8Array): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(p as Uint8Array<ArrayBuffer>);
  }

  subscribe(filter: string, h: Handler): () => void {
    let set = this.subs.get(filter);
    if (!set) {
      set = new Set();
      this.subs.set(filter, set);
      const id = this.pid++ & 0xffff || 1;
      this.send(packet(0x82, [id >> 8, id & 255, ...str(filter), 0]));
    }
    set.add(h);
    return () => {
      const s = this.subs.get(filter);
      if (!s) return;
      s.delete(h);
      if (!s.size) {
        this.subs.delete(filter);
        const id = this.pid++ & 0xffff || 1;
        this.send(packet(0xa2, [id >> 8, id & 255, ...str(filter)]));
      }
    };
  }

  publish(topic: string, payload: Uint8Array | string, retain = false): void {
    this.send(packet(0x30 | (retain ? 1 : 0), [...str(topic), ...u8(payload)]));
  }

  /**
   * Ngắt kết nối. graceful = true: gửi DISCONNECT để máy chủ bỏ di chúc.
   * graceful = false (rời trang): chỉ đóng socket để máy chủ gửi di chúc, dọn bàn chờ còn treo.
   */
  close(graceful = true): void {
    this.closedByUs = true;
    window.clearInterval(this.ping);
    if (graceful) this.send(new Uint8Array([0xe0, 0]));
    try { this.ws?.close(); } catch { /* bỏ qua */ }
    this.connected = false;
  }
}

export const textOf = (b: Uint8Array): string => dec.decode(b);
