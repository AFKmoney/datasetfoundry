import React, { useState, useEffect, useRef } from 'react';
import { Database, Download, FileText, Settings, Trash2, Layers, UploadCloud, AlertCircle, Eye, FolderPlus, X, Folder, LayoutGrid, CheckSquare, Search, Copy } from 'lucide-react';
import { Dropzone } from './components/Dropzone';
import { processFiles } from './lib/fileProcessing';
import { generateDatasetZip } from './lib/datasetExporter';
import { DatasetConfig, ProcessedFile } from './types';
import localforage from 'localforage';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';

const getAutoCategory = (file: ProcessedFile): string => {
  if (file.isImage) return 'Images';
  if (file.isAudio) return 'Audio';
  if (file.isVideo) return 'Videos';
  
  const ext = file.extension.toLowerCase();
  
  if (['js', 'jsx', 'ts', 'tsx', 'vue', 'svelte'].includes(ext)) return 'Web/Frontend Code';
  if (['py', 'ipynb'].includes(ext)) return 'Python Scripts';
  if (['java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'php', 'rb', 'swift', 'kt'].includes(ext)) return 'Backend/Compiled Code';
  if (['html', 'htm', 'css', 'scss', 'less', 'styl'].includes(ext)) return 'Markup & Styles';
  if (['sh', 'bat', 'ps1', 'cmd'].includes(ext)) return 'Shell & Scripts';
  if (['csv', 'tsv', 'xls', 'xlsx'].includes(ext)) return 'Tabular Data';
  if (['json', 'jsonl', 'yaml', 'yml', 'xml', 'toml', 'ini'].includes(ext)) return 'Structured/Config Data';
  if (['sql', 'db', 'sqlite'].includes(ext)) return 'Databases';
  if (['txt', 'md', 'mdx', 'rtf'].includes(ext)) return 'Text/Markdown';
  if (['pdf'].includes(ext)) return 'PDF Documents';
  if (['doc', 'docx', 'ppt', 'pptx'].includes(ext)) return 'Office Documents';
  if (['env', 'gitignore', 'dockerfile'].includes(ext) || file.name.toLowerCase().includes('.env')) return 'Environment Config';
  
  return 'Uncategorized';
};

export default function App() {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<{ url: string; filename: string } | null>(null);
  
  const [currentView, setCurrentView] = useState<'sources' | 'explorer' | 'pipeline'>('sources');
  const [categories, setCategories] = useState<string[]>(['Train', 'Validation', 'Test']);
  const [activeTab, setActiveTab] = useState<string>('All');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [previewFile, setPreviewFile] = useState<ProcessedFile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, file: ProcessedFile, mode?: 'main' | 'move' } | null>(null);
  
  const [config, setConfig] = useState<DatasetConfig>({
    format: 'jsonl',
    includePath: true,
    chunking: 'none',
    systemPrompt: '',
    customTags: '',
    textLowercase: false,
    textRemovePunctuation: false,
    textTokenization: 'none',
    textRemoveStopwords: false,
    imageResize: true,
    imageWidth: 256,
    imageHeight: 256,
    imageNormalize: false,
    numNormalization: 'none'
  });

  const downloadRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const loadState = async () => {
      try {
        const storedFiles = await localforage.getItem<ProcessedFile[]>('dataset-files');
        if (storedFiles && storedFiles.length > 0) setFiles(storedFiles);
        const storedCategories = await localforage.getItem<string[]>('dataset-categories');
        if (storedCategories && storedCategories.length > 0) setCategories(storedCategories);
        const storedConfig = await localforage.getItem<DatasetConfig>('dataset-config');
        if (storedConfig) setConfig(storedConfig);
      } catch (err) {
        console.error("Failed to load state", err);
      }
    };
    loadState();
  }, []);

  useEffect(() => {
    if (files.length > 0) localforage.setItem('dataset-files', files).catch(console.error);
    else localforage.removeItem('dataset-files').catch(console.error);
  }, [files]);

  useEffect(() => {
    localforage.setItem('dataset-categories', categories).catch(console.error);
  }, [categories]);

  useEffect(() => {
    localforage.setItem('dataset-config', config).catch(console.error);
  }, [config]);

  useEffect(() => {
    // Handle manual clicks to close context menu
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  useEffect(() => {
    if (downloadUrl && downloadRef.current) {
        try {
            downloadRef.current.click();
        } catch (e) {
            console.error("Auto download failed:", e);
        }
    }
  }, [downloadUrl]);

  const handleFilesSelected = async (newFiles: File[]) => {
    setIsProcessing(true);
    setErrorMsg('');
    try {
      if (newFiles.length === 0) {
        setErrorMsg('No files selected or extracted.');
        setIsProcessing(false);
        return;
      }
      const processed = await processFiles(newFiles, config);
      if (processed.length === 0) {
         setErrorMsg('No valid files found or all failed to process.');
      } else {
         const processedWithCategories = processed.map(f => ({ ...f, category: getAutoCategory(f) }));
         setFiles(prev => [...prev, ...processedWithCategories]);
         setCategories(prev => {
            const newCats = new Set(prev);
            processedWithCategories.forEach(f => newCats.add(f.category!));
            return Array.from(newCats);
         });
         if (currentView === 'sources') {
           setCurrentView('explorer');
         }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Error processing files: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGithubImport = async (inputStr: string) => {
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const urls = inputStr.split(/[\s,]+/).map(u => u.trim()).filter(u => u.length > 0);
      let reposToFetch: string[] = [];

      for (const url of urls) {
        const isRepo = /github\.com\/[^\/]+\/[^\/]+/.test(url);
        if (isRepo) {
          reposToFetch.push(url);
        } else {
          const res = await fetch('/api/github-scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.urls) {
               reposToFetch.push(...data.urls);
            }
          }
        }
      }

      if (reposToFetch.length === 0) {
         setErrorMsg("No valid GitHub repositories found to import.");
         return;
      }

      let newFiles: File[] = [];
      let fetchErrors: string[] = [];

      const fetchPromises = reposToFetch.map(async (url) => {
         const res = await fetch('/api/github', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ url })
         });
         if (!res.ok) {
            const { error } = await res.json().catch(() => ({ error: 'Failed to fetch repo' }));
            throw new Error(`${url}: ${error || `Failed with status ${res.status}`}`);
         }
         const blob = await res.blob();
         const match = url.match(/github\.com\/[^\/]+\/([^\/]+)/);
         const repoName = match ? match[1] : 'github-repo';
         return new File([blob], `${repoName}.zip`, { type: 'application/zip', lastModified: Date.now() });
      });

      const results = await Promise.allSettled(fetchPromises);
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
           newFiles.push(result.value);
        } else {
           fetchErrors.push(result.reason.message);
        }
      }

      if (newFiles.length > 0) {
        const processed = await processFiles(newFiles, config);
        if (processed.length === 0) {
           setErrorMsg('No valid files found or all failed to process in imported repos. ' + fetchErrors.join('\n'));
        } else {
           const processedWithCategories = processed.map(f => ({ ...f, category: getAutoCategory(f) }));
           setFiles(prev => [...prev, ...processedWithCategories]);
           setCategories(prev => {
              const newCats = new Set(prev);
              processedWithCategories.forEach(f => newCats.add(f.category!));
              return Array.from(newCats);
           });
           if (currentView === 'sources') setCurrentView('explorer');
           if (fetchErrors.length > 0) {
             setErrorMsg(`Some repositories failed to import: ${fetchErrors.join(', ')}`);
           }
        }
      } else {
         setErrorMsg(`Failed to import repositories: ${fetchErrors.join('\n')}`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Error fetching GitHub repo(s): ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const cloneFile = (file: ProcessedFile) => {
    const cloned = { ...file, id: Math.random().toString(36).substring(2, 11), name: `Copy of ${file.name}` };
    setFiles(prev => [...prev, cloned]);
  };

  const downloadSingleFile = (file: ProcessedFile) => {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const autoSortFiles = () => {
    const updatedFiles = files.map(f => ({ ...f, category: getAutoCategory(f) }));
    setFiles(updatedFiles);
    
    setCategories(prev => {
       const newCats = new Set(prev);
       updatedFiles.forEach(f => {
           if (f.category) newCats.add(f.category);
       });
       return Array.from(newCats);
    });
  };

  const clearAll = () => {
    setFiles([]);
    if (downloadUrl) {
       URL.revokeObjectURL(downloadUrl.url);
       setDownloadUrl(null);
    }
    setCurrentView('sources');
  };

  const handleExport = async () => {
    try {
      const blob = await generateDatasetZip(files, config);
      const url = URL.createObjectURL(blob);
      const filename = `dataset-${new Date().toISOString().split('T')[0]}.zip`;
      setDownloadUrl({ url, filename });
    } catch (e: any) {
      console.error("Export error:", e);
      setErrorMsg(`Failed to export dataset: ${e.message || 'Error generating payload'}`);
    }
  };

  const handleAddCategory = () => {
    if (newCategoryName.trim() && !categories.includes(newCategoryName.trim())) {
      setCategories([...categories, newCategoryName.trim()]);
      setNewCategoryName('');
    }
  };

  const updateFileCategory = (id: string, category: string) => {
    setFiles(files.map(f => f.id === id ? { ...f, category } : f));
  };

  const bulkAssignCategory = (category: string) => {
    const idsToUpdate = filteredFiles.map(f => f.id);
    setFiles(files.map(f => idsToUpdate.includes(f.id) ? { ...f, category } : f));
  };

  const applyPreset = (presetName: string) => {
    switch (presetName) {
      case 'code':
        setConfig({
          ...config, format: 'jsonl', chunking: 'none',
          textLowercase: false, textRemovePunctuation: false, textTokenization: 'none', textRemoveStopwords: false,
          imageResize: false, imageNormalize: false, numNormalization: 'none', includePath: true
        });
        break;
      case 'nlp':
        setConfig({
          ...config, format: 'jsonl', chunking: 'paragraph',
          textLowercase: true, textRemovePunctuation: true, textTokenization: 'none', textRemoveStopwords: true,
          imageResize: false, imageNormalize: false, numNormalization: 'none', includePath: false
        });
        break;
      case 'vision':
         setConfig({
          ...config, format: 'jsonl', chunking: 'none',
          textLowercase: false, textRemovePunctuation: false, textTokenization: 'none', textRemoveStopwords: false,
          imageResize: true, imageNormalize: true, numNormalization: 'none', includePath: true
        });
        break;
      case 'tabular':
         setConfig({
          ...config, format: 'csv', chunking: 'none',
          textLowercase: false, textRemovePunctuation: false, textTokenization: 'none', textRemoveStopwords: false,
          imageResize: false, imageNormalize: false, numNormalization: 'zscore', includePath: false
        });
        break;
      default:
         break;
    }
  };

  const filteredFiles = files.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.path.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    
    if (activeTab === 'All') return true;
    if (activeTab === 'Uncategorized') return !f.category;
    return f.category === activeTab;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalFiles = files.length;
  const totalStorage = formatFileSize(files.reduce((a, f) => a + f.size, 0));
  const totalTokens = files.reduce((a, f) => a + (f.tokenCount || 0), 0);
  const formattedTokens = new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(totalTokens);

  const typeDistributionData = React.useMemo(() => {
    const counts = files.reduce((acc, file) => {
      const type = file.category || 'Uncategorized';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [files]);
  
  const COLORS = ['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#60a5fa', '#a78bfa', '#f87171'];

  return (
    <div className="flex bg-[#050505] min-h-screen text-gray-200 font-sans selection:bg-white/20 selection:text-white">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-white/5 bg-[#050505] fixed h-full flex flex-col z-20">
          <div className="p-6 border-b border-white/5 flex items-center justify-center lg:justify-start gap-4">
            <div className="w-8 h-8 rounded bg-white flex items-center justify-center text-black font-bold text-xs italic shadow-[0_0_15px_rgba(255,255,255,0.2)]">DS</div>
            <h1 className="text-[13px] font-semibold tracking-widest uppercase text-white/90">datasetfoundry</h1>
          </div>
          
          <nav className="flex-1 p-5 space-y-3">
             <button onClick={() => setCurrentView('sources')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-[11px] tracking-widest uppercase font-bold transition-all ${currentView === 'sources' ? 'bg-white/10 text-white shadow-inner' : 'text-white/40 hover:text-white hover:bg-white/[0.03]'}`}>
               <UploadCloud className="w-4 h-4"/> Sources
             </button>
             <button onClick={() => setCurrentView('explorer')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-[11px] tracking-widest uppercase font-bold transition-all ${currentView === 'explorer' ? 'bg-white/10 text-white shadow-inner' : 'text-white/40 hover:text-white hover:bg-white/[0.03]'}`}>
               <Layers className="w-4 h-4"/> VFS Explorer
               {files.length > 0 && <span className="ml-auto bg-white/10 border border-white/10 text-white px-2 py-0.5 rounded text-[9px]">{files.length}</span>}
             </button>
             <button onClick={() => setCurrentView('pipeline')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-[11px] tracking-widest uppercase font-bold transition-all ${currentView === 'pipeline' ? 'bg-white/10 text-white shadow-inner' : 'text-white/40 hover:text-white hover:bg-white/[0.03]'}`}>
               <Settings className="w-4 h-4"/> Pipeline
             </button>
          </nav>

          {files.length > 0 && (
              <div className="p-6 border-t border-white/5 bg-white/[0.02]">
                 <div className="flex justify-between items-center mb-5">
                   <span className="text-[9px] uppercase font-mono text-white/40 tracking-widest">Total Weight</span>
                   <span className="text-[11px] font-mono text-white/80">{formatFileSize(files.reduce((a,f)=>a+f.size,0))}</span>
                 </div>
                  <button onClick={handleExport} className="w-full justify-center flex items-center bg-white text-black py-3.5 rounded-xl uppercase text-[10px] font-bold tracking-[0.15em] hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                    <Download className="w-3 h-3 mr-2" /> Export as ZIP
                  </button>
                 {downloadUrl && (
                    <a ref={downloadRef} href={downloadUrl.url} download={downloadUrl.filename} className="block mt-4 text-center text-[10px] text-emerald-400 font-mono underline hover:text-emerald-300">
                        Manual Download Link
                    </a>
                 )}
              </div>
          )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-64 p-8 xl:p-12 min-h-screen relative flex flex-col">
          {errorMsg && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-900/50 border border-red-500/50 rounded-xl backdrop-blur-md text-red-200 text-sm flex items-center gap-3 z-50 shadow-2xl">
              <AlertCircle className="w-4 h-4" />
              {errorMsg}
              <button onClick={() => setErrorMsg('')} className="ml-4 text-red-400 hover:text-white">&times;</button>
            </div>
          )}

          <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col relative z-10">
            <AnimatePresence mode="wait">
            {/* View: SOURCES */}
            {currentView === 'sources' && (
              <motion.div 
                key="sources"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 flex flex-col"
              >
                <div className="mb-10 text-center">
                  <h2 className="text-3xl font-light tracking-tight text-white mb-3">Initialize Dataset</h2>
                  <p className="text-white/40 text-sm font-mono uppercase tracking-widest">Import files, archives, or repositories</p>
                </div>
                
                <section className="bg-white/[0.02] p-10 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden flex-1 shadow-2xl max-w-4xl mx-auto w-full">
                  <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-white/5 to-transparent blur-3xl"></div>
                  </div>
                  <div className="relative z-10">
                    <Dropzone onFilesSelected={handleFilesSelected} isLoading={isProcessing} onGithubImport={handleGithubImport} />
                  </div>
                  
                  {isProcessing && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-6 p-4 rounded-xl bg-white/[0.03] border border-white/5 text-white/60 text-[11px] uppercase tracking-widest flex items-center justify-center relative z-10"
                    >
                      <Layers className="w-4 h-4 mr-3 animate-pulse text-indigo-400" />
                      Processing inputs...
                    </motion.div>
                  )}
                </section>
              </motion.div>
            )}

            {/* View: EXPLORER (VFS) */}
            {currentView === 'explorer' && (
              <motion.div 
                key="explorer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 flex flex-col h-[calc(100vh-6rem)]"
              >
                <div className="flex justify-between items-end mb-6">
                   <div>
                     <h2 className="text-2xl font-light text-white mb-2 tracking-tight">Virtual File System</h2>
                     <p className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Manage, categorize, and preview dataset items</p>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="relative">
                        <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                           type="text" 
                           placeholder="Search files..." 
                           value={searchQuery}
                           onChange={e => setSearchQuery(e.target.value)}
                           className="bg-black border border-white/10 rounded-full py-2 pl-9 pr-4 text-[11px] text-white/80 focus:border-white/30 outline-none w-64 placeholder-white/20"
                        />
                      </div>
                      <button onClick={autoSortFiles} className="px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-[10px] uppercase font-bold tracking-widest hover:bg-indigo-500/20 transition-colors">
                        Auto Sort
                      </button>
                      <button onClick={clearAll} className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-[10px] uppercase font-bold tracking-widest hover:bg-red-500/20 transition-colors">
                        Clear All
                      </button>
                   </div>
                </div>

                {/* Summary Stats Panel */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6 shrink-0">
                   <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 flex flex-col justify-center relative overflow-hidden shadow-xl">
                     <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 blur-2xl rounded-full"></div>
                     <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold mb-2 z-10">Total Files</span>
                     <span className="text-4xl font-light text-white tracking-tight z-10">{totalFiles}</span>
                   </div>
                   <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 flex flex-col justify-center relative overflow-hidden shadow-xl">
                     <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 blur-2xl rounded-full"></div>
                     <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold mb-2 z-10">Storage Usage</span>
                     <span className="text-4xl font-light text-white tracking-tight z-10">{totalStorage}</span>
                   </div>
                   <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 flex flex-col justify-center relative overflow-hidden shadow-xl">
                     <div className="absolute -right-4 -top-4 w-24 h-24 bg-pink-500/10 blur-2xl rounded-full"></div>
                     <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold mb-2 z-10">Est. Tokens</span>
                     <span className="text-4xl font-light text-white tracking-tight z-10">{formattedTokens}</span>
                   </div>
                   <div className="bg-white/[0.02] border border-white/5 rounded-2xl px-6 py-4 flex items-center shadow-xl h-[120px] md:col-span-1">
                     {typeDistributionData.length > 0 ? (
                       <>
                        <div className="w-24 h-24 shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={typeDistributionData}
                                cx="50%"
                                cy="50%"
                                innerRadius={25}
                                outerRadius={40}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                              >
                                {typeDistributionData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <RechartsTooltip 
                                contentStyle={{ backgroundColor: '#111', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px', color: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                                itemStyle={{ color: '#fff' }}
                                cursor={false}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex-1 flex flex-col justify-center gap-1.5 pl-6 min-w-0">
                          <div className="text-[9px] uppercase tracking-widest text-white/40 mb-1">Distribution</div>
                          {typeDistributionData.slice(0, 3).map((entry, index) => (
                             <div key={entry.name} className="flex items-center gap-2">
                               <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                               <div className="flex-1 text-[10px] text-white/70 truncate">{entry.name}</div>
                               <div className="text-[10px] font-mono text-white/40 shrink-0">{entry.value}</div>
                             </div>
                          ))}
                        </div>
                       </>
                     ) : (
                        <div className="w-full flex items-center justify-center text-[11px] text-white/30 uppercase tracking-widest">No data available</div>
                     )}
                   </div>
                </div>

                <div className="flex flex-1 min-h-0 bg-white/[0.01] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                   {/* Left Category Sidebar */}
                   <div className="w-48 xl:w-56 bg-black/40 border-r border-white/5 p-4 flex flex-col">
                      <h3 className="text-[9px] uppercase tracking-[0.2em] font-bold text-white/30 mb-4 px-2">Folders</h3>
                      <div className="space-y-1 flex-1 overflow-y-auto custom-scrollbar">
                         <button 
                           onClick={() => setActiveTab('All')}
                           className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[11px] font-medium transition-colors ${activeTab === 'All' ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5'}`}
                         >
                           <span className="flex items-center"><Folder className="w-3.5 h-3.5 mr-2 opacity-70" /> All Files</span>
                           <span className="text-[9px] text-white/30">{files.length}</span>
                         </button>
                         <button 
                           onClick={() => setActiveTab('Uncategorized')}
                           className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[11px] font-medium transition-colors mt-1 ${activeTab === 'Uncategorized' ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5'}`}
                         >
                           <span className="flex items-center"><Layers className="w-3.5 h-3.5 mr-2 opacity-70" /> Uncategorized</span>
                           <span className="text-[9px] text-white/30">{files.filter(f => !f.category).length}</span>
                         </button>
                         
                         <div className="my-3 border-t border-white/5 mx-2"></div>
                         
                         {categories.map(cat => {
                           const count = files.filter(f => f.category === cat).length;
                           return (
                             <button 
                               key={cat}
                               onClick={() => setActiveTab(cat)}
                               className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[11px] font-medium transition-colors mt-1 ${activeTab === cat ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5'}`}
                             >
                               <span className="flex items-center"><Folder className="w-3.5 h-3.5 mr-2 text-indigo-400" /> {cat}</span>
                               <span className="text-[9px] text-white/30">{count}</span>
                             </button>
                           );
                         })}
                      </div>
                      <div className="pt-4 border-t border-white/5 mt-auto">
                        <div className="flex bg-black border border-white/10 rounded-lg p-1">
                          <input 
                            value={newCategoryName} 
                            onChange={e => setNewCategoryName(e.target.value)} 
                            onKeyDown={e => {
                               if (e.key === 'Enter') {
                                 e.preventDefault();
                                 handleAddCategory();
                               }
                            }}
                            placeholder="New Folder..."
                            className="bg-transparent text-[10px] outline-none text-white px-2 w-full placeholder-white/30"
                          />
                          <button type="button" onClick={(e) => { e.preventDefault(); handleAddCategory(); }} disabled={!newCategoryName.trim()} className="text-white/60 hover:text-white p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-50">
                            <FolderPlus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                   </div>

                   {/* Main VFS Content */}
                   <div className="flex-1 flex flex-col min-h-0 bg-[#070707]">
                       <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                          <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">
                             {activeTab} Collection <span className="text-white/30 ml-2 font-mono">({filteredFiles.length})</span>
                          </span>
                          <div className="flex items-center gap-3">
                             <select 
                               onChange={(e) => {
                                 if (e.target.value) {
                                   bulkAssignCategory(e.target.value);
                                   e.target.value = ''; // reset
                                 }
                               }}
                               className="bg-black border border-white/10 text-white/70 text-[10px] uppercase font-bold tracking-widest rounded-lg px-3 py-1.5 outline-none focus:border-white/30 cursor-pointer"
                             >
                                <option value="">Bulk Assign...</option>
                                {categories.map(c => <option key={`bulk-${c}`} value={c}>Move to {c}</option>)}
                             </select>
                          </div>
                       </div>
                       
                       <div className="flex-1 overflow-y-auto custom-scrollbar">
                         {filteredFiles.length === 0 ? (
                           <div className="h-full flex flex-col items-center justify-center text-white/20">
                             <LayoutGrid className="w-12 h-12 mb-4 opacity-50" />
                             <p className="text-[11px] uppercase tracking-widest font-bold">Directory Empty</p>
                           </div>
                         ) : (
                           <table className="min-w-full divide-y divide-white/5 text-left">
                             <thead className="bg-[#050505] sticky top-0 z-10 shadow-sm border-b border-white/5">
                               <tr>
                                 <th className="px-6 py-4 text-[9px] font-bold text-white/40 uppercase tracking-[0.15em]">File</th>
                                 <th className="px-6 py-4 text-[9px] font-bold text-white/40 uppercase tracking-[0.15em] w-48">Category</th>
                                 <th className="px-6 py-4 text-[9px] font-bold text-white/40 uppercase tracking-[0.15em] w-32">Size</th>
                                 <th className="px-6 py-4 text-[9px] font-bold text-white/40 uppercase tracking-[0.15em] w-32">Tokens</th>
                                 <th className="px-6 py-4 text-[9px] font-bold text-white/40 uppercase tracking-[0.15em] text-right w-24">Actions</th>
                               </tr>
                             </thead>
                               <tbody className="divide-y divide-white/5">
                               <AnimatePresence>
                               {filteredFiles.map((file, idx) => (
                                 <motion.tr 
                                   initial={{ opacity: 0, y: 10 }}
                                   animate={{ opacity: 1, y: 0, transition: { delay: Math.min(idx * 0.05, 0.5) } }}
                                   exit={{ opacity: 0 }}
                                   key={file.id} 
                                   className="hover:bg-white/[0.03] group transition-colors cursor-context-menu"
                                   onContextMenu={(e: React.MouseEvent) => {
                                     e.preventDefault();
                                     setContextMenu({ x: e.pageX, y: e.pageY, file });
                                   }}
                                 >
                                  <td className="px-6 py-3 whitespace-nowrap">
                                     <div className="flex items-center">
                                       {file.isImage ? <div className="w-5 h-5 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-[8px] font-bold mr-3 border border-blue-500/30">IMG</div> :
                                        file.isAudio ? <div className="w-5 h-5 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center text-[8px] font-bold mr-3 border border-purple-500/30">AUD</div> :
                                        file.isVideo ? <div className="w-5 h-5 rounded bg-pink-500/20 text-pink-400 flex items-center justify-center text-[8px] font-bold mr-3 border border-pink-500/30">VID</div> :
                                        <div className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[8px] font-bold mr-3 border border-emerald-500/30">TXT</div>
                                       }
                                       <div>
                                         <div className="text-[12px] font-medium text-white/90 truncate max-w-[200px] xl:max-w-sm" title={file.name}>
                                           {file.name}
                                         </div>
                                         <div className="text-[9px] font-mono text-white/30 truncate max-w-[200px] xl:max-w-sm mt-0.5">
                                           {file.path}
                                         </div>
                                       </div>
                                     </div>
                                   </td>
                                   <td className="px-6 py-3 whitespace-nowrap">
                                     <select
                                       value={file.category || ''}
                                       onChange={e => updateFileCategory(file.id, e.target.value)}
                                       className={`bg-black border text-[10px] rounded px-2 py-1 outline-none text-white/80 cursor-pointer max-w-[140px] truncate ${file.category ? 'border-indigo-500/30 bg-indigo-500/10' : 'border-white/10 hover:border-white/30'}`}
                                     >
                                       <option value="">Uncategorized</option>
                                       {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                     </select>
                                   </td>
                                   <td className="px-6 py-3 whitespace-nowrap text-[10px] font-mono text-white/40">
                                     {formatFileSize(file.size)}
                                   </td>
                                   <td className="px-6 py-3 whitespace-nowrap text-[10px] font-mono text-white/40">
                                     {file.tokenCount ? new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(file.tokenCount) : '-'}
                                   </td>
                                   <td className="px-6 py-3 whitespace-nowrap text-right">
                                     <button
                                       onClick={() => setPreviewFile(file)}
                                       className="text-white/30 hover:text-white transition-colors mr-3 p-1 rounded hover:bg-white/10"
                                       title="Preview File"
                                     >
                                       <Eye className="w-4 h-4" />
                                     </button>
                                     <button 
                                       onClick={() => removeFile(file.id)}
                                       className="text-white/30 hover:text-red-400 transition-colors p-1 rounded hover:bg-white/10"
                                     >
                                       <Trash2 className="w-4 h-4" />
                                     </button>
                                   </td>
                                 </motion.tr>
                               ))}
                               </AnimatePresence>
                             </tbody>
                           </table>
                         )}
                       </div>
                   </div>
                </div>
              </motion.div>
            )}

            {/* View: PIPELINE CONFIG */}
            {currentView === 'pipeline' && (
              <motion.div 
                key="pipeline"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 max-w-4xl mx-auto w-full"
              >
                <div className="mb-10 text-center">
                  <h2 className="text-3xl font-light tracking-tight text-white mb-3">Pipeline Configuration</h2>
                  <p className="text-white/40 text-sm font-mono uppercase tracking-widest mb-8">Tune export parameters and processing rules</p>
                  
                  <div className="flex flex-wrap justify-center gap-3">
                     <button onClick={() => applyPreset('code')} className="px-4 py-2 rounded-full border border-indigo-500/30 text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 text-[10px] uppercase tracking-widest font-bold transition-colors">Code Fine-tuning</button>
                     <button onClick={() => applyPreset('nlp')} className="px-4 py-2 rounded-full border border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 text-[10px] uppercase tracking-widest font-bold transition-colors">NLP / Text</button>
                     <button onClick={() => applyPreset('vision')} className="px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 text-[10px] uppercase tracking-widest font-bold transition-colors">Vision Models</button>
                     <button onClick={() => applyPreset('tabular')} className="px-4 py-2 rounded-full border border-orange-500/30 text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 text-[10px] uppercase tracking-widest font-bold transition-colors">Tabular ML Data</button>
                  </div>
                </div>

                <div className="bg-white/[0.02] p-8 md:p-12 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-sm space-y-12">
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div>
                        <h3 className="text-[10px] uppercase text-white/40 tracking-[0.15em] font-bold mb-4 border-b border-white/10 pb-2">Global Settings</h3>
                        <div className="space-y-5">
                          <div>
                            <label className="block text-[11px] font-medium text-white/70 mb-2 uppercase tracking-wide">
                              Output Format
                            </label>
                            <select
                              value={config.format}
                              onChange={(e) => setConfig({ ...config, format: e.target.value as DatasetConfig['format'] })}
                              className="w-full px-4 py-3 text-[12px] bg-black border border-white/10 text-white focus:outline-none focus:border-white/30 rounded-xl"
                            >
                              <option value="jsonl">JSON Lines (.jsonl)</option>
                              <option value="csv">Comma-Separated (.csv)</option>
                              <option value="txt">Raw Text Block (.txt)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-white/70 mb-2 uppercase tracking-wide">
                              Chunking Strategy
                            </label>
                            <select
                              value={config.chunking}
                              onChange={(e) => setConfig({ ...config, chunking: e.target.value as DatasetConfig['chunking'] })}
                              className="w-full px-4 py-3 text-[12px] bg-black border border-white/10 text-white focus:outline-none focus:border-white/30 rounded-xl"
                            >
                              <option value="none">No Chunking (Whole file)</option>
                              <option value="paragraph">Split by Paragraph</option>
                              <option value="line">Split by Line</option>
                            </select>
                          </div>
                        </div>
                     </div>

                     <div>
                        <h3 className="text-[10px] uppercase text-white/40 tracking-[0.15em] font-bold mb-4 border-b border-white/10 pb-2">Text Manipulation</h3>
                        <div className="space-y-4">
                           <label className="flex items-center gap-3 cursor-pointer group">
                             <input
                               type="checkbox"
                               checked={config.textLowercase}
                               onChange={(e) => setConfig({ ...config, textLowercase: e.target.checked })}
                               className="w-5 h-5 rounded bg-black border-white/20 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
                             />
                             <span className="text-[12px] text-white/70 group-hover:text-white transition-colors">Force Lowercase</span>
                           </label>
                           <label className="flex items-center gap-3 cursor-pointer group">
                             <input
                               type="checkbox"
                               checked={config.textRemovePunctuation}
                               onChange={(e) => setConfig({ ...config, textRemovePunctuation: e.target.checked })}
                               className="w-5 h-5 rounded bg-black border-white/20 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
                             />
                             <span className="text-[12px] text-white/70 group-hover:text-white transition-colors">Strip Punctuation</span>
                           </label>
                           <label className="flex items-center gap-3 cursor-pointer group">
                             <input
                               type="checkbox"
                               checked={config.textRemoveStopwords}
                               onChange={(e) => setConfig({ ...config, textRemoveStopwords: e.target.checked })}
                               className="w-5 h-5 rounded bg-black border-white/20 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
                             />
                             <span className="text-[12px] text-white/70 group-hover:text-white transition-colors">Remove Stopwords</span>
                           </label>
                           <label className="flex items-center gap-3 cursor-pointer group">
                             <input
                               type="checkbox"
                               checked={config.textTokenization === 'words'}
                               onChange={(e) => setConfig({ ...config, textTokenization: e.target.checked ? 'words' : 'none' })}
                               className="w-5 h-5 rounded bg-black border-white/20 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
                             />
                             <span className="text-[12px] text-white/70 group-hover:text-white transition-colors">Apply Word Tokenization</span>
                           </label>
                        </div>
                     </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                         <h3 className="text-[10px] uppercase text-white/40 tracking-[0.15em] font-bold mb-4 border-b border-white/10 pb-2">Number Processing (CSV Only)</h3>
                         <select
                            value={config.numNormalization}
                            onChange={(e) => setConfig({ ...config, numNormalization: e.target.value as DatasetConfig['numNormalization'] })}
                            className="w-full px-4 py-3 text-[12px] bg-black border border-white/10 text-white focus:outline-none focus:border-white/30 rounded-xl"
                          >
                            <option value="none">Preserve Raw Values</option>
                            <option value="minmax">Min-Max Normalization (0-1)</option>
                            <option value="zscore">Z-Score Standardization</option>
                          </select>
                      </div>

                      <div>
                         <h3 className="text-[10px] uppercase text-white/40 tracking-[0.15em] font-bold mb-4 border-b border-white/10 pb-2">Image Processing</h3>
                         <div className="space-y-4">
                           <label className="flex items-center gap-3 cursor-pointer group">
                             <input
                               type="checkbox"
                               checked={config.imageResize}
                               onChange={(e) => setConfig({ ...config, imageResize: e.target.checked })}
                               className="w-5 h-5 rounded bg-black border-white/20 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
                             />
                             <span className="text-[12px] text-white/70 group-hover:text-white transition-colors">Resize to 256x256</span>
                           </label>
                           <label className="flex items-center gap-3 cursor-pointer group">
                             <input
                               type="checkbox"
                               checked={config.imageNormalize}
                               onChange={(e) => setConfig({ ...config, imageNormalize: e.target.checked })}
                               className="w-5 h-5 rounded bg-black border-white/20 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
                             />
                             <span className="text-[12px] text-white/70 group-hover:text-white transition-colors">Convert to Grayscale</span>
                           </label>
                         </div>
                      </div>
                   </div>

                   <div>
                      <h3 className="text-[10px] uppercase text-white/40 tracking-[0.15em] font-bold mb-4 border-b border-white/10 pb-2">Global Prompt & Metadata</h3>
                      <div className="space-y-5">
                         <div>
                            <label className="block text-[11px] font-medium text-white/70 mb-2 uppercase tracking-wide">
                              Global Instruction / Prompt (LLM Fine-tuning)
                            </label>
                            <textarea
                              rows={3}
                              value={config.systemPrompt}
                              onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                              placeholder="e.g. Determine the sentiment of the following document..."
                              className="w-full p-4 text-[12px] bg-black border border-white/10 text-white focus:outline-none focus:border-white/30 rounded-xl resize-none placeholder-white/20"
                            />
                         </div>
                         <div className="flex gap-4 items-center">
                            <div className="flex-1">
                              <label className="block text-[11px] font-medium text-white/70 mb-2 uppercase tracking-wide">
                                Custom Data Tags
                              </label>
                              <input
                                type="text"
                                value={config.customTags}
                                onChange={(e) => setConfig({ ...config, customTags: e.target.value })}
                                placeholder="nlp, text, batch-1"
                                className="w-full px-4 py-3 text-[12px] bg-black border border-white/10 text-white focus:outline-none focus:border-white/30 rounded-xl placeholder-white/20"
                              />
                            </div>
                            <div className="flex-1 pt-6">
                              <label className="flex items-center gap-3 cursor-pointer group bg-black border border-white/10 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors">
                               <input
                                 type="checkbox"
                                 checked={config.includePath}
                                 onChange={(e) => setConfig({ ...config, includePath: e.target.checked })}
                                 className="w-5 h-5 rounded bg-black border-white/20 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
                               />
                               <span className="text-[12px] text-white/70 group-hover:text-white transition-colors tracking-wide">Embed Full File Paths</span>
                             </label>
                            </div>
                         </div>
                      </div>
                   </div>

                </div>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
      </main>

      {/* Context Menu */}
      <AnimatePresence>
      {contextMenu && (
        <motion.div 
          layout
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed z-50 bg-[#111] border border-white/10 rounded-xl shadow-2xl py-1 min-w-[160px] blur-none origin-top-left overflow-hidden"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {(!contextMenu.mode || contextMenu.mode === 'main') ? (
            <>
              <div className="px-3 py-2 border-b border-white/5 mb-1">
                 <div className="text-[10px] font-medium text-white/50 truncate max-w-[140px]">{contextMenu.file.name}</div>
              </div>
              <button 
                 onClick={() => setContextMenu({ ...contextMenu, mode: 'move' })}
                 className="w-full text-left px-4 py-2 hover:bg-white/10 text-[11px] text-white/80 flex items-center justify-between transition-colors"
              >
                 <div className="flex items-center"><Folder className="w-3.5 h-3.5 mr-2 text-white/50" /> Move to...</div>
                 <span className="text-white/30">›</span>
              </button>
              <button 
                 onClick={() => { downloadSingleFile(contextMenu.file); setContextMenu(null); }}
                 className="w-full text-left px-4 py-2 hover:bg-white/10 text-[11px] text-white/80 flex items-center transition-colors"
              >
                 <Download className="w-3.5 h-3.5 mr-2 text-white/50" /> Download
              </button>
              <button 
                 onClick={() => { cloneFile(contextMenu.file); setContextMenu(null); }}
                 className="w-full text-left px-4 py-2 hover:bg-white/10 text-[11px] text-white/80 flex items-center transition-colors"
              >
                 <Copy className="w-3.5 h-3.5 mr-2 text-white/50" /> Clone File
              </button>
              <div className="my-1 border-t border-white/5"></div>
              <button 
                 onClick={() => { removeFile(contextMenu.file.id); setContextMenu(null); }}
                 className="w-full text-left px-4 py-2 hover:bg-red-500/10 text-[11px] text-red-400 flex items-center transition-colors"
              >
                 <Trash2 className="w-3.5 h-3.5 mr-2 text-red-400/70" /> Delete File
              </button>
            </>
          ) : (
            <>
              <div className="px-3 py-2 border-b border-white/5 mb-1 flex items-center text-white/50 cursor-pointer hover:text-white transition-colors" onClick={() => setContextMenu({ ...contextMenu, mode: 'main' })}>
                 <span className="text-white/30 mr-2">‹</span>
                 <span className="text-[10px] font-medium uppercase tracking-widest">Move to</span>
              </div>
              <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                {categories.map(c => (
                  <button 
                     key={c}
                     onClick={() => { updateFileCategory(contextMenu.file.id, c); setContextMenu(null); }}
                     className={`w-full text-left px-4 py-2 hover:bg-white/10 text-[11px] flex items-center transition-colors ${contextMenu.file.category === c ? 'text-indigo-400 bg-indigo-500/10' : 'text-white/80'}`}
                  >
                     <Folder className="w-3.5 h-3.5 mr-2 opacity-50" /> {c}
                  </button>
                ))}
              </div>
            </>
          )}
        </motion.div>
      )}
      </AnimatePresence>

      {/* Preview Modal remains basically unchanged except for some polish */}
      <AnimatePresence>
      {previewFile && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#0f0f0f] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-white/[0.02]">
              <h3 className="text-sm font-medium truncate text-white">
                {previewFile.name}
                <span className="ml-4 text-[10px] font-mono text-white/40 tracking-wider font-light">{previewFile.path}</span>
              </h3>
              <button 
                onClick={() => setPreviewFile(null)}
                className="text-white/40 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
              {previewFile.isImage ? (
                <div className="flex justify-center flex-col items-center gap-4">
                   <img src={previewFile.content} alt={previewFile.name} className="max-w-full max-h-[50vh] object-contain rounded-xl border border-white/10 shadow-lg" />
                   {previewFile.metadata && previewFile.metadata.dimensions && (
                     <div className="text-[10px] bg-white/5 px-3 py-1 rounded-full text-white/40 font-mono tracking-widest uppercase">
                        {previewFile.metadata.dimensions.width} x {previewFile.metadata.dimensions.height} px
                     </div>
                   )}
                </div>
              ) : previewFile.isAudio ? (
                <div className="flex justify-center flex-col items-center gap-4 py-16 w-full">
                   <audio src={previewFile.content} controls className="w-full max-w-md outline-none" />
                </div>
              ) : previewFile.isVideo ? (
                <div className="flex justify-center flex-col items-center gap-4">
                   <video src={previewFile.content} controls className="max-w-full max-h-[50vh] rounded-xl border border-white/10 outline-none shadow-lg" />
                </div>
              ) : (
                <pre className="text-[12px] font-mono whitespace-pre-wrap text-white/70 leading-relaxed font-light break-words selection:bg-white/20 selection:text-white">
                  {previewFile.content}
                </pre>
              )}
            </div>

            {previewFile.metadata && (
              <div className="border-t border-white/5 bg-white/[0.01] px-8 py-6 flex-shrink-0">
                <h4 className="text-[9px] uppercase font-bold tracking-[0.2em] text-white/30 mb-4">Metadata Properties</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {Object.entries(previewFile.metadata).map(([k, v]) => (
                    k !== 'exif' && typeof v !== 'object' && (
                      <div key={k}>
                        <div className="text-[9px] uppercase tracking-widest text-white/30 truncate mb-1">{k}</div>
                        <div className="text-[11px] font-mono text-white/70 truncate" title={String(v)}>{String(v)}</div>
                      </div>
                    )
                  ))}
                  {previewFile.category && (
                    <div>
                        <div className="text-[9px] uppercase tracking-widest text-white/30 truncate mb-1">Configured Category</div>
                        <div className="text-[11px] font-mono text-indigo-400 truncate bg-indigo-500/10 px-2 py-0.5 rounded-full inline-block">{previewFile.category}</div>
                      </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

    </div>
  );
}
