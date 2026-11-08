/**
 * Kết nối AI cho Smart Search Crawler. Chạy ngay trong trình duyệt của bạn, khóa API (nếu có) chỉ gửi tới nhà cung cấp AI bạn chọn.
 *  - gemini : Google Gemini API, có hạn mức miễn phí (lấy khóa tại aistudio.google.com)
 *  - openai : ChatGPT API hoặc máy chủ tương thích (Ollama chạy trên máy: miễn phí, không cần khóa)
 *  - claude : Claude API (trả phí theo mức dùng)
 *  - manual : miễn phí hoàn toàn — trang tạo sẵn câu lệnh, bạn dán vào ChatGPT/Claude/Gemini bản web rồi dán câu trả lời lại
 */
export type Provider = 'none' | 'gemini' | 'openai' | 'claude' | 'manual';
export interface AiConfig { provider: Provider; key: string; model: string; baseUrl: string }

export const DEFAULT_MODELS: Record<Exclude<Provider, 'none' | 'manual'>, { model: string; baseUrl: string }> = {
  gemini: { model: 'gemini-2.5-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  openai: { model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
  claude: { model: 'claude-haiku-5-5', baseUrl: 'https://api.anthropic.com/v1' },
};

export type ManualHandler = (system: string, user: string) => Promise<string>;
let manualHandler: ManualHandler | null = null;
export function setManualHandler(fn: ManualHandler): void { manualHandler = fn; }

async function readError(res: Response): Promise<string> {
  let body = '';
  try { body = (await res.text()).slice(0, 300); } catch { /* bỏ qua */ }
  if (res.status === 401 || res.status === 403) return `Khóa API không đúng hoặc chưa được cấp quyền (mã ${res.status}). ${body}`;
  if (res.status === 429) return 'Đã chạm giới hạn số lần gọi của gói miễn phí (mã 429). Hãy đợi một lúc rồi thử lại, hoặc dùng chế độ "Dán tay".';
  return `AI trả về lỗi mã ${res.status}. ${body}`;
}

export async function askAi(cfg: AiConfig, system: string, user: string, opts: { json?: boolean; signal?: AbortSignal } = {}): Promise<string> {
  const base = cfg.baseUrl.replace(/\/+$/, '');
  if (cfg.provider === 'manual') {
    if (!manualHandler) throw new Error('Chưa có hộp dán tay.');
    return manualHandler(system, user);
  }
  if (cfg.provider === 'none') throw new Error('Chưa chọn AI.');
  if (cfg.provider !== 'openai' && !cfg.key.trim()) throw new Error('Hãy nhập khóa API trong mục "Trợ lý AI".');
  let res: Response;
  try {
    if (cfg.provider === 'gemini') {
      res = await fetch(`${base}/models/${encodeURIComponent(cfg.model)}:generateContent`, {
        method: 'POST', signal: opts.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key.trim() },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0.2, ...(opts.json ? { responseMimeType: 'application/json' } : {}) },
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts as { text?: string }[] | undefined;
      const text = (parts || []).map((p) => p.text || '').join('');
      if (!text) throw new Error('Gemini không trả về nội dung (có thể bị chặn bởi bộ lọc an toàn).');
      return text;
    }
    if (cfg.provider === 'openai') {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cfg.key.trim()) headers.Authorization = `Bearer ${cfg.key.trim()}`;
      res = await fetch(`${base}/chat/completions`, {
        method: 'POST', signal: opts.signal, headers,
        body: JSON.stringify({ model: cfg.model, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json();
      return String(data?.choices?.[0]?.message?.content ?? '');
    }
    res = await fetch(`${base}/messages`, {
      method: 'POST', signal: opts.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.key.trim(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: cfg.model, max_tokens: 4096, temperature: 0.2, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();
    return ((data?.content || []) as { text?: string }[]).map((c) => c.text || '').join('');
  } catch (e) {
    if (e instanceof TypeError) throw new Error('Không kết nối được tới AI. Kiểm tra mạng, địa chỉ máy chủ, hoặc (với Ollama) đặt OLLAMA_ORIGINS=* rồi khởi động lại Ollama.');
    throw e;
  }
}

/** Lấy JSON từ câu trả lời của AI (chịu được khối ```json và chữ thừa xung quanh) */
export function parseJsonLoose<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.search(/[{[]/);
  if (start < 0) throw new Error('AI không trả về JSON. Hãy thử lại.');
  const open = cleaned[start];
  const end = cleaned.lastIndexOf(open === '{' ? '}' : ']');
  if (end <= start) throw new Error('JSON của AI bị cắt dở. Hãy thử lại hoặc giảm số trang đưa cho AI.');
  try { return JSON.parse(cleaned.slice(start, end + 1)) as T; } catch { throw new Error('Không đọc được JSON do AI trả về. Hãy thử lại.'); }
}

/* ---------- Câu lệnh (prompt) ---------- */
export const INTENT_SYSTEM = `Bạn là bộ phân loại ý định tìm kiếm. Chỉ trả về JSON hợp lệ, không giải thích.
Định dạng: {"category": "...", "intents": ["..."], "queries": [{"q": "...", "purpose": "..."}]}
- category: một trong [Sản phẩm, Khuyến mãi, Bài viết, Tin tức, Nghiên cứu, Doanh nghiệp, Dịch vụ, Văn bản, Hình ảnh, Tuyển dụng].
- intents: tối đa 5 mục đích của người tìm (ví dụ: tìm nơi bán, so sánh giá, tìm bài đánh giá).
- queries: 3 đến 6 từ khóa phụ khác nhau về mục đích, cùng ngôn ngữ với từ khóa gốc, không lặp từ khóa gốc.`;

export interface PageDigest { id: number; url: string; title: string; published?: string; text: string; prices?: string[]; product?: unknown }

export const REPORT_SYSTEM = `Bạn là chuyên viên phân tích thông tin. Bạn nhận danh sách trang web đã thu thập, mỗi trang có số thứ tự [id].
Quy tắc bắt buộc:
- Mọi nhận định phải gắn nguồn bằng số thứ tự, ví dụ [3] hoặc [3][7]. Không tự bịa nguồn.
- Phân biệt rõ: "Trích trực tiếp" (có trong nội dung trang) và "Suy luận" (do bạn kết luận). Ghi nhãn từng ý.
- Nếu một thông tin không có trong dữ liệu thì ghi "chưa có dữ liệu", tuyệt đối không tự điền.
- Phát hiện thông tin mâu thuẫn giữa các nguồn (ví dụ giá khác nhau) và nêu rõ ngày đăng nếu có.
Trả lời bằng tiếng Việt, định dạng Markdown với các mục: ## Tóm tắt, ## Điểm chung, ## Khác biệt và mâu thuẫn, ## Thông tin nổi bật, ## Chưa được xác minh.`;

export const TABLE_SYSTEM = `Bạn trích xuất dữ liệu có cấu trúc từ các trang web. Chỉ trả về JSON hợp lệ.
Định dạng: {"columns": ["..."], "rows": [["...", ...], ...]} trong đó cột cuối cùng luôn là "Nguồn" chứa số thứ tự [id] của trang.
- Chọn các cột phù hợp với mục tiêu tìm kiếm (ví dụ sản phẩm: Tên, Giá, Thương hiệu, Đặc điểm; bài báo: Tiêu đề, Tác giả, Ngày đăng, Ý chính).
- Mỗi trang tối đa một dòng. Ô nào không có trong dữ liệu thì để chuỗi rỗng, không tự điền.`;

export function digestPrompt(keyword: string, pages: PageDigest[], extra = ''): string {
  const body = pages.map((p) => `[${p.id}] ${p.title}\nURL: ${p.url}${p.published ? `\nNgày đăng: ${p.published}` : ''}${p.product ? `\nSản phẩm (dữ liệu có cấu trúc): ${JSON.stringify(p.product)}` : ''}${p.prices?.length ? `\nGiá nhìn thấy: ${p.prices.join(' | ')}` : ''}\nNội dung: ${p.text.replace(/\s+/g, ' ')}`).join('\n\n---\n\n');
  return `Từ khóa tìm kiếm: ${keyword}\n${extra}\nDưới đây là ${pages.length} trang đã thu thập:\n\n${body}`;
}
