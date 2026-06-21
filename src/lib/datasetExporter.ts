import JSZip from 'jszip';
import { ProcessedFile, DatasetConfig } from '../types';
import { preprocessText } from './textProcessing';
import { preprocessNumericalData } from './numericalProcessing';

function getGlobalTags(config: DatasetConfig): string[] {
  return config.customTags ? config.customTags.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];
}

function prepareContent(file: ProcessedFile, config: DatasetConfig): string {
  const isMedia = file.isImage || file.isAudio || file.isVideo;
  if (isMedia) return file.content;
  let finalContent = file.content;
  if (file.extension === 'csv' && config.numNormalization !== 'none') {
    finalContent = preprocessNumericalData(finalContent, file.extension, config);
  }
  finalContent = preprocessText(finalContent, config);
  return finalContent;
}

function chunkContent(content: string, type: 'none' | 'line' | 'paragraph'): string[] {
  if (type === 'none') return [content];
  if (type === 'line') {
    return content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  }
  if (type === 'paragraph') {
    return content.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
  }
  return [content];
}

function jsonlLinesForFile(file: ProcessedFile, config: DatasetConfig): string[] {
  const lines: string[] = [];
  const globalTags = getGlobalTags(config);
  const isMedia = file.isImage || file.isAudio || file.isVideo;
  const finalContent = prepareContent(file, config);
  const chunks = isMedia ? [finalContent] : chunkContent(finalContent, config.chunking);

  for (const chunk of chunks) {
    const obj: any = {};
    if (file.isImage) obj.image = chunk;
    else if (file.isAudio) obj.audio = chunk;
    else if (file.isVideo) obj.video = chunk;
    else obj.text = chunk;

    if (config.includePath) obj.file = file.path;
    if (config.systemPrompt) obj.instruction = config.systemPrompt;
    if (file.category) obj.category = file.category;
    if (globalTags.length > 0) obj.tags = globalTags;
    if (file.metadata) obj.metadata = file.metadata;

    lines.push(JSON.stringify(obj));
  }
  return lines;
}

