import { ProcessedFile, DatasetConfig, FileMetadata } from '../types';
import { extractZip, extractTar, extractTarGz, extractRar } from './extractor';
import { processImage } from './imageProcessing';
import { encode } from 'gpt-tokenizer';

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'csv', 'json', 'jsonl', 'xml', 'html', 'css', 'js', 'jsx', 'ts', 'tsx', 
  'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'sh', 'bash', 
  'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'log', 'sql'
]);

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'
]);

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'avi', 'mov', 'webm']);

export async function processFiles(fileList: File[], config: DatasetConfig): Promise<ProcessedFile[]> {
  const results: ProcessedFile[] = [];

  for (const file of fileList) {
    const ext = extractExtension(file.name);
    
    if (ext === 'zip') {
      const extracted = await extractZip(file);
      results.push(...await processExtracted(extracted, file.lastModified, config));
      continue;
    } else if (ext === 'tar') {
      const extracted = extractTar(await file.arrayBuffer());
      results.push(...await processExtracted(extracted, file.lastModified, config));
      continue;
    } else if ((ext === 'gz' && file.name.toLowerCase().endsWith('.tar.gz')) || ext === 'tgz') {
      const extracted = await extractTarGz(file);
      results.push(...await processExtracted(extracted, file.lastModified, config));
      continue;
    } else if (ext === 'rar') {
      const extracted = await extractRar(file);
      results.push(...await processExtracted(extracted, file.lastModified, config));
      continue;
    }

    if (IMAGE_EXTENSIONS.has(ext)) {
       try {
           const { base64, metadata } = await processImage(file, config);
           metadata.format = 'image';
           results.push(createProcessedFile(file.name, file.webkitRelativePath || file.name, base64, file.size, ext, metadata, true));
       } catch (err) {
           console.warn(`Could not process image: ${file.name}`, err);
       }
       continue;
    }

    if (AUDIO_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext)) {
       try {
           const isVideo = VIDEO_EXTENSIONS.has(ext);
           const typeStr = isVideo ? `video/${ext === 'mp4' ? 'mp4' : 'webm'}` : `audio/${ext === 'mp3' ? 'mpeg' : 'wav'}`;
           const base64 = await readFileAsBase64(file);
           
           const metadata: FileMetadata = {
               format: isVideo ? 'video' : 'audio',
               lastModified: file.lastModified,
               lastModifiedDate: new Date(file.lastModified).toISOString()
           };

           // Optional to try and extract duration if it's not too heavy:
           try {
              const url = URL.createObjectURL(file);
              const mediaElement = isVideo ? document.createElement('video') : document.createElement('audio');
              mediaElement.src = url;
              await new Promise<void>((resolve) => {
                  mediaElement.onloadedmetadata = () => {
                     metadata.duration = mediaElement.duration;
                     resolve();
                  };
                  mediaElement.onerror = () => resolve();
                  // We also timeout just in case
                  setTimeout(resolve, 1000);
              });
              URL.revokeObjectURL(url);
           } catch(e) {}

           results.push(createProcessedFile(file.name, file.webkitRelativePath || file.name, base64, file.size, ext, metadata, false, !isVideo, isVideo));
       } catch (err) {
           console.warn(`Could not process media: ${file.name}`);
       }
       continue;
    }

    if (TEXT_EXTENSIONS.has(ext) || ext === '') {
      try {
         const content = await readFileAsText(file);
         const metadata: FileMetadata = {
            format: 'text',
            lastModified: file.lastModified,
            lastModifiedDate: new Date(file.lastModified).toISOString(),
            creationDate: new Date(file.lastModified).toISOString() // Fallback
         };
         results.push(createProcessedFile(file.name, file.webkitRelativePath || file.name, content, file.size, ext, metadata, false));
      } catch (err) {
         console.warn(`Could not read file: ${file.name}`);
      }
    }
  }

  return results;
}

function extractExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length === 1) return '';
  return parts.pop()!.toLowerCase();
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function readFileAsBase64(file: File): Promise<string> {
   const buffer = await file.arrayBuffer();
   return `data:${file.type || 'application/octet-stream'};base64,${arrayBufferToBase64(buffer)}`;
}

async function processExtracted(files: { name: string, content: Uint8Array }[], defaultModified: number, config: DatasetConfig): Promise<ProcessedFile[]> {
    const results: ProcessedFile[] = [];
    const textDecoder = new TextDecoder('utf-8');

    for (const f of files) {
       if (f.name.includes('.git/') || f.name.includes('node_modules/') || f.name.includes('__MACOSX/')) {
          continue;
       }

       const ext = extractExtension(f.name);
       
       if (IMAGE_EXTENSIONS.has(ext)) {
          try {
             const blob = new Blob([f.content]);
             const fileObj = new File([blob], f.name, { type: 'image/jpeg', lastModified: defaultModified });
             const { base64, metadata } = await processImage(fileObj, config);
             metadata.format = 'image';
             results.push(createProcessedFile(f.name.split('/').pop() || f.name, f.name, base64, f.content.length, ext, metadata, true));
          } catch(e) { console.warn(e) }
       } else if (AUDIO_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext)) {
          try {
             const isVideo = VIDEO_EXTENSIONS.has(ext);
             const type = isVideo ? 'video/mp4' : 'audio/mpeg'; // simplification
             const b64 = `data:${type};base64,${arrayBufferToBase64(f.content.buffer)}`;
             const metadata: FileMetadata = {
                 format: isVideo ? 'video' : 'audio',
                 lastModified: defaultModified,
                 lastModifiedDate: new Date(defaultModified).toISOString()
             };
             results.push(createProcessedFile(f.name.split('/').pop() || f.name, f.name, b64, f.content.length, ext, metadata, false, !isVideo, isVideo));
          } catch(e) { console.warn(e) }
       } else if (TEXT_EXTENSIONS.has(ext) || ext === '') {
          try {
             // Heuristic skip binary
             if (f.content.indexOf(0) !== -1) continue; 
             const textContent = textDecoder.decode(f.content);
             
             const metadata: FileMetadata = {
                format: 'text',
                lastModified: defaultModified,
                lastModifiedDate: new Date(defaultModified).toISOString()
             };
             results.push(createProcessedFile(f.name.split('/').pop() || f.name, f.name, textContent, f.content.length, ext, metadata, false));
          } catch(e) { console.warn(e) }
       }
    }
    return results;
}

function createProcessedFile(name: string, path: string, content: string, size: number, extension: string, metadata: any, isImage: boolean, isAudio: boolean = false, isVideo: boolean = false): ProcessedFile {
  let tokenCount: number | undefined = undefined;
  if (!isImage && !isAudio && !isVideo) {
    try {
      tokenCount = encode(content).length;
    } catch(e) {}
  }

  return {
    id: Math.random().toString(36).substring(2, 11),
    name,
    path,
    content,
    size,
    extension,
    metadata,
    isImage,
    isAudio,
    isVideo,
    tokenCount
  };
}
