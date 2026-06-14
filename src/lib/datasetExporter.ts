import { ProcessedFile, DatasetConfig } from '../types';
import { preprocessText } from './textProcessing';
import { preprocessNumericalData } from './numericalProcessing';

export function generateDataset(files: ProcessedFile[], config: DatasetConfig): string {
  if (config.format === 'jsonl') {
    return generateJsonl(files, config);
  } else if (config.format === 'csv') {
    return generateCsv(files, config);
  } else {
    return generateTxt(files, config);
  }
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

function generateJsonl(files: ProcessedFile[], config: DatasetConfig): string {
  const lines: string[] = [];
  const globalTags = config.customTags ? config.customTags.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];
  
  for (const file of files) {
    const isMedia = file.isImage || file.isAudio || file.isVideo;
    let finalContent = file.content;
    
    if (!isMedia) {
      if (file.extension === 'csv' && config.numNormalization !== 'none') {
        finalContent = preprocessNumericalData(finalContent, file.extension, config);
      }
      finalContent = preprocessText(finalContent, config);
    }
    
    const chunks = isMedia ? [finalContent] : chunkContent(finalContent, config.chunking);
    
    for (const chunk of chunks) {
      const obj: any = {};
      if (file.isImage) {
        obj.image = chunk;
      } else if (file.isAudio) {
        obj.audio = chunk;
      } else if (file.isVideo) {
        obj.video = chunk;
      } else {
        obj.text = chunk;
      }

      if (config.includePath) obj.file = file.path;
      if (config.systemPrompt) obj.instruction = config.systemPrompt;
      if (file.category) obj.category = file.category;
      if (globalTags.length > 0) obj.tags = globalTags;
      if (file.metadata) obj.metadata = file.metadata;
      
      lines.push(JSON.stringify(obj));
    }
  }
  
  return lines.join('\n');
}

function escapeCsv(field: string): string {
  if (field.includes('"') || field.includes(',') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function generateCsv(files: ProcessedFile[], config: DatasetConfig): string {
  const headers = ['content', 'type'];
  if (config.includePath) headers.push('file');
  if (config.systemPrompt) headers.push('instruction');
  headers.push('category');
  const globalTags = config.customTags ? config.customTags.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];
  if (globalTags.length > 0) headers.push('tags');
  headers.push('metadata');
  
  const rows = [headers.join(',')];
  
  for (const file of files) {
    const isMedia = file.isImage || file.isAudio || file.isVideo;
    let finalContent = file.content;

    if (!isMedia) {
      if (file.extension === 'csv' && config.numNormalization !== 'none') {
        finalContent = preprocessNumericalData(finalContent, file.extension, config);
      }
      finalContent = preprocessText(finalContent, config);
    }

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
  }
  
  return rows.join('\n');
}

function generateTxt(files: ProcessedFile[], config: DatasetConfig): string {
  const blocks: string[] = [];
  const globalTags = config.customTags ? config.customTags.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];
  
  for (const file of files) {
    if (file.isImage || file.isAudio || file.isVideo) {
      let mType = file.isImage ? 'IMAGE' : (file.isAudio ? 'AUDIO' : 'VIDEO');
      let block = `### ${mType} FILE: ${file.path} ###\n`;
      if (file.metadata) block += `### METADATA: ${JSON.stringify(file.metadata)} ###\n`;
      if (file.category) block += `### CATEGORY: ${file.category} ###\n`;
      block += `[Base64 omitted in TXT extract]\n`;
      blocks.push(block);
      continue;
    }

    let block = '';
    if (config.includePath) {
      block += `### FILE: ${file.path} ###\n`;
    }
    if (config.systemPrompt) {
      block += `### INSTRUCTION: ${config.systemPrompt} ###\n`;
    }
    if (file.category) {
      block += `### CATEGORY: ${file.category} ###\n`;
    }
    if (globalTags.length > 0) {
      block += `### TAGS: ${globalTags.join(', ')} ###\n`;
    }
    if (file.metadata) {
      block += `### METADATA: ${JSON.stringify(file.metadata)} ###\n`;
    }
    
    let finalContent = file.content;
    if (file.extension === 'csv' && config.numNormalization !== 'none') {
      finalContent = preprocessNumericalData(finalContent, file.extension, config);
    }
    finalContent = preprocessText(finalContent, config);

    const chunks = chunkContent(finalContent, config.chunking);
    if (config.chunking !== 'none') {
      chunks.forEach((c, i) => {
         block += `[Chunk ${i+1}]\n${c}\n`;
      });
    } else {
      block += `${finalContent}\n`;
    }
    
    blocks.push(block);
  }
  
  return blocks.join('\n\n=========================================\n\n');
}
