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

export async function saveCustomHitsound(slot: 'good' | 'bad', file: File): Promise<string> {
  const filename = `${slot}_hitsound`;
  try {
    const dir = await getOpfsDir();
    const fileHandle = await dir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
    return `opfs:${filename}`;
  } catch (e) {
    console.warn('OPFS unavailable or failed, falling back to data URL', e);
    const dataUrl = await fileToDataUrl(file);
    localStorage.setItem(`chroviewer_hitsound_${slot}`, dataUrl);
    return `dataurl:${slot}`;
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

export async function clearCustomHitsound(slot: 'good' | 'bad'): Promise<void> {
  const filename = `${slot}_hitsound`;
  try {
    const dir = await getOpfsDir();
    await dir.removeEntry(filename);
  } catch {
    // blehhh
  }
  localStorage.removeItem(`chroviewer_hitsound_${slot}`);
}
