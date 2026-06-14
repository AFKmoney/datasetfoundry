import { cn } from '../lib/utils';
import { UploadCloud, FileType, FolderArchive, Github } from 'lucide-react';
import React, { useCallback, useState } from 'react';

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
  isLoading: boolean;
  onGithubImport?: (url: string) => void;
}

export function Dropzone({ onFilesSelected, isLoading, onGithubImport }: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');

  const handleGithubSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (githubUrl && onGithubImport) {
      onGithubImport(githubUrl);
      setGithubUrl('');
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (isLoading) return;

    if (e.dataTransfer.items) {
      const allFiles: File[] = [];
      const items = Array.from(e.dataTransfer.items).map(item => item.webkitGetAsEntry()).filter(Boolean) as FileSystemEntry[];
      
      const scanFiles = async (entry: FileSystemEntry, path = '') => {
        if (entry.isFile) {
          const fileEntry = entry as FileSystemFileEntry;
          return new Promise<void>((resolve, reject) => {
            fileEntry.file(f => {
              // Hack to attach relative path for UI
              try {
                Object.defineProperty(f, 'webkitRelativePath', {
                  value: path + f.name,
                  writable: false
                });
              } catch (e) {}
              allFiles.push(f);
              resolve();
            }, reject);
          });
        } else if (entry.isDirectory) {
          const dirEntry = entry as FileSystemDirectoryEntry;
          const reader = dirEntry.createReader();
          return new Promise<void>((resolve, reject) => {
            const readEntries = () => {
               reader.readEntries(async (entries) => {
                 if (entries.length === 0) {
                    resolve();
                 } else {
                    for (const e of entries) {
                      await scanFiles(e, path + entry.name + '/');
                    }
                    readEntries(); // Handle pagination of readEntries
                 }
               }, reject);
            };
            readEntries();
          });
        }
      };

      for (const item of items) {
         try {
           await scanFiles(item);
         } catch (err) {
           console.error("Error scanning item", err);
         }
      }
      onFilesSelected(allFiles);
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  }, [isLoading, onFilesSelected]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
    }
    // reset input so same file can be selected again
    e.target.value = '';
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center p-16 border border-dashed rounded-2xl transition-colors text-center cursor-pointer bg-white/[0.02] backdrop-blur-sm",
        isDragOver ? "border-white/30 bg-white/[0.05]" : "border-white/10 hover:border-white/20 hover:bg-white/[0.04]",
        isLoading && "opacity-50 pointer-events-none"
      )}
    >
      <div className="mb-6 relative">
        <div className="w-16 h-16 border border-white/20 rounded-full flex items-center justify-center group-hover:scale-105 transition-transform">
          <UploadCloud className="w-6 h-6 text-white/80" />
        </div>
      </div>
      <h3 className="text-xl font-light tracking-tight text-white mb-2 italic font-serif">Drop resources here</h3>
      <p className="text-sm text-white/40 mb-8 max-w-sm font-sans">
        Supports directories, archives, and text source files.
      </p>
      
      {onGithubImport && (
        <div className="w-full max-w-sm mx-auto mb-8 relative z-10" onClick={e => e.stopPropagation()}>
          <form onSubmit={handleGithubSubmit} className="relative flex items-center">
            <Github className="absolute left-4 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="e.g. https://github.com/reactjs or https://github.com/owner/repo1, https://github.com/owner/repo2"
              className="w-full bg-black/40 border border-white/10 rounded-full py-3 pl-12 pr-28 text-[12px] text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all placeholder:text-white/30"
            />
            <button 
              type="submit"
              disabled={isLoading || !githubUrl}
              className="absolute right-1.5 top-1.5 bottom-1.5 bg-white hover:bg-gray-200 text-black px-4 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Import
            </button>
          </form>
        </div>
      )}

      <div className="flex gap-4 z-10 relative">
        <label className="inline-flex items-center justify-center px-6 py-2 bg-white/[0.05] border border-white/10 rounded-full text-[11px] font-bold uppercase tracking-widest text-white hover:bg-white/[0.08] transition-colors cursor-pointer">
          <FileType className="w-3 h-3 mr-2" />
          Select Files
          <input 
            type="file" 
            className="hidden" 
            multiple 
            onChange={handleFileChange}
            disabled={isLoading}
          />
        </label>
        
        <label className="inline-flex items-center justify-center px-6 py-2 bg-white text-black border border-transparent rounded-full text-[11px] font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors cursor-pointer">
          <FolderArchive className="w-3 h-3 mr-2" />
          Select Folder
          <input 
             type="file" 
             className="hidden" 
             {...{webkitdirectory: "", directory: ""} as any}
             multiple 
             onChange={handleFileChange}
             disabled={isLoading}
          />
        </label>
      </div>
    </div>
  );
}
