/** Dựng dòng lệnh ffmpeg cho công cụ cắt và đổi định dạng. Phần thuần, kiểm thử được bằng ffmpeg thật. */

export type MediaOp = 'cut' | 'convert' | 'gif';
export type Quality = 'high' | 'medium' | 'low';
export const VIDEO_FORMATS = ['mp4', 'webm'] as const;
export const AUDIO_FORMATS = ['mp3', 'm4a', 'wav', 'ogg'] as const;
export type TargetFormat = (typeof VIDEO_FORMATS)[number] | (typeof AUDIO_FORMATS)[number];

export interface MediaJob {
  inputName: string;
  op: MediaOp;
  /** Giây; 0 = từ đầu */
  start: number;
  /** Giây; 0 = đến hết */
  end: number;
  /** Chỉ cho op = 'cut': true = cắt nhanh không mã hoá lại (có thể lệch vài giây ở điểm cắt) */
  fastCut: boolean;
  format: TargetFormat;
  quality: Quality;
  /** Cho op = 'gif' */
  fps: number;
  width: number;
  /** Tệp nguồn có hình hay không */
  hasVideo: boolean;
}

export const MIME: Record<string, string> = {
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', gif: 'image/gif',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac', flac: 'audio/flac',
};

const CRF: Record<Quality, string> = { high: '20', medium: '24', low: '29' };
const VP8_BITRATE: Record<Quality, string> = { high: '2500k', medium: '1200k', low: '600k' };
const AUDIO_BR: Record<Quality, string> = { high: '256k', medium: '160k', low: '96k' };

export const safeExt = (name: string): string => (name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';

export interface BuiltJob { args: string[]; outName: string; mime: string; ext: string }

export function buildJob(j: MediaJob): BuiltJob {
  const start = Math.max(0, j.start || 0);
  const len = j.end > start ? j.end - start : 0;
  const pre = start > 0 ? ['-ss', String(start)] : [];
  const post = len > 0 ? ['-t', String(len)] : [];
  const inp = [...pre, '-i', j.inputName, ...post];

  if (j.op === 'cut') {
    const ext = safeExt(j.inputName);
    const outName = `out.${ext}`;
    const mime = MIME[ext] || (j.hasVideo ? 'video/mp4' : 'audio/mpeg');
    if (j.fastCut) return { args: [...inp, '-map', '0', '-c', 'copy', '-avoid_negative_ts', 'make_zero', outName], outName, mime, ext };
    // mã hoá lại để cắt chính xác từng khung hình, giữ nguyên vùng chứa
    const lossless = ext === 'wav';
    const args = j.hasVideo
      ? [...inp, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', CRF[j.quality], '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', ...(ext === 'mp4' || ext === 'mov' || ext === 'm4v' ? ['-movflags', '+faststart'] : []), outName]
      : [...inp, ...(lossless ? ['-c:a', 'pcm_s16le'] : ext === 'mp3' ? ['-c:a', 'libmp3lame', '-b:a', AUDIO_BR[j.quality]] : ext === 'ogg' ? ['-c:a', 'libvorbis', '-b:a', AUDIO_BR[j.quality]] : ['-c:a', 'aac', '-b:a', AUDIO_BR[j.quality]]), outName];
    return { args, outName, mime, ext };
  }

  if (j.op === 'gif') {
    const fps = Math.min(30, Math.max(1, Math.round(j.fps || 10)));
    const w = Math.min(1280, Math.max(64, Math.round(j.width || 480)));
    const vf = `fps=${fps},scale=${w}:-2:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4`;
    return { args: [...inp, '-an', '-vf', vf, '-loop', '0', 'out.gif'], outName: 'out.gif', mime: MIME.gif, ext: 'gif' };
  }

  const f = j.format;
  const outName = `out.${f}`;
  const mime = MIME[f];
  switch (f) {
    case 'mp4':
      return { args: [...inp, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', CRF[j.quality], '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', outName], outName, mime, ext: f };
    case 'webm':
      return { args: [...inp, '-c:v', 'libvpx', '-b:v', VP8_BITRATE[j.quality], '-crf', '10', '-c:a', 'libvorbis', '-b:a', '128k', outName], outName, mime, ext: f };
    case 'mp3':
      return { args: [...inp, '-vn', '-map', '0:a:0?', '-c:a', 'libmp3lame', '-b:a', AUDIO_BR[j.quality], outName], outName, mime, ext: f };
    case 'm4a':
      return { args: [...inp, '-vn', '-map', '0:a:0?', '-c:a', 'aac', '-b:a', AUDIO_BR[j.quality], outName], outName, mime, ext: f };
    case 'ogg':
      return { args: [...inp, '-vn', '-map', '0:a:0?', '-c:a', 'libvorbis', '-b:a', AUDIO_BR[j.quality], outName], outName, mime, ext: f };
    default:
      return { args: [...inp, '-vn', '-map', '0:a:0?', '-c:a', 'pcm_s16le', outName], outName, mime, ext: 'wav' };
  }
}

/** Định dạng đích cần hình hay không */
export const needsVideo = (f: TargetFormat): boolean => (VIDEO_FORMATS as readonly string[]).includes(f);
