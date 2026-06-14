export type DatasetFormat = 'jsonl' | 'csv' | 'txt';

export interface FileMetadata {
  lastModified?: number;
  lastModifiedDate?: string;
  creationDate?: string;
  exif?: Record<string, any>;
  dimensions?: { width: number; height: number };
  duration?: number;
  format?: 'audio' | 'video' | 'image' | 'text' | 'archive' | 'unknown';
}

export interface ProcessedFile {
  id: string;
  name: string;
  path: string;
  content: string; // The text content or base64 data
  size: number;
  extension: string;
  metadata?: FileMetadata;
  tags?: string[];
  category?: string;
  isImage?: boolean;
  isAudio?: boolean;
  isVideo?: boolean;
  tokenCount?: number;
}

export interface DatasetConfig {
  format: DatasetFormat;
  includePath: boolean;
  systemPrompt?: string;
  chunking: 'none' | 'line' | 'paragraph';
  customTags: string; // comma separated tags
  // Text Preprocessing
  textLowercase: boolean;
  textRemovePunctuation: boolean;
  textTokenization: 'none' | 'words';
  textRemoveStopwords: boolean;
  // Image Preprocessing
  imageResize: boolean;
  imageWidth: number;
  imageHeight: number;
  imageNormalize: boolean; // if true, normalize pixel values
  // Numerical Preprocessing
  numNormalization: 'none' | 'minmax' | 'zscore';
}

