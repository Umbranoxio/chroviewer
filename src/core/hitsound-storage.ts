import { Result } from 'better-result';

const DIR_NAME = 'chroviewer_hitsounds';

async function getOpfsDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return await root.getDirectoryHandle(DIR_NAME, { create: true });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function canDecodeAudio(file: File): Promise<boolean> {
  const ctx = new AudioContext();
  try {
    const buffer = await file.arrayBuffer();
    await ctx.decodeAudioData(buffer.slice(0));
    return true;
  } catch {
    return false;
  } finally {
    await ctx.close();
  }
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return new ArrayBuffer(0);
  const binaryStr = atob(base64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function saveCustomHitsound(slot: 'good' | 'bad', file: File): Promise<Result<string, Error>> {
  if (!(await canDecodeAudio(file))) {
    return Result.err(new Error('The selected audio file could not be decoded by the browser'));
  }

  const filename = `${slot}_hitsound`;
  try {
    const dir = await getOpfsDir();
    const fileHandle = await dir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
    return Result.ok(`opfs:${filename}`);
  } catch (e) {
    console.warn('OPFS unavailable or failed, falling back to data URL', e);
    try {
      const dataUrl = await fileToDataUrl(file);
      localStorage.setItem(`chroviewer_hitsound_${slot}`, dataUrl);
      return Result.ok(`dataurl:${slot}`);
    } catch (e2) {
      return Result.err(new Error('Failed to save hitsound: ' + (e2 instanceof Error ? e2.message : String(e2))));
    }
  }
}

export async function loadCustomHitsound(slot: 'good' | 'bad'): Promise<ArrayBuffer | null> {
  const filename = `${slot}_hitsound`;
  try {
    const dir = await getOpfsDir();
    const fileHandle = await dir.getFileHandle(filename, { create: false });
    const file = await fileHandle.getFile();
    return await file.arrayBuffer();
  } catch {
    const dataUrl = localStorage.getItem(`chroviewer_hitsound_${slot}`);
    if (dataUrl) {
      return dataUrlToArrayBuffer(dataUrl);
    }
    return null;
  }
}

export async function clearCustomHitsound(slot: 'good' | 'bad'): Promise<Result<void, Error>> {
  const filename = `${slot}_hitsound`;
  const errors: string[] = [];

  try {
    const dir = await getOpfsDir();
    await dir.removeEntry(filename);
  } catch (e) {
    errors.push('OPFS: ' + (e instanceof Error ? e.message : String(e)));
  }

  try {
    localStorage.removeItem(`chroviewer_hitsound_${slot}`);
  } catch (e) {
    errors.push('localStorage: ' + (e instanceof Error ? e.message : String(e)));
  }

  if (errors.length > 0) {
    return Result.err(new Error(errors.join(', ')));
  }

  return Result.ok(undefined);
}