function escapeCsv(field: string): string {
  if (field.includes('"') || field.includes(',') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function csvHeader(config: DatasetConfig): string {
  const headers = ['content', 'type'];
  if (config.includePath) headers.push('file');
  if (config.systemPrompt) headers.push('instruction');
  headers.push('category');
  if (getGlobalTags(config).length > 0) headers.push('tags');
  headers.push('metadata');
  return headers.join(',');
}

function csvRowsForFile(file: ProcessedFile, config: DatasetConfig): string[] {
  const rows: string[] = [];
  const globalTags = getGlobalTags(config);
  const isMedia = file.isImage || file.isAudio || file.isVideo;
  const finalContent = prepareContent(file, config);
  const chunks = isMedia ? [finalContent] : chunkContent(finalContent, config.chunking);

  let mediaTypeStr = 'text';
  if (file.isImage) mediaTypeStr = 'image/base64';
  if (file.isAudio) mediaTypeStr = 'audio/base64';
  if (file.isVideo) mediaTypeStr = 'video/base64';

  for (const chunk of chunks) {
    const row = [escapeCsv(chunk), mediaTypeStr];
    if (config.includePath) row.push(escapeCsv(file.path));
    if (config.systemPrompt) row.push(escapeCsv(config.systemPrompt));
    row.push(escapeCsv(file.category || ''));
    if (globalTags.length > 0) row.push(escapeCsv(globalTags.join(';')));
    row.push(escapeCsv(JSON.stringify(file.metadata || {})));
    rows.push(row.join(','));
  }
  return rows;
}

function txtBlockForFile(file: ProcessedFile, config: DatasetConfig): string {
  const globalTags = getGlobalTags(config);

  if (file.isImage || file.isAudio || file.isVideo) {
    const mType = file.isImage ? 'IMAGE' : (file.isAudio ? 'AUDIO' : 'VIDEO');
    let block = `### ${mType} FILE: ${file.path} ###\n`;
    if (file.metadata) block += `### METADATA: ${JSON.stringify(file.metadata)} ###\n`;
    if (file.category) block += `### CATEGORY: ${file.category} ###\n`;
    block += `[Base64 omitted in TXT extract]\n`;
    return block;
  }

  let block = '';
  if (config.includePath) block += `### FILE: ${file.path} ###\n`;
  if (config.systemPrompt) block += `### INSTRUCTION: ${config.systemPrompt} ###\n`;
  if (file.category) block += `### CATEGORY: ${file.category} ###\n`;
  if (globalTags.length > 0) block += `### TAGS: ${globalTags.join(', ')} ###\n`;
  if (file.metadata) block += `### METADATA: ${JSON.stringify(file.metadata)} ###\n`;

  const finalContent = prepareContent(file, config);
  const chunks = chunkContent(finalContent, config.chunking);
  if (config.chunking !== 'none') {
    chunks.forEach((c, i) => {
      block += `[Chunk ${i + 1}]\n${c}\n`;
    });
  } else {
    block += `${finalContent}\n`;
  }
  return block;
}

// Structured, training-ready content for a SINGLE source file (one independent output file).
export function generateFileEntry(file: ProcessedFile, config: DatasetConfig): string {
  if (config.format === 'jsonl') return jsonlLinesForFile(file, config).join('\n');
  if (config.format === 'csv') return [csvHeader(config), ...csvRowsForFile(file, config)].join('\n');
  return txtBlockForFile(file, config);
}

// Combined output (all files concatenated into a single document). Kept for compatibility.
export function generateDataset(files: ProcessedFile[], config: DatasetConfig): string {
  if (config.format === 'jsonl') {
    const lines: string[] = [];
    for (const file of files) lines.push(...jsonlLinesForFile(file, config));
    return lines.join('\n');
  } else if (config.format === 'csv') {
    const rows = [csvHeader(config)];
    for (const file of files) rows.push(...csvRowsForFile(file, config));
    return rows.join('\n');
  } else {
    const blocks: string[] = [];
    for (const file of files) blocks.push(txtBlockForFile(file, config));
    return blocks.join('\n\n=========================================\n\n');
  }
}

function sanitizeSegment(seg: string): string {
  return seg.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
}

function uniquePath(used: Set<string>, outPath: string): string {
  if (!used.has(outPath)) {
    used.add(outPath);
    return outPath;
  }
  const dot = outPath.lastIndexOf('.');
  const base = dot > 0 ? outPath.slice(0, dot) : outPath;
  const ext = dot > 0 ? outPath.slice(dot) : '';
  let i = 2;
  let candidate = `${base}_${i}${ext}`;
  while (used.has(candidate)) {
    i++;
    candidate = `${base}_${i}${ext}`;
  }
  used.add(candidate);
  return candidate;
}

// Exports every source file as its OWN independent, training-ready file inside a
// `dataset/` folder (preserving each file's relative path). Returns a ZIP blob.
export async function generateDatasetZip(files: ProcessedFile[], config: DatasetConfig): Promise<Blob> {
  const ZipConstructor = typeof (JSZip as any).default === 'function' ? (JSZip as any).default : JSZip;
  const zip = new ZipConstructor();
  const root = zip.folder('dataset');
  const ext = config.format;
  const used = new Set<string>();

  for (const file of files) {
    const content = generateFileEntry(file, config);
    const rawPath = (file.path || file.name).replace(/^\/+/, '');
    const segments = rawPath.split(/[\\/]/).map(sanitizeSegment).filter(s => s.length > 0);
    let outPath = (segments.length > 0 ? segments.join('/') : sanitizeSegment(file.name)) + `.${ext}`;
    outPath = uniquePath(used, outPath);
    root?.file(outPath, content);
  }

  return await zip.generateAsync({ type: 'blob' });
}
