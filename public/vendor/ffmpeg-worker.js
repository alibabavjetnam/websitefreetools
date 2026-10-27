/* Worker chạy ffmpeg.wasm (bản lõi @ffmpeg/core, đơn luồng) cho WFTools.
 * Đặt cùng tên miền với trang để trình duyệt cho phép tạo worker; lõi ffmpeg và file .wasm tải từ CDN.
 * Giao tiếp: trang gửi {id, type, ...}, worker trả {id, ok, data | error}; tiến độ và log gửi dạng {type:'progress'|'log'}.
 */
/* eslint-disable no-restricted-globals */
let core = null;

async function load({ coreURL, wasmURL }) {
  if (core) return false;
  importScripts(coreURL);
  if (typeof self.createFFmpegCore !== 'function') throw new Error('ffmpeg-core failed to load');
  // Cách truyền đường dẫn wasm giống thư viện gốc @ffmpeg/ffmpeg (tránh lỗi locateFile)
  core = await self.createFFmpegCore({
    mainScriptUrlOrBlob: `${coreURL}#${btoa(JSON.stringify({ wasmURL, workerURL: '' }))}`,
  });
  core.setLogger((d) => self.postMessage({ type: 'log', message: d.message }));
  core.setProgress((d) => self.postMessage({ type: 'progress', progress: d.progress, time: d.time }));
  return true;
}

function exec({ args, timeout = -1 }) {
  core.setTimeout(timeout);
  core.exec(...args);
  const ret = core.ret;
  core.reset();
  return ret;
}

self.onmessage = async ({ data }) => {
  const { id, type } = data;
  try {
    let result;
    const transfer = [];
    switch (type) {
      case 'load': result = await load(data); break;
      case 'exec': result = exec(data); break;
      case 'write': core.FS.writeFile(data.path, data.data); result = true; break;
      case 'read': result = core.FS.readFile(data.path); transfer.push(result.buffer); break;
      case 'delete': try { core.FS.unlink(data.path); } catch (e) { /* không có file */ } result = true; break;
      default: throw new Error('unknown command ' + type);
    }
    self.postMessage({ id, ok: true, data: result }, transfer);
  } catch (e) {
    self.postMessage({ id, ok: false, error: String(e && e.message ? e.message : e) });
  }
};
