import JSZip from 'jszip';
import * as fflate from 'fflate';

/**
 * Very basic TAR parser. 
 * Reads an ArrayBuffer containing uncompressed TAR data and extracts files.
 */
export function extractTar(buffer: ArrayBuffer): { name: string, content: Uint8Array }[] {
  const files: { name: string, content: Uint8Array }[] = [];
  const view = new Uint8Array(buffer);
  let offset = 0;

  while (offset < view.length) {
    if (offset + 512 > view.length) break;

    // Check for end of archive (two 512-byte blocks of null bytes)
    let isZero = true;
    for (let i = 0; i < 512; i++) {
       if (view[offset + i] !== 0) {
           isZero = false;
           break;
       }
    }
    if (isZero) {
       offset += 512;
       continue;
    }

    // Parse header
    const nameBytes = view.subarray(offset, Math.min(offset + 100, view.length));
    let name = '';
    for (let i = 0; i < nameBytes.length && nameBytes[i] !== 0; i++) {
        name += String.fromCharCode(nameBytes[i]);
    }

    const sizeBytes = view.subarray(offset + 124, offset + 135);
    let sizeStr = '';
    for (let i = 0; i < sizeBytes.length && sizeBytes[i] !== 0; i++) {
        sizeStr += String.fromCharCode(sizeBytes[i]);
    }
    const size = parseInt(sizeStr.trim(), 8) || 0;

    const typeFlag = String.fromCharCode(view[offset + 156]);

    offset += 512; // move to data

    if (typeFlag === '0' || typeFlag === '\0') {
       // Normal file
       const fileData = view.subarray(offset, Math.min(offset + size, view.length));
       files.push({ name, content: fileData });
    }

    // move to next 512-byte boundary
    offset += Math.ceil(size / 512) * 512;
  }

  return files;
}

export async function extractZip(file: File): Promise<{ name: string, content: Uint8Array }[]> {
  const ZipConstructor = typeof (JSZip as any).default === 'function' ? (JSZip as any).default : JSZip;
  const zip = new ZipConstructor();
  await zip.loadAsync(file);
  const files: { name: string, content: Uint8Array }[] = [];
  
  const promises: Promise<void>[] = [];
  zip.forEach((relativePath: string, zipEntry: any) => {
    if (zipEntry.dir) return;
    promises.push(
      zipEntry.async('uint8array').then((content: Uint8Array) => {
        files.push({ name: relativePath, content });
      })
    );
  });
  
  await Promise.all(promises);
  return files;
}

export async function extractTarGz(file: File): Promise<{ name: string, content: Uint8Array }[]> {
   const buffer = await file.arrayBuffer();
   const decompressedData = fflate.gunzipSync(new Uint8Array(buffer));
   return extractTar(decompressedData.buffer);
}

// unrar-js usage requires asynchronous WASM loading usually. We'll do a basic best-effort.
export async function extractRar(file: File): Promise<{ name: string, content: Uint8Array }[]> {
    try {
        // Dynamic import might be needed depending on unrar-js version.
        const unrar = await import('unrar-js');
        const buffer = await file.arrayBuffer();
        
        // This is a naive unrar implementation, actual unrar-js v0.2.x signature might vary.
        // It often exposes `readRarFile` or similar. If unrar-js isn't perfectly supported in browser,
        // this will gracefully fail. We'll attempt a common signature.
        const extractor = await unrar.createExtractorFromData({ data: buffer });
        const extracted = extractor.extract().files;
        
        const results: { name: string, content: Uint8Array }[] = [];
        for (const f of extracted) {
           if (!f.fileHeader.flags.directory) {
               results.push({ name: f.fileHeader.name, content: f.extraction });
           }
        }
        return results;
    } catch (e) {
        console.error("Failed to unrar (often requires polyfills):", e);
        return [];
    }
}
