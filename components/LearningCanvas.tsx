import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
    ArrowLeft, Database, Inbox, Brain, Trash2, Link, ArrowRight, 
    Loader2, X, AlertTriangle, Zap, Plus, 
    MousePointer2, Move, LayoutGrid, Save, ZoomIn, ZoomOut, FileText,
    Check, Edit2, BrainCircuit, Play, FileUp, Sparkles, RotateCw, Shield, CheckCircle2, FlaskConical, Undo2, Redo2, ChevronLeft, ChevronRight, ChevronDown, HelpCircle, MessageSquare, RefreshCw, Download, FileUp as FileExport, Hexagon, FileSpreadsheet, FileCode, Lock, Mic, Share2
} from 'lucide-react';
import { analyzeFallacy, extractKeywordsForGrouping, getModel, getAI } from '../services/geminiService';
import { GoogleGenAI } from "@google/genai";
import { ReasoningTrace } from './ReasoningTrace';
import { KoLogo } from './Logos';
import { 
    InboxItem, Note, ProcessingOptions, AppTheme, CanvasDocument, CanvasNode, CanvasEdge, 
    FileData, CritiqueResult, Platform, CanvasState, Folder, CanvasGroup, NodeType, Theme
} from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { saveToStorage, loadFromStorage } from '../services/storage';
import { t, getLocaleString } from '../src/i18n';
import { getSystemLanguage } from '../services/geminiService';

// --- Helpers ---
const cleanJson = (text: any) => {
    if (!text) return {};
    const str = typeof text === 'string' ? text : String(text);
    let cleaned = str.replace(/```json/gi, '').replace(/```/gi, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch (e: any) {
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        const firstBracket = cleaned.indexOf('[');
        const lastBracket = cleaned.lastIndexOf(']');
        let start = -1; let end = -1;
        if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
            start = firstBrace; end = lastBrace;
        } else if (firstBracket !== -1) {
            start = firstBracket; end = lastBracket;
        }
        if (start !== -1 && end !== -1 && end > start) {
            const potentialJson = cleaned.substring(start, end + 1);
            try { return JSON.parse(potentialJson); } catch (e2: any) { return {}; }
        }
        return {}; 
    }
};

const renderMarkdown = (text: string) => {
    if (!text) return null;
    return text.split(/(\*\*.*?\*\*)/g).map((part, i) => 
        (part.startsWith('**') && part.endsWith('**')) 
            ? <strong key={i} className="font-bold text-gray-900">{part.slice(2, -2)}</strong> 
            : part
    );
};

const stripStars = (text: string) => text.replace(/\*\*/g, "");

interface LibraryDrawerProps {
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
    activeTab: 'inbox' | 'assets';
    inbox: InboxItem[];
    inboxTrash: InboxItem[];
    library: Note[];
    noteTrash: Note[];
    folders: Folder[];
    themes: Theme[];
    systemLanguage?: string;
    onDeleteSignal: (id: string) => void;
    onRestoreSignal?: (item: InboxItem) => void;
    onDeleteSignalForever?: (id: string) => void;
    onDeleteNote: (id: string) => void;
    onRestoreNote: (note: Note) => void;
    onDeleteNoteForever: (id: string) => void;
    onSelectSignal: (item: InboxItem) => void;
    onCapture: (url: string, options: ProcessingOptions) => Promise<void>;
    onDragWarn: (item: InboxItem) => void;
    onAddSelectedToFolder: (folderId: string) => void;
    onAddFolder: (folder: Omit<Folder, 'id'>) => void;
    onUpdateFolder: (folder: Folder) => void;
    onDeleteFolder: (id: string) => void;
    onAddTheme: (theme: Omit<Theme, 'id'> & { id?: string }) => Theme;
    onUpdateTheme: (theme: Theme) => void;
    onDeleteTheme: (id: string) => void;
    canUsePremiumFeatures: (feature: 'LogicGuard' | 'MemoryLab' | 'NeuralDump' | 'Spark' | 'Alchemy' | 'Collider' | 'Export' | 'Folders' | 'Themes' | 'ThematicArrange' | 'Chat' | 'Quizzes' | 'Inbox', silent?: boolean) => boolean;
    isReadOnly?: boolean;
}

interface LearningCanvasProps {
  library: Note[];
  inbox: InboxItem[];
  inboxTrash: InboxItem[];
  noteTrash: Note[];
  folders: Folder[];
  themes: Theme[];
  theme: AppTheme;
  systemLanguage?: string;
  isReadOnly?: boolean;
  canvases: CanvasDocument[];
  onUpdateCanvases: React.Dispatch<React.SetStateAction<CanvasDocument[]>>;
  canCreateCanvas: () => boolean;
  canUsePremiumFeatures: (feature: 'LogicGuard' | 'MemoryLab' | 'NeuralDump' | 'Spark' | 'Alchemy' | 'Collider' | 'Export' | 'Folders' | 'Themes' | 'ThematicArrange' | 'Chat' | 'Quizzes' | 'Inbox', silent?: boolean) => boolean;
  canvasTrash: CanvasDocument[];
  onMoveCanvasToTrash: (id: string) => void;
  onRestoreCanvas: (id: string) => void;
  onDeleteCanvasForever: (id: string) => void;
  activeCanvasId: string | null;
  onSelectCanvas: (id: string | null) => void;
  onOpenNeuralDump: () => void;
  onEnterMemoryLab: () => void;
  onGoToLibrary: () => void;
  onCapture: (url: string, options: ProcessingOptions) => Promise<void>;
  onDeleteSignal: (id: string) => void;
  onRestoreSignal: (item: InboxItem) => void;
  onDeleteSignalForever: (id: string) => void;
  onKeepSignal: (item: InboxItem, editedSummary?: string[], quizAnswers?: Record<number, number>, tags?: string[], editedTitle?: string) => void;
  onUpdateNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  onRestoreNote: (note: Note) => void;
  onDeleteNoteForever: (id: string) => void;
  onSelectionChange?: (selectedNodes: CanvasNode[]) => void;
  onExitWorkspace: () => void;
  onOpenChat?: (noteId?: string, fileIndex?: number, query?: string) => void; 
  onAddNote?: (note: Note) => void;
  onAddFolder: (folder: Omit<Folder, 'id'>) => void;
  onUpdateFolder: (folder: Folder) => void;
  onDeleteFolder: (id: string) => void;
  onAddTheme: (theme: Omit<Theme, 'id'> & { id?: string }, skipCanvasGroup?: boolean) => Theme;
  onUpdateTheme: (theme: Theme) => void;
  onDeleteTheme: (id: string) => void;
  onAddSelectedToFolder: (folderId: string) => void;
  onKeepAllSignals?: () => void;
  isMemoryLabLocked?: boolean;
  isNeuralDumpLocked?: boolean;
  isInboxLocked?: boolean;
  onAIUsage?: () => void;
  onLogicGuardUsage?: () => void;
}



const LibraryDrawer = React.memo<LibraryDrawerProps>(({ 
    isOpen, setIsOpen, activeTab, inbox, inboxTrash, library, noteTrash, folders, themes, systemLanguage = 'English', onDeleteSignal, onRestoreSignal, onDeleteSignalForever, onDeleteNote, onRestoreNote, onDeleteNoteForever, onSelectSignal, onCapture, onDragWarn, onAddFolder, onUpdateFolder, onDeleteFolder, onAddTheme, onUpdateTheme, onDeleteTheme, onAddSelectedToFolder, canUsePremiumFeatures, isReadOnly 
}) => {
    const getNoteBadge = (note: any) => {
        const isNeuralDump = note.source === 'neural_dump' || note.sourceUrl === 'neural://dump';
        const isSpark = note.type === 'spark' || note.type === 'insight' || note.color === '#F59E0B'; 
        const isAlchemy = note.type === 'asset' || note.color === '#10B981';
        const isCollider = note.type === 'synthesis' || note.type === 'conflict' || note.type === 'collision' || note.color === '#A855F7'; 
        
        const folder = note.folder ? folders.find(f => f.id === note.folder) : null;
        const folderSuffix = folder ? ` - ${folder.name}` : '';

        if (isNeuralDump) return { label: `NEURAL DUMP${folderSuffix}`, color: 'bg-blue-50 text-blue-700', border: 'border-blue-200 hover:border-blue-300' };
        if (isSpark) return { label: `SPARK${folderSuffix}`, color: 'bg-amber-50 text-amber-700', border: 'border-amber-200 hover:border-amber-300' };
        if (isAlchemy) return { label: `ALCHEMY${folderSuffix}`, color: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-200 hover:border-emerald-300' };
        if (isCollider) return { label: `COLLIDER${folderSuffix}`, color: 'bg-violet-50 text-violet-700', border: 'border-violet-200 hover:border-violet-300' };
        return { label: `NOTE${folderSuffix}`, color: 'bg-blue-50 text-blue-700', border: 'border-blue-100 hover:border-blue-200' };
    };
    const [inboxView, setInboxView] = useState<'active' | 'trash'>('active');
    const [assetsView, setAssetsView] = useState<'active' | 'trash'>('active');
    const [activeSidebarTab, setActiveSidebarTab] = useState<'sources' | 'folders' | 'themes'>(() => {
        const saved = localStorage.getItem('activeSidebarTab');
        return (saved as any) || 'sources';
    });

    useEffect(() => {
        localStorage.setItem('activeSidebarTab', activeSidebarTab);
    }, [activeSidebarTab]);
    const [isAddingFolder, setIsAddingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderColor, setNewFolderColor] = useState('#3B82F6');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
    const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
    const [editFolderName, setEditFolderName] = useState('');
    const [editFolderColor, setEditFolderColor] = useState('#3B82F6');
    const [isAddingTheme, setIsAddingTheme] = useState(false);
    const [newThemeName, setNewThemeName] = useState('');
    const [newThemeColor, setNewThemeColor] = useState('#3B82F6');
    const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
    const [editThemeName, setEditThemeName] = useState('');
    const [editThemeColor, setEditThemeColor] = useState('#3B82F6');

    const toggleFolder = (id: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleTheme = (id: string) => {
        setExpandedThemes(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const [captureUrl, setCaptureUrl] = useState('');
    const [isCapturing, setIsCapturing] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<FileData[]>([]);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragStart = (e: React.DragEvent, item: any, type: 'signal' | 'asset') => {
        if (isReadOnly) {
            e.preventDefault();
            return;
        }
        const dragType = type === 'asset' ? 'LINK' : 'signal';
        e.dataTransfer.setData('type', dragType);
        e.dataTransfer.setData('id', String(item.id));
        if (dragType === 'LINK') {
            e.dataTransfer.setData('application/json', JSON.stringify({
                type: 'LINK', id: item.id, url: item.sourceUrl, title: item.title
            }));
        }
        e.dataTransfer.effectAllowed = 'copy';

        // Custom drag image to avoid white rectangle
        const dragIcon = document.createElement('div');
        dragIcon.style.width = '200px';
        dragIcon.style.padding = '12px';
        dragIcon.style.backgroundColor = 'white';
        dragIcon.style.border = '1px solid #e5e7eb';
        dragIcon.style.borderRadius = '12px';
        dragIcon.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        dragIcon.style.position = 'absolute';
        dragIcon.style.top = '-1000px';
        dragIcon.style.left = '-1000px';
        dragIcon.style.zIndex = '-1';
        dragIcon.innerHTML = `<div style="font-weight: bold; font-size: 12px; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.title}</div>`;
        document.body.appendChild(dragIcon);
        e.dataTransfer.setDragImage(dragIcon, 100, 20);
        setTimeout(() => document.body.removeChild(dragIcon), 0);
    };

    const handleCaptureSubmit = async () => {
        if (!captureUrl.trim() && uploadedFiles.length === 0) return;
        if (isCapturing) return;
        setIsCapturing(true);
        try {
            if (captureUrl.trim()) await onCapture(captureUrl.trim(), { summaryPoints: 5, quizCount: 3, targetLanguage: systemLanguage, files: [] });
            if (uploadedFiles.length > 0) await Promise.all(uploadedFiles.map(file => onCapture("File Upload", { summaryPoints: 5, quizCount: 3, targetLanguage: systemLanguage, files: [file], contextText: captureUrl.trim() ? `Context: ${captureUrl.trim()}` : undefined })));
        } catch (e: any) { console.error(e); } finally { setIsCapturing(false); setCaptureUrl(''); setUploadedFiles([]); }
    };

    const processFiles = (files: File[]) => {
        const newFiles: FileData[] = [];
        let processed = 0;
        files.forEach(file => {
             const reader = new FileReader();
             reader.onloadend = () => {
                 const r = reader.result;
                 const resultStr = typeof r === 'string' ? r : '';
                 newFiles.push({ mimeType: file.type, data: resultStr, name: file.name });
                 processed++;
                 if (processed === files.length) setUploadedFiles(prev => [...prev, ...newFiles]);
             };
             reader.readAsDataURL(file);
        });
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
             const fileList: File[] = [];
             for (let i = 0; i < e.target.files.length; i++) { const f = e.target.files.item(i); if (f) fileList.push(f); }
             processFiles(fileList);
        }
    };
    
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (items) {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf("image") !== -1) {
                        const blob = items[i].getAsFile();
                        const reader = new FileReader();
                        reader.onload = (event) => { const target = event.target as FileReader; if (target?.result) { setUploadedFiles(prev => [...prev, { mimeType: items[i].type, data: typeof target.result === 'string' ? target.result : '', name: `Pasted Image ${Date.now()}` }]); }};
                        if (blob) reader.readAsDataURL(blob);
                    }
                }
            }
        };
        if (isOpen) { window.addEventListener('paste', handlePaste); return () => window.removeEventListener('paste', handlePaste); }
    }, [isOpen]);

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); const types = e.dataTransfer.types; if (types && Array.from(types as any).indexOf('Files') !== -1) { setIsDraggingFile(true); }};
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(false); };
    const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(false); if (e.dataTransfer.files && e.dataTransfer.files.length > 0) { const fileList: File[] = []; for (let i = 0; i < e.dataTransfer.files.length; i++) { const f = e.dataTransfer.files.item(i); if (f) fileList.push(f); } processFiles(fileList); }};
    const removeFile = (idx: number) => setUploadedFiles(prev => prev.filter((_, i) => i !== idx));

    return (
        <div className={`absolute left-0 top-0 bottom-0 z-30 bg-white/95 backdrop-blur-xl border-r border-gray-200 transition-transform duration-300 flex flex-col shadow-2xl w-full md:w-96 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            {isDraggingFile && (<div className="absolute inset-0 z-50 bg-gray-50/90 flex flex-col items-center justify-center border-4 border-gray-400 border-dashed m-2 rounded-3xl animate-pulse pointer-events-none"><FileUp className="w-16 h-16 text-gray-500 mb-4" /><h3 className="text-xl font-bold text-gray-600">Drop Files to Analyze</h3></div>)}
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className={`absolute -right-6 top-1/2 -translate-y-1/2 w-6 h-24 bg-white/95 backdrop-blur-xl border border-gray-200 border-l-0 rounded-r-xl flex items-center justify-center shadow-[4px_0_12px_-2px_rgba(0,0,0,0.1)] z-50 hover:bg-gray-50 transition-colors group cursor-pointer`}
            >
                <div className="flex flex-col items-center justify-center space-y-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                    <ChevronLeft className={`w-4 h-4 text-gray-600 transition-transform duration-500 ${isOpen ? '' : 'rotate-180'}`} />
                    <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                </div>
            </button>
            <div className={`p-6 flex items-center justify-between flex-shrink-0 bg-white`}>
                <div className="flex items-center space-x-2">
                    <span className={`font-black text-sm uppercase tracking-widest flex items-center text-gray-900`}>
                        {activeTab === 'inbox' ? <><Inbox className="w-5 h-5 mr-2 text-purple-500" /> {t('Inbox', systemLanguage)}</> : <><Database className="w-5 h-5 mr-2 text-amber-500" /> {t('Library', systemLanguage)}</>}
                    </span>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-white relative">
                 {activeTab === 'inbox' && inboxView === 'active' && !isReadOnly && (
                    <div className="mb-6 bg-white p-3 rounded-2xl border border-purple-200 shadow-sm focus-within:ring-2 focus-within:ring-purple-200 focus-within:border-purple-400 transition-all">
                        <div className="flex items-center">
                            <input 
                                type="text" 
                                value={captureUrl} 
                                onChange={(e) => setCaptureUrl(e.target.value)} 
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleCaptureSubmit();
                                    }
                                }}
                                placeholder={uploadedFiles.length > 0 ? t("Add context...", systemLanguage) : t("Paste link, drag files or paste image...", systemLanguage)} 
                                className="flex-1 bg-transparent text-sm font-medium focus:outline-none py-2 pl-2 placeholder-gray-400 text-gray-800" 
                            />
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition mr-1"><FileUp className="w-5 h-5" /></button>
                            <button onClick={handleCaptureSubmit} disabled={!captureUrl.trim() && uploadedFiles.length === 0} className="p-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:hover:bg-purple-600">{isCapturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}</button>
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple accept="image/*,application/pdf,audio/*,video/*,text/*" />
                        {uploadedFiles.length > 0 && (<div className="flex gap-2 mt-3 overflow-x-auto p-2">{uploadedFiles.map((f, i) => (<div key={i} className="relative group/preview flex-shrink-0"><div className="w-12 h-12 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden">{f.mimeType.startsWith('image/') ? <img src={f.data} className="w-full h-full object-cover" /> : <FileText className="w-6 h-6 text-gray-400" />}</div><button onClick={() => removeFile(i)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/preview:opacity-100 transition shadow-sm"><X className="w-3 h-3" /></button></div>))}</div>)}
                    </div>
                )}
                {activeTab === 'inbox' && (<div className="flex justify-between items-center px-1 mb-3"><span className="text-xs font-bold text-purple-500 uppercase tracking-wider">{inboxView === 'active' ? t('Active Signals', systemLanguage) : t('Deleted Signals', systemLanguage)}</span><button onClick={() => setInboxView(prev => prev === 'active' ? 'trash' : 'active')} className={`text-[10px] font-bold uppercase tracking-wider flex items-center transition-colors ${inboxView === 'trash' ? 'text-red-600 bg-red-50 px-2 py-1 rounded-md' : 'text-gray-500 hover:text-purple-600'}`}><Trash2 className="w-3.5 h-3.5 mr-1" /> {inboxView === 'active' ? t('BIN', systemLanguage) : t('Back', systemLanguage)}</button></div>)}
                {activeTab === 'assets' && (
                    <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                        <button onClick={() => setActiveSidebarTab('sources')} className={`flex-1 text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg transition-all ${activeSidebarTab === 'sources' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t('SOURCES', systemLanguage)}</button>
                        <button onClick={() => setActiveSidebarTab('folders')} className={`flex-1 text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg transition-all ${activeSidebarTab === 'folders' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t('FOLDERS', systemLanguage)}</button>
                        <button onClick={() => setActiveSidebarTab('themes')} className={`flex-1 text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg transition-all ${activeSidebarTab === 'themes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t('THEMES', systemLanguage)}</button>
                    </div>
                )}
                {activeTab === 'assets' && activeSidebarTab === 'sources' && (<div className="flex justify-between items-center px-1 mb-3"><span className="text-xs font-bold text-amber-500 uppercase tracking-wider">{assetsView === 'active' ? t('ACTIVE SOURCES', systemLanguage) : t('Deleted Sources', systemLanguage)}</span><button onClick={() => setAssetsView(prev => prev === 'active' ? 'trash' : 'active')} className={`text-[10px] font-bold uppercase tracking-wider flex items-center transition-colors ${assetsView === 'trash' ? 'text-red-600 bg-red-50 px-2 py-1 rounded-md' : 'text-gray-500 hover:text-amber-600'}`}><Trash2 className="w-3.5 h-3.5 mr-1" /> {assetsView === 'active' ? t('BIN', systemLanguage) : t('Back', systemLanguage)}</button></div>)}
                {activeTab === 'inbox' ? (
                    inboxView === 'active' ? (
                        inbox.length === 0 ? (
                            <div className="text-center py-12 opacity-40">
                                <Inbox className="w-16 h-16 mx-auto mb-3 text-purple-300" />
                                <p className="text-sm font-bold text-purple-500">{t('Inbox Empty', systemLanguage)}</p>
                            </div>
                        ) : (
                            inbox.map(item => (
                                <div key={item.id} draggable onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); onDragWarn(item); }} onClick={() => onSelectSignal(item)} className="bg-white p-4 rounded-2xl border border-purple-100 shadow-sm hover:shadow-md hover:border-purple-300 cursor-no-drop group relative transition-all active:scale-[0.98]">
                                    <h4 className="text-sm font-bold text-gray-900 mb-2 leading-snug pr-8 break-all line-clamp-2">{item.title}</h4>
                                    <div className="flex justify-between items-center mt-3">
                                        <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest bg-purple-50 px-2 py-1 rounded-md">{item.platform}</span>
                                        {item.isProcessing && <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />}
                                    </div>
                                    {!isReadOnly && (
                                        <button onClick={(e) => { e.stopPropagation(); onDeleteSignal(item.id); }} className="absolute top-3 right-3 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))
                        )
                    ) : (
                        inboxTrash.length === 0 ? (
                            <div className="text-center py-12 opacity-40">
                                <Trash2 className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                                <p className="text-sm font-bold text-gray-500">Trash Empty</p>
                            </div>
                        ) : (
                            inboxTrash.map(item => (
                                <div key={item.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-200 opacity-75 hover:opacity-100 transition-all group relative">
                                    <h4 className="text-sm font-bold text-gray-500 mb-2 leading-snug line-through decoration-gray-400 break-all line-clamp-2">{item.title}</h4>
                                    <div className="flex justify-between items-center mt-3">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.platform}</span>
                                        <div className="flex space-x-2">
                                            {!isReadOnly && (
                                                <>
                                                    <button onClick={() => onRestoreSignal && onRestoreSignal(item)} className="p-2 text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-xl text-[10px] font-bold uppercase tracking-wide flex items-center transition-colors">
                                                        <RotateCw className="w-3.5 h-3.5 mr-1" /> Restore
                                                    </button>
                                                    <button onClick={() => onDeleteSignalForever && onDeleteSignalForever(item.id)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl text-[10px] font-bold uppercase tracking-wide flex items-center transition-colors">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )
                    )
                ) : (
                    activeSidebarTab === 'sources' ? (
                        assetsView === 'active' ? (
                            library.map(note => {
                                const badge = getNoteBadge(note);
                                return (
                                <div key={note.id} draggable={!isReadOnly} onDragStart={(e) => handleDragStart(e, note, 'asset')} className={`bg-white p-4 rounded-2xl border shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing group relative transition-all ${badge.border}`}>
                                    <h4 className="text-sm font-bold text-gray-900 mb-3 leading-snug pr-8 break-all line-clamp-2">{note.title}</h4>
                                    <div className="flex justify-between items-center">
                                        <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-widest ${badge.color}`}>
                                            {badge.label}
                                        </span>
                                        {!isReadOnly && (
                                            <button onClick={() => onDeleteNote(note.id)} className="absolute top-3 right-3 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition opacity-0 group-hover:opacity-100">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                );
                            })
                        ) : (
                            noteTrash.length === 0 ? (
                                <div className="text-center py-12 opacity-40">
                                    <Trash2 className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                                    <p className="text-sm font-bold text-gray-500">Trash Empty</p>
                                </div>
                            ) : (
                                noteTrash.map(note => (
                                    <div key={note.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-200 opacity-75 hover:opacity-100 transition-all group relative mb-3">
                                        <h4 className="text-sm font-bold text-gray-500 mb-2 leading-snug line-through decoration-gray-400 break-all line-clamp-2">{note.title}</h4>
                                        <div className="flex justify-between items-center mt-3">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{note.platform}</span>
                                            <div className="flex space-x-2">
                                                {!isReadOnly && (
                                                    <>
                                                        <button onClick={() => onRestoreNote(note)} className="p-2 text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-xl text-[10px] font-bold uppercase tracking-wide flex items-center transition-colors">
                                                            <RotateCw className="w-3.5 h-3.5 mr-1" /> Restore
                                                        </button>
                                                        <button onClick={() => onDeleteNoteForever(note.id)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl text-[10px] font-bold uppercase tracking-wide flex items-center transition-colors">
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )
                        )
                    ) : activeSidebarTab === 'folders' ? (
                        <div>
                            <div className="flex items-center justify-between mb-3 px-2">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Folders</h3>
                                {!isReadOnly && (
                                    <button onClick={() => { if (canUsePremiumFeatures('Folders')) setIsAddingFolder(true); }} className="text-gray-400 hover:text-blue-500 transition-colors">
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-col gap-1">
                                {isAddingFolder && (
                                    <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm mb-2">
                                        <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newFolderName.trim()) { onAddFolder({ name: newFolderName.trim(), color: newFolderColor }); setIsAddingFolder(false); setNewFolderName(''); } }} placeholder={t("Folder name", getSystemLanguage())} className="w-full text-xs font-bold bg-gray-50 border-none rounded-lg px-2 py-1.5 mb-2 focus:ring-1 focus:ring-blue-500 outline-none" autoFocus />
                                        <div className="flex items-center justify-between">
                                            <input type="color" value={newFolderColor} onChange={(e) => setNewFolderColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
                                            <div className="flex space-x-1">
                                                <button onClick={() => { setIsAddingFolder(false); setNewFolderName(''); }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => { if (newFolderName.trim()) { onAddFolder({ name: newFolderName.trim(), color: newFolderColor }); setIsAddingFolder(false); setNewFolderName(''); } }} className="p-1 text-blue-500 hover:text-blue-600"><Check className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {folders.map(folder => {
                                    const folderNotes = library.filter(n => n.folder === folder.id);
                                    const isExpanded = expandedFolders.has(folder.id);
                                    return (
                                        <div key={folder.id} className="group relative">
                                            {editingFolderId === folder.id ? (
                                                <div className="bg-white p-2 rounded-xl border border-blue-200 shadow-sm">
                                                    <input type="text" value={editFolderName} onChange={(e) => setEditFolderName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && editFolderName.trim()) { onUpdateFolder({ ...folder, name: editFolderName.trim(), color: editFolderColor }); setEditingFolderId(null); } }} className="w-full text-xs font-bold bg-gray-50 border-none rounded-lg px-2 py-1.5 mb-2 focus:ring-1 focus:ring-blue-500 outline-none" autoFocus />
                                                    <div className="flex items-center justify-between">
                                                        <input type="color" value={editFolderColor} onChange={(e) => setEditFolderColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
                                                        <div className="flex space-x-1">
                                                            <button onClick={() => setEditingFolderId(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                                                            <button onClick={() => { if (editFolderName.trim()) { onUpdateFolder({ ...folder, name: editFolderName.trim(), color: editFolderColor }); setEditingFolderId(null); } }} className="p-1 text-blue-500 hover:text-blue-600"><Check className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col" data-folder-id={folder.id}>
                                                    <div onClick={() => toggleFolder(folder.id)} className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold transition-colors text-gray-500 hover:bg-gray-50 cursor-pointer">
                                                        <div className="flex items-center flex-1 text-left">
                                                            <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: folder.color }}></div>
                                                            {folder.name}
                                                            <span className="ml-2 text-[9px] text-gray-400">({folderNotes.length})</span>
                                                        </div>
                                                        <div className="flex items-center space-x-1">
                                                            {!isReadOnly && (
                                                                <div className="hidden group-hover:flex items-center space-x-1">
                                                                    <button onClick={(e) => { e.stopPropagation(); onAddSelectedToFolder(folder.id); }} className="p-1 text-gray-400 hover:text-green-500" title="Add selected whiteboard notes to folder"><Plus className="w-3 h-3" /></button>
                                                                    <button onClick={(e) => { e.stopPropagation(); setEditingFolderId(folder.id); setEditFolderName(folder.name); setEditFolderColor(folder.color); }} className="p-1 text-gray-400 hover:text-blue-500"><Edit2 className="w-3 h-3" /></button>
                                                                    <button onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                                                </div>
                                                            )}
                                                            <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                        </div>
                                                    </div>
                                                    {isExpanded && (
                                                        <div className="pl-6 pr-2 py-2 flex flex-col gap-3">
                                                            {folderNotes.length === 0 ? (
                                                                <p className="text-[9px] text-gray-400 italic py-1">No notes in folder</p>
                                                            ) : (
                                                                folderNotes.map(note => {
                                                                    const badge = getNoteBadge(note);
                                                                    return (
                                                                    <div key={note.id} draggable={!isReadOnly} onDragStart={(e) => handleDragStart(e, note, 'asset')} className={`p-3 rounded-xl border shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing group relative transition-all ${badge.border}`} style={{ backgroundColor: folder.color }}>
                                                                        <h4 className="text-[11px] font-bold text-gray-900 mb-2 leading-snug break-words line-clamp-2 pr-6">{note.title}</h4>
                                                                        <div className="flex justify-between items-center">
                                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${badge.color}`}>
                                                                                {badge.label}
                                                                            </span>
                                                                            {!isReadOnly && (
                                                                                <button 
                                                                                    onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }} 
                                                                                    className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition opacity-0 group-hover:opacity-100"
                                                                                >
                                                                                    <Trash2 className="w-3 h-3" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    );
                                                                })
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between mb-3 px-2">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Themes</h3>
                                {!isReadOnly && (
                                    <button onClick={() => { if (canUsePremiumFeatures('Themes')) setIsAddingTheme(true); }} className="text-gray-400 hover:text-blue-500 transition-colors">
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-col gap-1">
                                {isAddingTheme && (
                                    <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm mb-2">
                                        <input type="text" value={newThemeName} onChange={(e) => setNewThemeName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newThemeName.trim()) { onAddTheme({ name: newThemeName.trim(), color: newThemeColor }); setIsAddingTheme(false); setNewThemeName(''); } }} placeholder={t("Theme name", getSystemLanguage())} className="w-full text-xs font-bold bg-gray-50 border-none rounded-lg px-2 py-1.5 mb-2 focus:ring-1 focus:ring-blue-500 outline-none" autoFocus />
                                        <div className="flex items-center justify-between">
                                            <input type="color" value={newThemeColor} onChange={(e) => setNewThemeColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
                                            <div className="flex space-x-1">
                                                <button onClick={() => { setIsAddingTheme(false); setNewThemeName(''); }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => { if (newThemeName.trim()) { onAddTheme({ name: newThemeName.trim(), color: newThemeColor }); setIsAddingTheme(false); setNewThemeName(''); } }} className="p-1 text-blue-500 hover:text-blue-600"><Check className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {themes.map(theme => {
                                    const themeNotes = library.filter(n => n.theme === theme.id);
                                    const isExpanded = expandedThemes.has(theme.id);
                                    return (
                                        <div key={theme.id} className="group relative">
                                            {editingThemeId === theme.id ? (
                                                <div className="bg-white p-2 rounded-xl border border-blue-200 shadow-sm">
                                                    <input type="text" value={editThemeName} onChange={(e) => setEditThemeName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && editThemeName.trim()) { onUpdateTheme({ ...theme, name: editThemeName.trim(), color: editThemeColor }); setEditingThemeId(null); } }} className="w-full text-xs font-bold bg-gray-50 border-none rounded-lg px-2 py-1.5 mb-2 focus:ring-1 focus:ring-blue-500 outline-none" autoFocus />
                                                    <div className="flex items-center justify-between">
                                                        <input type="color" value={editThemeColor} onChange={(e) => setEditThemeColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
                                                        <div className="flex space-x-1">
                                                            <button onClick={() => setEditingThemeId(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                                                            <button onClick={() => { if (editThemeName.trim()) { onUpdateTheme({ ...theme, name: editThemeName.trim(), color: editThemeColor }); setEditingThemeId(null); } }} className="p-1 text-blue-500 hover:text-blue-600"><Check className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <div 
                                                        onClick={() => toggleTheme(theme.id)}
                                                        className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold transition-colors text-gray-500 hover:bg-gray-50 cursor-pointer"
                                                        draggable={!isReadOnly}
                                                        onDragStart={(e) => {
                                                            if (isReadOnly) {
                                                                e.preventDefault();
                                                                return;
                                                            }
                                                            e.dataTransfer.setData('themeId', theme.id);
                                                            e.dataTransfer.setData('type', 'theme');
                                                        }}
                                                    >
                                                        <div className="flex items-center flex-1 text-left">
                                                            <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: theme.color }}></div>
                                                            {theme.name}
                                                            <span className="ml-2 text-[9px] text-gray-400">({themeNotes.length})</span>
                                                        </div>
                                                        <div className="flex items-center space-x-1">
                                                            {!isReadOnly && (
                                                                <div className="hidden group-hover:flex items-center space-x-1">
                                                                    <button onClick={(e) => { e.stopPropagation(); setEditingThemeId(theme.id); setEditThemeName(theme.name); setEditThemeColor(theme.color); }} className="p-1 text-gray-400 hover:text-blue-500"><Edit2 className="w-3 h-3" /></button>
                                                                    <button onClick={(e) => { e.stopPropagation(); onDeleteTheme(theme.id); }} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                                                </div>
                                                            )}
                                                            <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                        </div>
                                                    </div>
                                                    {isExpanded && (
                                                        <div className="pl-6 pr-2 py-1 flex flex-col gap-1">
                                                            {themeNotes.length === 0 ? (
                                                                <p className="text-[9px] text-gray-400 italic py-1">No notes in theme</p>
                                                            ) : (
                                                                themeNotes.map(note => {
                                                                    const badge = getNoteBadge(note);
                                                                    return (
                                                                    <div key={note.id} draggable={!isReadOnly} onDragStart={(e) => handleDragStart(e, note, 'asset')} className={`bg-white p-3 rounded-xl border shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing group relative transition-all ${badge.border}`}>
                                                                        <h4 className="text-[11px] font-bold text-gray-900 mb-2 leading-snug break-words line-clamp-2 pr-6">{note.title}</h4>
                                                                        <div className="flex justify-between items-center">
                                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${badge.color}`}>
                                                                                {badge.label}
                                                                            </span>
                                                                            {!isReadOnly && (
                                                                                <button 
                                                                                    onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }} 
                                                                                    className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition opacity-0 group-hover:opacity-100"
                                                                                >
                                                                                    <Trash2 className="w-3 h-3" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    );
                                                                })
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
});

const ToolbarButton: React.FC<{ 
    onClick: () => void; 
    icon: React.ReactNode; 
    title: string;
    description: string;
    active?: boolean; 
    disabled?: boolean;
    className?: string;
    isLocked?: boolean;
}> = ({ onClick, icon, title, description, active, disabled, className, isLocked }) => {
    return (
        <div className="relative group flex flex-col items-center">
            <div className="absolute bottom-full mb-3 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 pointer-events-none z-50">
                <div className="bg-gray-900 text-white py-2 px-3 rounded-xl shadow-xl flex flex-col items-center text-center min-w-[120px]">
                    <span className="text-[10px] font-black uppercase tracking-widest mb-0.5 flex items-center">
                        {title}
                        {isLocked && <Lock className="w-3 h-3 ml-1 text-gray-400" />}
                    </span>
                    <span className="text-[9px] font-medium text-gray-400 leading-tight max-w-[150px]">{description}</span>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                </div>
            </div>
            <button onClick={onClick} onPointerDownCapture={(e) => e.stopPropagation()} disabled={disabled} className={`p-3 rounded-full transition-all relative ${active ? 'bg-gray-900 text-white shadow-lg scale-105' : 'hover:bg-gray-100 text-gray-700 hover:scale-110'} ${disabled ? 'opacity-30 cursor-not-allowed hover:bg-transparent hover:scale-100' : ''} ${className || ''}`}>
                {icon}
                {isLocked && (
                    <div className="absolute top-0 right-0 bg-gray-900 rounded-full p-0.5 border-2 border-white">
                        <Lock className="w-2.5 h-2.5 text-white" />
                    </div>
                )}
            </button>
        </div>
    );
};

const getActualDimensions = (nodeId: string, defaultWidth: number, defaultHeight: number, cache?: Map<string, {width: number, height: number}>) => {
    if (cache && cache.has(nodeId)) {
        const cached = cache.get(nodeId)!;
        if (cached.width > 0 && cached.height > 0) return cached;
    }
    const el = document.getElementById(`node-${nodeId}`);
    if (el) {
        const dims = { width: el.offsetWidth, height: el.offsetHeight };
        if (dims.width > 0 && dims.height > 0) {
            if (cache) cache.set(nodeId, dims);
            return dims;
        }
    }
    return { width: defaultWidth, height: defaultHeight };
};

const getIntersection = (cx: number, cy: number, ox: number, oy: number, rx: number, ry: number, rw: number, rh: number) => {
    const dx = ox - cx;
    const dy = oy - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    let tMin = Infinity;
    let ix = cx, iy = cy;
    if (dy < 0) {
        const t = (ry - cy) / dy;
        const x = cx + t * dx;
        if (x >= rx && x <= rx + rw && t < tMin) { tMin = t; ix = x; iy = ry; }
    }
    if (dy > 0) {
        const t = (ry + rh - cy) / dy;
        const x = cx + t * dx;
        if (x >= rx && x <= rx + rw && t < tMin) { tMin = t; ix = x; iy = ry + rh; }
    }
    if (dx < 0) {
        const t = (rx - cx) / dx;
        const y = cy + t * dy;
        if (y >= ry && y <= ry + rh && t < tMin) { tMin = t; ix = rx; iy = y; }
    }
    if (dx > 0) {
        const t = (rx + rw - cx) / dx;
        const y = cy + t * dy;
        if (y >= ry && y <= ry + rh && t < tMin) { tMin = t; ix = rx + rw; iy = y; }
    }
    return { x: ix, y: iy };
};

export const LearningCanvas: React.FC<LearningCanvasProps> = ({ 
    library, inbox, inboxTrash, noteTrash, folders, themes, systemLanguage = 'English', isReadOnly = false, canvases, onUpdateCanvases, canCreateCanvas, canUsePremiumFeatures, activeCanvasId, onSelectCanvas, 
    onCapture, onDeleteSignal, onRestoreSignal, onDeleteSignalForever, onKeepSignal, onUpdateNote, onDeleteNote, 
    onRestoreNote, onDeleteNoteForever, onOpenNeuralDump, onSelectionChange,
    canvasTrash, onMoveCanvasToTrash, onRestoreCanvas, onDeleteCanvasForever, onEnterMemoryLab, onGoToLibrary,
    onExitWorkspace, onOpenChat, onAddNote, onAddFolder, onUpdateFolder, onDeleteFolder, onAddTheme, onUpdateTheme, onDeleteTheme,
    isMemoryLabLocked, isNeuralDumpLocked, isInboxLocked, onAIUsage, onLogicGuardUsage
}) => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerActiveTab, setDrawerActiveTab] = useState<'inbox' | 'assets'>('inbox');
    const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
    const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
    const MotionDiv = motion.div as any;
    const AnimatePresenceAny = AnimatePresence as any;
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [activeDragNode, setActiveDragNode] = useState<string | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [dashboardView, setDashboardView] = useState<'active' | 'trash'>('active');
    const [interactionMode, setInteractionMode] = useState<'select' | 'pan'>('select');
    const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
    const [deletedNodes, setDeletedNodes] = useState<CanvasNode[]>([]);
    const [isTrashOpen, setIsTrashOpen] = useState(false);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    
    const [isResizing, setIsResizing] = useState(false);
    const [resizeNodeId, setResizeNodeId] = useState<string | null>(null);
    
    const [editingCanvasTitleId, setEditingCanvasTitleId] = useState<string | null>(null);
    const [tempCanvasTitleVal, setTempCanvasTitleVal] = useState("");

    const [previewSignal, setPreviewSignal] = useState<InboxItem | null>(null);
    const [previewQuizAnswers, setPreviewQuizAnswers] = useState<Record<number, number>>({});

    const [isExporting, setIsExporting] = useState(false);
    const [isThinking, setIsThinking] = useState(false);

    const dragStartValues = useRef<{ mouseX: number, mouseY: number, nodeX: number, nodeY: number, groupNodes?: { id: string, startX: number, startY: number }[] }>({ mouseX: 0, mouseY: 0, nodeX: 0, nodeY: 0 });
    const resizeStartValues = useRef({ mouseX: 0, mouseY: 0, width: 0, height: 0 });
    const gestureStartZoomRef = useRef(1);
    
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [tempNodeContent, setTempNodeContent] = useState("");
    const [tempNodeTitle, setTempNodeTitle] = useState("");
    const [dragWarningItem, setDragWarningItem] = useState<InboxItem | null>(null);
    const warningTimeoutRef = useRef<any>(null);
    
    const [scanningNodeId, setScanningNodeId] = useState<string | null>(null);
    const [expandedCritiques, setExpandedCritiques] = useState<Record<string, boolean>>({});

    const activeCanvas = useMemo(() => canvases?.find(c => c.id === activeCanvasId), [canvases, activeCanvasId]);
    const [localNodes, setLocalNodes] = useState<CanvasNode[]>([]);
    const [localEdges, setLocalEdges] = useState<CanvasEdge[]>([]);
    const [localGroups, setLocalGroups] = useState<CanvasGroup[]>([]);
    const [drawingEdge, setDrawingEdge] = useState<{ sourceId: string, startX: number, startY: number, currentX: number, currentY: number } | null>(null);
    const [reconnectingEdge, setReconnectingEdge] = useState<{ edgeId: string, end: 'source' | 'target', currentX: number, currentY: number } | null>(null);
    const [history, setHistory] = useState<CanvasState[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set());
    const [edgeMenuPosition, setEdgeMenuPosition] = useState<{ x: number, y: number } | null>(null);
    const [lastUsedEdgeColor, setLastUsedEdgeColor] = useState('#CBD5E1');
    const [lastUsedEdgeLabel, setLastUsedEdgeLabel] = useState('');

    const edgeColors = [
        { name: 'Default', value: '#CBD5E1' },
        { name: 'Red', value: '#EF4444' },
        { name: 'Green', value: '#10B981' },
        { name: 'Blue', value: '#3B82F6' },
        { name: 'Purple', value: '#A855F7' },
        { name: 'Amber', value: '#F59E0B' },
        { name: 'Pink', value: '#EC4899' },
        { name: 'Indigo', value: '#6366F1' },
        { name: 'Teal', value: '#14B8A6' },
        { name: 'Lime', value: '#84CC16' },
        { name: 'Orange', value: '#F97316' },
        { name: 'Rose', value: '#F43F5E' },
        { name: 'Cyan', value: '#06B6D4' },
        { name: 'Black', value: '#000000' },
    ];

    const edgeStyles = [
        { name: 'Solid', value: 'solid' },
        { name: 'Dashed', value: 'dashed' },
        { name: 'Dotted', value: 'dotted' },
    ];

    const noteMap = useMemo(() => {
        return new Map(library.map(n => [n.id, n]));
    }, [library]);

    useEffect(() => {
        const timer = setTimeout(() => {
            const container = document.getElementById('canvas-wrapper-id'); 
            if (container) {
                container.focus();
                container.click(); 
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [activeCanvasId]);

    useEffect(() => {
        if (canvasRef.current) {
            canvasRef.current.focus();
        }
    }, [activeCanvasId]);

    const wasSelectedOnDown = useRef(false);
    const hasDragged = useRef(false);

    const nodesRef = useRef<CanvasNode[]>([]);
    const edgesRef = useRef<CanvasEdge[]>([]);
    const groupsRef = useRef<CanvasGroup[]>([]);
    const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);

    const viewportRef = useRef(viewport);
    const nodeDimensionsCache = useRef<Map<string, {width: number, height: number}>>(new Map());
    const [dimensionsVersion, setDimensionsVersion] = useState(0);

    const nodeIds = localNodes.map(n => n.id).join(',');
    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            let changed = false;
            for (const entry of entries) {
                const id = entry.target.id.replace('node-', '');
                const width = entry.borderBoxSize?.[0]?.inlineSize ?? entry.target.getBoundingClientRect().width;
                const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
                const cached = nodeDimensionsCache.current.get(id);
                if (!cached || cached.width !== width || cached.height !== height) {
                    nodeDimensionsCache.current.set(id, { width, height });
                    changed = true;
                }
            }
            if (changed) {
                setDimensionsVersion(v => v + 1);
            }
        });

        const nodeElements = document.querySelectorAll('[id^="node-"]');
        nodeElements.forEach(el => observer.observe(el));

        return () => observer.disconnect();
    }, [nodeIds]);

    useEffect(() => { viewportRef.current = viewport; }, [viewport]);
    useEffect(() => { nodesRef.current = localNodes; }, [localNodes]);
    useEffect(() => { edgesRef.current = localEdges; }, [localEdges]);
    useEffect(() => { groupsRef.current = localGroups; }, [localGroups]);
    useEffect(() => {
        if (onSelectionChange) {
            const selected = localNodes.filter(n => selectedNodeIds.has(n.id));
            onSelectionChange(selected);
        }
    }, [selectedNodeIds, localNodes, onSelectionChange]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const zoomSensitivity = 0.01;
                const zoomFactor = Math.exp(-e.deltaY * zoomSensitivity);
                const currentZoom = viewportRef.current.zoom;
                const newZoom = Math.min(Math.max(currentZoom * zoomFactor, 0.1), 5);
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const newX = mouseX - (mouseX - viewportRef.current.x) * (newZoom / currentZoom);
                const newY = mouseY - (mouseY - viewportRef.current.y) * (newZoom / currentZoom);
                const newState = { x: newX, y: newY, zoom: newZoom };
                viewportRef.current = newState; 
                setViewport(newState);
            } else {
                const newX = viewportRef.current.x - e.deltaX;
                const newY = viewportRef.current.y - e.deltaY;
                const newState = { ...viewportRef.current, x: newX, y: newY };
                viewportRef.current = newState; 
                setViewport(newState);
            }
        };
        const onGestureStart = (e: any) => { e.preventDefault(); gestureStartZoomRef.current = viewportRef.current.zoom; };
        const onGestureChange = (e: any) => { e.preventDefault(); const startZoom = gestureStartZoomRef.current; const newZoom = Math.min(Math.max(startZoom * e.scale, 0.1), 5); const newState = { ...viewportRef.current, zoom: newZoom }; viewportRef.current = newState; setViewport(newState); };
        const onGestureEnd = (e: any) => { e.preventDefault(); };
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('gesturestart', onGestureStart);
        canvas.addEventListener('gesturechange', onGestureChange);
        canvas.addEventListener('gestureend', onGestureEnd);
        return () => {
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('gesturestart', onGestureStart);
            canvas.removeEventListener('gesturechange', onGestureChange);
            canvas.removeEventListener('gestureend', onGestureEnd);
        };
    }, [activeCanvasId]);

    const lastSpacePressRef = useRef<number>(0);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isInputFocused = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName);
            if (!isInputFocused && !editingNodeId) {
                if (e.key === ' ') {
                    const now = Date.now();
                    if (now - lastSpacePressRef.current < 300) {
                        e.preventDefault();
                        if (!isNeuralDumpLocked) {
                            if (selectedEdgeIds.size > 0) {
                                handleEdgeAIAction('neural_dump');
                            } else {
                                onOpenNeuralDump();
                            }
                        }
                        lastSpacePressRef.current = 0;
                    } else {
                        lastSpacePressRef.current = now;
                    }
                } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        redo();
                    } else {
                        undo();
                    }
                } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
                    e.preventDefault();
                    redo();
                } else if (!isReadOnly && (selectedNodeIds.size > 0 || selectedEdgeIds.size > 0) && (e.key === 'Delete' || e.key === 'Backspace')) {
                    e.preventDefault(); 
                    if (selectedNodeIds.size > 0) {
                        const nodesToDelete = Array.from(selectedNodeIds) as string[];
                        nodesToDelete.forEach(id => handleDeleteNode(id));
                        setSelectedNodeIds(new Set());
                    }
                    if (selectedEdgeIds.size > 0) {
                        const newEdges = localEdges.filter(edge => !selectedEdgeIds.has(edge.id));
                        setLocalEdges(newEdges);
                        pushHistory(localNodes, newEdges);
                        setSelectedEdgeIds(new Set());
                        setEdgeMenuPosition(null);
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNodeIds, selectedEdgeIds, localEdges, editingNodeId, localNodes, localGroups, history, historyIndex, isNeuralDumpLocked, onOpenNeuralDump]);

    const currentCanvasIdRef = useRef<string | null>(null);
    const lastProcessedStateRef = useRef<string>('');

    useEffect(() => {
        const restoreData = async () => {
            if (activeCanvas) {
                if (!activeDragNode && !editingNodeId && !isResizing) {
                    const propNodes = activeCanvas.state?.nodes;
                    if (propNodes && propNodes.length > 0) {
                        const stateStr = JSON.stringify({ 
                            nodes: propNodes, 
                            edges: activeCanvas.state?.edges || [], 
                            groups: activeCanvas.state?.groups || [] 
                        });
                        
                        if (stateStr === lastProcessedStateRef.current && currentCanvasIdRef.current === activeCanvas.id) {
                            return;
                        }

                        if (currentCanvasIdRef.current !== activeCanvas.id) {
                            setHistory([]);
                            setHistoryIndex(-1);
                            lastProcessedStateRef.current = '';
                        }

                        const seenIds = new Set<string>();
                        const uniqueNodes = propNodes.map(node => {
                            if (seenIds.has(node.id)) {
                                return { ...node, id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` };
                            }
                            seenIds.add(node.id);
                            return node;
                        });
                        setLocalNodes(uniqueNodes);
                        const seenEdgeIds = new Set<string>();
                        const uniqueEdges = (activeCanvas.state?.edges || []).map(edge => {
                            if (seenEdgeIds.has(edge.id)) {
                                return { ...edge, id: `edge-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` };
                            }
                            seenEdgeIds.add(edge.id);
                            return edge;
                        });
                        setLocalEdges(uniqueEdges);
                        const seenGroupIds = new Set<string>();
                        const uniqueGroups = (activeCanvas.state?.groups || []).map(group => {
                            if (seenGroupIds.has(group.id)) {
                                return { ...group, id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` };
                            }
                            seenGroupIds.add(group.id);
                            return group;
                        });
                        setLocalGroups(uniqueGroups);

                        // Push to history if this is a prop update (e.g. from App.tsx linking a note)
                        // This ensures that Undo/Redo doesn't lose the link
                        const newHistoryStateStr = JSON.stringify({ nodes: uniqueNodes, edges: uniqueEdges, groups: uniqueGroups });
                        lastProcessedStateRef.current = newHistoryStateStr;
                        pushHistory(uniqueNodes, uniqueEdges, uniqueGroups);

                        currentCanvasIdRef.current = activeCanvas.id;
                    } else if (currentCanvasIdRef.current !== activeCanvas.id) {
                        setHistory([]);
                        setHistoryIndex(-1);
                        lastProcessedStateRef.current = '';
                        try {
                            const savedNodes = await loadFromStorage<CanvasNode[]>(`kno_nodes_${activeCanvas.id}`);
                            if (savedNodes && savedNodes.length > 0) {
                                const seenIds = new Set<string>();
                                const uniqueNodes = savedNodes.map(node => {
                                    if (seenIds.has(node.id)) {
                                        return { ...node, id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` };
                                    }
                                    seenIds.add(node.id);
                                    return node;
                                });
                                setLocalNodes(uniqueNodes);
                                const savedEdges = await loadFromStorage<CanvasEdge[]>(`kno_edges_${activeCanvas.id}`);
                                if (savedEdges) {
                                    const seenEdgeIds = new Set<string>();
                                    const uniqueEdges = savedEdges.map(edge => {
                                        if (seenEdgeIds.has(edge.id)) {
                                            return { ...edge, id: `edge-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` };
                                        }
                                        seenEdgeIds.add(edge.id);
                                        return edge;
                                    });
                                    setLocalEdges(uniqueEdges);
                                }
                                const savedGroups = await loadFromStorage<CanvasGroup[]>(`kno_groups_${activeCanvas.id}`);
                                if (savedGroups) {
                                    const seenGroupIds = new Set<string>();
                                    const uniqueGroups = savedGroups.map(group => {
                                        if (seenGroupIds.has(group.id)) {
                                            return { ...group, id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` };
                                        }
                                        seenGroupIds.add(group.id);
                                        return group;
                                    });
                                    setLocalGroups(uniqueGroups);
                                }
                            } else {
                                setLocalNodes([]);
                                setLocalEdges([]);
                                setLocalGroups([]);
                            }
                            currentCanvasIdRef.current = activeCanvas.id;
                        } catch (e) {
                            console.error("Restoration failed", e);
                            setLocalNodes([]);
                            setLocalEdges([]);
                            setLocalGroups([]);
                        } finally {
                            currentCanvasIdRef.current = activeCanvas.id;
                        }
                    } else {
                        // currentCanvasIdRef.current === activeCanvas.id but propNodes is empty
                        // This means the canvas was cleared, so we should clear local state
                        const stateStr = JSON.stringify({ 
                            nodes: [], 
                            edges: activeCanvas.state?.edges || [], 
                            groups: activeCanvas.state?.groups || [] 
                        });
                        
                        if (stateStr === lastProcessedStateRef.current) {
                            return;
                        }
                        
                        setLocalNodes([]);
                        setLocalEdges(activeCanvas.state?.edges || []);
                        setLocalGroups(activeCanvas.state?.groups || []);
                        
                        const newHistoryStateStr = JSON.stringify({ nodes: [], edges: activeCanvas.state?.edges || [], groups: activeCanvas.state?.groups || [] });
                        lastProcessedStateRef.current = newHistoryStateStr;
                        pushHistory([], activeCanvas.state?.edges || [], activeCanvas.state?.groups || []);
                    }
                }
            }
        };
        restoreData();
    }, [activeCanvas]); // Removed activeDragNode, editingNodeId, isResizing to prevent infinite re-renders

    // The saveToStorage logic has been moved to pushHistory to prevent saving on every render/drag step

    const handleExport = async (format: 'pdf' | 'md') => {
        if (!canUsePremiumFeatures('Export')) return;
        if (!activeCanvas) return;
        setIsExporting(true);
        try {
            if (format === 'md') {
                const sourceCount = localNodes.length;
                const fallacyCount = localNodes.filter(n => n.critique?.isSafe === false || n.critique?.structuredAnalysis?.logic.status.toLowerCase().includes('fallacy')).length;
                const insightCount = localNodes.filter(n => ['spark', 'insight', 'synthesis'].includes(n.type)).length;
                let md = `# Kno Brief: ${activeCanvas.title}\n`;
                md += `**Date:** ${new Date().toLocaleDateString(getLocaleString(getSystemLanguage()))}\n\n`;
                md += `## Key Statistics\n`;
                md += `* ${sourceCount} Sources Analyzed\n`;
                md += `* ${fallacyCount} Issues Detected\n`;
                md += `* ${insightCount} Insights Synthesized\n\n`;
                md += `## Neural Audit Details\n\n`;
                localNodes.forEach((node, i) => {
                    md += `### ${i + 1}. ${node.title || 'Untitled'}\n\n`;
                    md += `${node.content || ""}\n\n`;
                    if (node.critique) {
                        const c = node.critique;
                        md += `> **🛡️ TRINITY LOGIC AUDIT**\n`;
                        if (c.structuredAnalysis) {
                            const { factual, balance, logic } = c.structuredAnalysis;
                            md += `> - **FACTUAL:** ${factual.status} - ${factual.issue || 'Verified'}\n`;
                            md += `> - **BALANCE:** ${balance.status} - ${balance.check || 'Balanced'}\n`;
                            md += `> - **LOGIC:** ${logic.status} - ${logic.type} : ${logic.explanation || 'Verified'}\n`;
                        } else {
                            md += `> - **HEALTH:** ${c.isSafe ? 'Stable' : 'Vulnerable'} | ${c.issue}\n`;
                        }
                        md += `\n`;
                    }
                    md += `---\n\n`;
                });
                md += `*Powered by Kno & Gemini 2.0 Flash - Spatial Knowledge OS*`;
                const blob = new Blob([md], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${activeCanvas.title.replace(/\s+/g, '_')}_Brief.md`;
                a.click();
            } else if (format === 'pdf') {
                const doc = new jsPDF({ format: 'a4', unit: 'mm' });
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                let yPos = 20;
                const margin = 20;
                const contentWidth = pageWidth - (margin * 2);
                doc.setFillColor(0, 0, 0); 
                doc.rect(0, 0, pageWidth, 25, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(22);
                doc.setFont("helvetica", "bold");
                doc.text("Kno.", margin, 17);
                doc.setTextColor(0);
                yPos = 35; 
                doc.setFontSize(18);
                doc.setFont("helvetica", "bold");
                doc.text(activeCanvas.title, margin, yPos);
                yPos += 10;
                if (canvasRef.current) {
                    try {
                        const canvasImg = await html2canvas(canvasRef.current, { 
                            scale: 1, 
                            logging: false, 
                            backgroundColor: '#ffffff', 
                            useCORS: true,
                            ignoreElements: (element) => {
                                return element.classList.contains('ui-layer');
                            }
                        });
                        const imgData = canvasImg.toDataURL('image/png');
                        const imgProps = doc.getImageProperties(imgData);
                        const pdfImgHeight = (imgProps.height * contentWidth) / imgProps.width;
                        const maxImgHeight = 60; 
                        doc.addImage(imgData, 'PNG', margin, yPos, contentWidth, Math.min(pdfImgHeight, maxImgHeight));
                        yPos += Math.min(pdfImgHeight, maxImgHeight) + 15;
                    } catch (e) { }
                }
                localNodes.forEach((node, i) => {
                    if (yPos > pageHeight - 40) { doc.addPage(); yPos = 20; }
                    doc.setFontSize(14);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(50, 50, 50); 
                    const rawTitle = `${i + 1}. ${stripStars(node.title || "Untitled")}`;
                    const titleLines = doc.splitTextToSize(rawTitle, contentWidth);
                    doc.text(titleLines, margin, yPos);
                    yPos += (titleLines.length * 6) + 4; 
                    doc.setTextColor(0);
                    doc.setFontSize(10);
                    doc.setFont("helvetica", "normal");
                    const cleanContent = stripStars(node.content || "");
                    const splitContent = doc.splitTextToSize(cleanContent, contentWidth);
                    doc.text(splitContent, margin, yPos);
                    yPos += (splitContent.length * 5) + 5;
                    if (node.critique) {
                        const audit = node.critique.structuredAnalysis || {
                            // Fix: Corrected variable name from note to node to fix 'Cannot find name note' error
                            factual: { status: 'N/A', issue: node.critique.issue || '' },
                            balance: { status: 'N/A', check: '' },
                            logic: { status: node.critique.isSafe ? 'Safe' : 'Issues', type: '', explanation: node.critique.fix || '' }
                        };
                        const clean = (t: string) => (t || "").replace(/[\u{1F600}-\u{1F6FF}|[\u{2600}-\u{26FF}]|\*\*/gu, "");
                        const fText = `FACTUAL: ${clean(audit.factual.status)}\n   Note: ${clean(audit.factual.issue)}`;
                        const bText = `BALANCE: ${clean(audit.balance.status)}\n   Note: ${clean(audit.balance.check)}`;
                        const lText = `LOGIC: ${clean(audit.logic.status)} ${clean(audit.logic.type)}\n   Note: ${clean(audit.logic.explanation)}`;
                        const boxWidth = contentWidth - 10;
                        const fLines = doc.splitTextToSize(fText, boxWidth);
                        const bLines = doc.splitTextToSize(bText, boxWidth);
                        const lLines = doc.splitTextToSize(lText, boxWidth);
                        const padding = 5;
                        const lineHeight = 5;
                        const blockSpacing = 3;
                        const totalLines = fLines.length + bLines.length + lLines.length;
                        const boxHeight = (totalLines * lineHeight) + (padding * 2) + (blockSpacing * 2);
                        if (yPos + boxHeight > pageHeight - 20) { doc.addPage(); yPos = 20; }
                        doc.setFillColor(248, 250, 252); 
                        doc.setDrawColor(200, 200, 200);
                        doc.roundedRect(margin, yPos, contentWidth, boxHeight, 3, 3, 'FD');
                        let textY = yPos + padding + 4; 
                        doc.text(fLines, margin + 5, textY);
                        textY += (fLines.length * lineHeight) + blockSpacing;
                        doc.text(bLines, margin + 5, textY);
                        textY += (bLines.length * lineHeight) + blockSpacing;
                        doc.text(lLines, margin + 5, textY);
                        yPos += boxHeight + 10;
                    }
                    yPos += 5;
                });
                doc.save(`${activeCanvas.title.replace(/\s+/g, '_')}_InsightBrief.pdf`);
            }
        } catch (e) {
            console.error("Export Failed", e);
        } finally {
            setIsExporting(false);
        }
    };

    const handleCanvasDrop = (e: React.DragEvent) => {
        e.preventDefault();
        
        if (isReadOnly) {
            alert("Read-Only Mode: You cannot add items to the canvas within Kno while on the Free plan or without an active license.");
            return;
        }

        const type = e.dataTransfer.getData('type');
        const zoom = viewport.zoom;
        const rect = canvasRef.current?.getBoundingClientRect();
        const offsetX = rect ? rect.left : 0;
        const offsetY = rect ? rect.top : 0;
        const dropX = (e.clientX - offsetX - viewport.x) / zoom;
        const dropY = (e.clientY - offsetY - viewport.y) / zoom;

        if (type === 'LINK' || e.dataTransfer.getData('noteId')) {
            const dataStr = e.dataTransfer.getData('application/json');
            let noteId = e.dataTransfer.getData('noteId') || e.dataTransfer.getData('id');
            let title = "Dropped Note";
            let content = "";
            if (dataStr) {
                try {
                    const data = JSON.parse(dataStr);
                    if (!noteId) noteId = data.id;
                    title = data.title;
                    if (data.url) title = data.title;
                } catch(e) {}
            }
            const note = library.find(n => n.id === noteId);
            if (note) {
                title = note.title;
                content = (note.summary || []).join('\n\n');
            }
            const folder = folders.find(f => f.id === note?.folder);
            const newNode: CanvasNode = {
                id: `node-link-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                type: (note?.type as any) || 'note',
                noteId: noteId,
                title: title,
                content: content,
                x: dropX - 125,
                y: dropY - 75,
                width: 250,
                folderId: note?.folder,
                themeId: note?.theme,
                originalFolderId: note?.folder,
                originalThemeId: note?.theme,
                customColor: folder?.color
            };

            // Check if dropped into a folder or theme group
            const folderNode = localNodes.find(n => 
                n.type === 'folder' && 
                newNode.x > n.x && newNode.x < n.x + (n.width || 250) &&
                newNode.y > n.y && newNode.y < n.y + 200
            );
            
            const themeGroup = localGroups.find(g => 
                g.themeId &&
                newNode.x > g.x && newNode.x < g.x + g.width &&
                newNode.y > g.y && newNode.y < g.y + g.height
            );

            let updatedNoteData: any = {};
            let shouldUpdateNote = false;

            if (folderNode && folderNode.folderId) {
                newNode.folderId = folderNode.folderId;
                const folder = folders.find(f => f.id === folderNode.folderId);
                if (folder) newNode.customColor = folder.color;
                updatedNoteData.folder = folderNode.folderId;
                shouldUpdateNote = true;
            }

            if (themeGroup && themeGroup.themeId) {
                newNode.themeId = themeGroup.themeId;
                updatedNoteData.theme = themeGroup.themeId;
                shouldUpdateNote = true;
            }

            if (shouldUpdateNote && note) {
                onUpdateNote({
                    ...note,
                    ...updatedNoteData
                });
            }

            const newNodes = [...localNodes, newNode];
            setLocalNodes(newNodes);
            pushHistory(newNodes, localEdges);
            return;
        } else if (type === 'signal') {
             const signalId = e.dataTransfer.getData('id');
             const item = inbox.find(i => i.id === signalId);
             if (item) {
                 const newNode: CanvasNode = {
                    id: `node-signal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    type: 'note',
                    title: item.title,
                    content: (item.summary || []).join('\n\n'),
                    x: dropX - 125,
                    y: dropY - 75,
                    width: 250
                };
                const newNodes = [...localNodes, newNode];
                setLocalNodes(newNodes);
                pushHistory(newNodes, localEdges);
             }
             return;
        }
        
        const themeId = e.dataTransfer.getData('themeId');
        if (themeId) {
            const theme = themes.find(t => t.id === themeId);
            if (theme) {
                // Find if dropped on a node
                const targetNode = localNodes.find(n => 
                    dropX > n.x && dropX < n.x + (n.width || 250) &&
                    dropY > n.y && dropY < n.y + 200
                );
                
                if (targetNode && targetNode.noteId) {
                    const note = library.find(n => n.id === targetNode.noteId);
                    if (note) {
                        onUpdateNote({
                            ...note,
                            theme: theme.id
                        });
                    }
                } else {
                    // Create a theme group on the canvas
                    const newGroup: CanvasGroup = {
                        id: `group-theme-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                        themeId: theme.id,
                        title: theme.name,
                        x: dropX - 200,
                        y: dropY - 150,
                        width: 400,
                        height: 300,
                        color: theme.color
                    };
                    const newGroups = [...localGroups, newGroup];
                    setLocalGroups(newGroups);
                    pushHistory(localNodes, localEdges, newGroups);
                }
            }
            return;
        }

        // Handle File Drops (PDF, Excel, Doc, etc.)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            let loadedCount = 0;
            const newNodesToAdd: CanvasNode[] = [];
            
            files.forEach((f, index) => {
                const file = f as File;
                const reader = new FileReader();
                reader.onload = (event) => {
                    const target = event.target as FileReader;
                    if (target?.result) {
                        let folderId = undefined;
                        let themeId = undefined;
                        let customColor = undefined;

                        const fileX = dropX + (index * 20);
                        const fileY = dropY + (index * 20);

                        const folderNode = localNodes.find(n => 
                            n.type === 'folder' && 
                            fileX > n.x && fileX < n.x + (n.width || 250) &&
                            fileY > n.y && fileY < n.y + 200
                        );
                        
                        const themeGroup = localGroups.find(g => 
                            g.themeId &&
                            fileX > g.x && fileX < g.x + g.width &&
                            fileY > g.y && fileY < g.y + g.height
                        );

                        if (folderNode && folderNode.folderId) {
                            folderId = folderNode.folderId;
                            const folder = folders.find(f => f.id === folderNode.folderId);
                            if (folder) customColor = folder.color;
                        }
                        if (themeGroup && themeGroup.themeId) {
                            themeId = themeGroup.themeId;
                        }

                        const noteId = `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                        const newNote: Note = {
                            id: noteId,
                            title: file.name,
                            summary: [`Dropped ${file.type || 'file'}`],
                            tags: [],
                            createdAt: Date.now(),
                            lastReviewedAt: Date.now(),
                            reviewCount: 0,
                            needsRevision: false,
                            platform: Platform.MANUAL,
                            userFiles: [target.result as string],
                            sourceUrl: '',
                            quizAttempts: [],
                            folder: folderId,
                            theme: themeId
                        };
                        
                        if (onAddNote) onAddNote(newNote);

                        const newNode: CanvasNode = {
                            id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            x: fileX,
                            y: fileY,
                            width: 250,
                            height: 200,
                            title: file.name,
                            content: `Dropped ${file.type || 'file'}`,
                            type: 'note',
                            source: 'manual',
                            noteId: noteId,
                            synthesisHistory: [{ title: file.name, content: `Dropped ${file.type || 'file'}`, timestamp: Date.now() }],
                            historyIndex: 0,
                            folderId,
                            themeId,
                            customColor
                        };
                        
                        newNodesToAdd.push(newNode);
                    }
                    loadedCount++;
                    if (loadedCount === files.length) {
                        setLocalNodes(prev => {
                            const updatedNodes = [...prev, ...newNodesToAdd];
                            // Use setTimeout to ensure pushHistory captures the latest state after setLocalNodes
                            setTimeout(() => pushHistory(updatedNodes, edgesRef.current, groupsRef.current), 0);
                            return updatedNodes;
                        });
                    }
                };
                reader.readAsDataURL(file);
            });
            return;
        }
    };

    const handleSaveNodeEdit = useCallback(() => {
        if (!editingNodeId) return;
        const updatedNodes = localNodes.map(n => {
            if (n.id === editingNodeId) {
                const updatedNode = { ...n, title: tempNodeTitle, content: tempNodeContent };
                if (n.noteId && onUpdateNote) {
                    const linkedNote = library.find(l => l.id === n.noteId);
                    if (linkedNote) {
                        onUpdateNote({ ...linkedNote, title: tempNodeTitle, content: tempNodeContent });
                    }
                }
                return updatedNode;
            }
            return n;
        });
        setLocalNodes(updatedNodes);
        pushHistory(updatedNodes, localEdges);
        setEditingNodeId(null);
    }, [editingNodeId, localNodes, localEdges, tempNodeTitle, tempNodeContent, library, onUpdateNote]);

    const handleStartCanvasRename = (e: React.MouseEvent, canvas: CanvasDocument) => {
        e.stopPropagation();
        if (isReadOnly) return;
        setEditingCanvasTitleId(canvas.id);
        setTempCanvasTitleVal(canvas.title);
    };

    const handleSaveCanvasRename = (e?: React.SyntheticEvent) => {
        if (e) e.stopPropagation();
        if (editingCanvasTitleId) {
            const updated = canvases.map(c => c.id === editingCanvasTitleId ? { ...c, title: tempCanvasTitleVal || "Untitled Canvas" } : c);
            onUpdateCanvases(updated);
            setEditingCanvasTitleId(null);
        }
    };

    const handleCanvasPaste = (e: React.ClipboardEvent) => {
        if (editingNodeId) return; // Don't intercept if editing a node
        
        if (isReadOnly) {
            e.preventDefault();
            alert("Read-Only Mode: You cannot paste new notes within Kno while on the Free plan or without an active license.");
            return;
        }

        const items = e.clipboardData?.items;
        const text = e.clipboardData?.getData('text');
        
        const zoom = viewport.zoom;
        // Default to center of viewport if no mouse position
        const clickX = (-viewport.x + window.innerWidth / 2) / zoom;
        const clickY = (-viewport.y + window.innerHeight / 2) / zoom;
        
        const createPastedNode = (title: string, content: string, type: 'note' | 'asset' | 'spark' | 'collision' = 'note', files: string[] = []) => {
            const noteId = `note-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            const newNote: Note = {
                id: noteId,
                title: title,
                summary: [content],
                tags: [],
                createdAt: Date.now(),
                lastReviewedAt: Date.now(),
                reviewCount: 0,
                needsRevision: false,
                platform: Platform.MANUAL,
                userFiles: files,
                sourceUrl: '',
                quizAttempts: []
            };
            
            if (onAddNote) onAddNote(newNote);

            const newNode: CanvasNode = {
                id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                x: clickX,
                y: clickY,
                width: 250,
                height: 200,
                title: title,
                content: content,
                type: type as NodeType,
                source: 'manual',
                noteId: noteId,
                synthesisHistory: [{ title: title, content: content, timestamp: Date.now() }],
                historyIndex: 0
            };
            
            setLocalNodes(prev => [...prev, newNode]);
        };

        if (items) {
            let hasFile = false;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1 || items[i].type.indexOf("video") !== -1 || items[i].type.indexOf("application") !== -1) {
                    hasFile = true;
                    const blob = items[i].getAsFile();
                    const reader = new FileReader();
                    reader.onload = (event) => { 
                        const target = event.target as FileReader; 
                        if (target?.result) { 
                            const fileName = blob?.name || 'Pasted File';
                            createPastedNode(fileName, `Pasted ${items[i].type}`, 'note', [target.result as string]);
                        }
                    };
                    if (blob) reader.readAsDataURL(blob);
                }
            }
            if (hasFile) return;
        }
        
        if (text) {
            let title = "Pasted Text";
            if (text.startsWith('http')) {
                title = "Pasted Link";
            }
            createPastedNode(title, text);
        }
    };

    const handleCanvasDoubleClick = (e: React.MouseEvent) => {
        if (e.target !== canvasRef.current && e.target !== e.currentTarget) return;
        if (isReadOnly) {
            alert("Read-Only Mode: You cannot create new notes within Kno while on the Free plan or without an active license.");
            return;
        }
        const zoom = viewport.zoom;
        const rect = canvasRef.current?.getBoundingClientRect();
        const offsetX = rect ? rect.left : 0;
        const offsetY = rect ? rect.top : 0;
        const clickX = (e.clientX - offsetX - viewport.x) / zoom;
        const clickY = (e.clientY - offsetY - viewport.y) / zoom;

        let folderId = undefined;
        let themeId = undefined;
        let customColor = undefined;

        const folderNode = localNodes.find(n => 
            n.type === 'folder' && 
            clickX > n.x && clickX < n.x + (n.width || 250) &&
            clickY > n.y && clickY < n.y + 200
        );
        
        const themeGroup = localGroups.find(g => 
            g.themeId &&
            clickX > g.x && clickX < g.x + g.width &&
            clickY > g.y && clickY < g.y + g.height
        );

        if (folderNode && folderNode.folderId) {
            folderId = folderNode.folderId;
            const folder = folders.find(f => f.id === folderNode.folderId);
            if (folder) customColor = folder.color;
        }
        if (themeGroup && themeGroup.themeId) {
            themeId = themeGroup.themeId;
        }
        
        const noteId = `note-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const newNote: Note = {
            id: noteId,
            title: "New Note",
            summary: [],
            tags: [],
            createdAt: Date.now(),
            lastReviewedAt: Date.now(),
            reviewCount: 0,
            needsRevision: false,
            platform: Platform.MANUAL,
            sourceUrl: '',
            quizAttempts: [],
            folder: folderId,
            theme: themeId
        };
        
        if (onAddNote) {
            onAddNote(newNote);
        }

        const newNode: CanvasNode = {
            id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            x: clickX,
            y: clickY,
            width: 250,
            height: 200,
            title: "New Note",
            content: "",
            type: "note",
            source: 'manual',
            noteId: noteId,
            synthesisHistory: [{ title: "New Note", content: "", timestamp: Date.now() }],
            historyIndex: 0,
            folderId,
            themeId,
            customColor
        };
        
        setLocalNodes(prev => [...prev, newNode]);
        setEditingNodeId(newNode.id);
        setTempNodeTitle(newNode.title);
        setTempNodeContent(newNode.content);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0) return;
        if (editingNodeId) handleSaveNodeEdit();
        if (!activeDragNode && !isResizing) {
            if (interactionMode === 'pan') {
                setIsDraggingCanvas(true);
                setDragStart({ x: e.clientX, y: e.clientY });
                (e.currentTarget as Element).setPointerCapture(e.pointerId);
                return;
            }
            if (e.target === canvasRef.current || e.target === e.currentTarget || (e.target as Element).id === 'canvas-inner-id') {
                setSelectedNodeIds(new Set());
                setSelectedEdgeIds(new Set());
                setEdgeMenuPosition(null);
                
                if (isReadOnly) return; // Prevent selection box in read-only mode, or keep it, up to you. But we should allow selection, just not dragging.
                
                setIsSelecting(true);
                const zoom = viewport.zoom;
                const rect = canvasRef.current?.getBoundingClientRect();
                const offsetX = rect ? rect.left : 0;
                const offsetY = rect ? rect.top : 0;
                const startX = (e.clientX - offsetX - viewport.x) / zoom;
                const startY = (e.clientY - offsetY - viewport.y) / zoom;
                setSelectionBox({ startX, startY, endX: startX, endY: startY });
            }
            setDragStart({ x: e.clientX, y: e.clientY });
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
        }
    };

    const handleResizeStart = (e: React.PointerEvent, node: CanvasNode) => {
        if (interactionMode === 'pan' || isReadOnly) return;
        e.stopPropagation();
        setIsResizing(true);
        setResizeNodeId(node.id);
        resizeStartValues.current = { mouseX: e.clientX, mouseY: e.clientY, width: node.width || 250, height: node.height || 200 };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };

    useEffect(() => {
        const handleWindowPointerUp = () => {
            if (drawingEdge) setDrawingEdge(null);
            if (reconnectingEdge) setReconnectingEdge(null);
            if (isResizing) {
                setIsResizing(false);
                setResizeNodeId(null);
            }
            if (isDraggingCanvas) setIsDraggingCanvas(false);
            if (activeDragNode) setActiveDragNode(null);
        };
        window.addEventListener('pointerup', handleWindowPointerUp);
        return () => window.removeEventListener('pointerup', handleWindowPointerUp);
    }, [drawingEdge, reconnectingEdge, isResizing, isDraggingCanvas, activeDragNode]);

    const handlePointerMove = (e: React.PointerEvent) => {
        if (drawingEdge) {
            const zoom = viewport.zoom;
            const rect = canvasRef.current?.getBoundingClientRect();
            const offsetX = rect ? rect.left : 0;
            const offsetY = rect ? rect.top : 0;
            const currentX = (e.clientX - offsetX - viewport.x) / zoom;
            const currentY = (e.clientY - offsetY - viewport.y) / zoom;
            setDrawingEdge(prev => prev ? { ...prev, currentX, currentY } : null);
        } else if (reconnectingEdge) {
            const zoom = viewport.zoom;
            const rect = canvasRef.current?.getBoundingClientRect();
            const offsetX = rect ? rect.left : 0;
            const offsetY = rect ? rect.top : 0;
            const currentX = (e.clientX - offsetX - viewport.x) / zoom;
            const currentY = (e.clientY - offsetY - viewport.y) / zoom;
            setReconnectingEdge(prev => prev ? { ...prev, currentX, currentY } : null);
        } else if (isResizing && resizeNodeId) {
            const dx = (e.clientX - resizeStartValues.current.mouseX) / viewport.zoom;
            const dy = (e.clientY - resizeStartValues.current.mouseY) / viewport.zoom;
            
            if (resizeNodeId.startsWith('group-')) {
                const newWidth = Math.max(200, resizeStartValues.current.width + dx);
                const newHeight = Math.max(200, resizeStartValues.current.height + dy);
                setLocalGroups(groups => groups.map(g => g.id === resizeNodeId ? { ...g, width: newWidth, height: newHeight } : g));
            } else {
                const newWidth = Math.max(200, resizeStartValues.current.width + dx);
                setLocalNodes(nodes => nodes.map(n => n.id === resizeNodeId ? { ...n, width: newWidth } : n));
            }
        } else if (isSelecting && selectionBox) {
            const zoom = viewport.zoom;
            const rect = canvasRef.current?.getBoundingClientRect();
            const offsetX = rect ? rect.left : 0;
            const offsetY = rect ? rect.top : 0;
            const endX = (e.clientX - offsetX - viewport.x) / zoom;
            const endY = (e.clientY - offsetY - viewport.y) / zoom;
            setSelectionBox(prev => prev ? { ...prev, endX, endY } : null);
        } else if (isDraggingCanvas) {
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;
            setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            setDragStart({ x: e.clientX, y: e.clientY });
        } else if (activeDragNode) {
            setEdgeMenuPosition(null);
            const dx = (e.clientX - dragStartValues.current.mouseX) / viewport.zoom;
            const dy = (e.clientY - dragStartValues.current.mouseY) / viewport.zoom;
            const dist = Math.hypot(e.clientX - dragStartValues.current.mouseX, e.clientY - dragStartValues.current.mouseY);
            if (dist > 5) hasDragged.current = true;
            const newX = dragStartValues.current.nodeX + dx;
            const newY = dragStartValues.current.nodeY + dy;
            
            // Check if dragging a group
            if (activeDragNode.startsWith('group-')) {
                setLocalGroups(groups => groups.map(g => g.id === activeDragNode ? { ...g, x: newX, y: newY } : g));
                
                // Move nodes inside the group
                if (dragStartValues.current.groupNodes && dragStartValues.current.groupNodes.length > 0) {
                    const groupNodes = dragStartValues.current.groupNodes;
                    setLocalNodes(nodes => nodes.map(n => {
                        const gn = groupNodes.find(g => g.id === n.id);
                        if (gn) {
                            return { ...n, x: gn.startX + dx, y: gn.startY + dy };
                        }
                        return n;
                    }));
                }
            } else {
                setLocalNodes(nodes => nodes.map(n => n.id === activeDragNode ? { ...n, x: newX, y: newY } : n));
            }
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (drawingEdge) {
            const elements = document.elementsFromPoint(e.clientX, e.clientY);
            const nodeElement = elements.find(el => el.closest('[id^="node-"]'))?.closest('[id^="node-"]');
            if (nodeElement) {
                const targetNodeId = nodeElement.id.replace('node-', '');
                const targetNode = localNodes.find(n => n.id === targetNodeId);
                if (targetNode && drawingEdge.sourceId !== targetNode.id) {
                    const newEdge: CanvasEdge = {
                        id: Date.now().toString(),
                        source: drawingEdge.sourceId,
                        target: targetNode.id,
                        label: ''
                    };
                    const newEdges = [...localEdges, newEdge];
                    setLocalEdges(newEdges);
                    pushHistory(localNodes, newEdges);
                }
            }
            setDrawingEdge(null);
        }
        if (reconnectingEdge) {
            const elements = document.elementsFromPoint(e.clientX, e.clientY);
            const nodeElement = elements.find(el => el.closest('[id^="node-"]'))?.closest('[id^="node-"]');
            if (nodeElement) {
                const targetNodeId = nodeElement.id.replace('node-', '');
                const targetNode = localNodes.find(n => n.id === targetNodeId);
                if (targetNode) {
                    const edge = localEdges.find(e => e.id === reconnectingEdge.edgeId);
                    if (edge) {
                        if (reconnectingEdge.end === 'source' && targetNode.id !== edge.source && targetNode.id !== edge.target) {
                            const newEdges = localEdges.map(e => e.id === edge.id ? { ...e, source: targetNode.id } : e);
                            setLocalEdges(newEdges);
                            pushHistory(localNodes, newEdges);
                        } else if (reconnectingEdge.end === 'target' && targetNode.id !== edge.target && targetNode.id !== edge.source) {
                            const newEdges = localEdges.map(e => e.id === edge.id ? { ...e, target: targetNode.id } : e);
                            setLocalEdges(newEdges);
                            pushHistory(localNodes, newEdges);
                        }
                    }
                }
            }
            setReconnectingEdge(null);
        }
        if (isSelecting && selectionBox) {
            const x1 = Math.min(selectionBox.startX, selectionBox.endX);
            const x2 = Math.max(selectionBox.startX, selectionBox.endX);
            const y1 = Math.min(selectionBox.startY, selectionBox.endY);
            const y2 = Math.max(selectionBox.startY, selectionBox.endY);
            
            const newlySelected = localNodes.filter(n => {
                const nx = n.x;
                const ny = n.y;
                const nw = n.width || 250;
                const nh = n.height || 200; // default height
                return nx < x2 && nx + nw > x1 && ny < y2 && ny + nh > y1;
            }).map(n => n.id);
            
            setSelectedNodeIds(new Set(newlySelected));
            setIsSelecting(false);
            setSelectionBox(null);
        }
        if (activeDragNode) {
            // Check for folder or theme drop
            const draggedNode = localNodes.find(n => n.id === activeDragNode);
            if (draggedNode && draggedNode.type !== 'folder') {
                // Check for folder drop
                const folderNode = localNodes.find(n => 
                    n.type === 'folder' && 
                    draggedNode.x > n.x && draggedNode.x < n.x + (n.width || 250) &&
                    draggedNode.y > n.y && draggedNode.y < n.y + 200
                );
                
                // Check for theme group drop
                const themeGroup = localGroups.find(g => 
                    g.themeId &&
                    draggedNode.x > g.x && draggedNode.x < g.x + g.width &&
                    draggedNode.y > g.y && draggedNode.y < g.y + g.height
                );

                let newFolderId = undefined;
                let newThemeId = undefined;
                let newCustomColor = undefined;
                let updatedNoteData: any = {};
                let shouldUpdateNote = false;

                if (folderNode && folderNode.folderId) {
                    newFolderId = folderNode.folderId;
                    const folder = folders.find(f => f.id === folderNode.folderId);
                    if (folder) newCustomColor = folder.color;
                    updatedNoteData.folder = folderNode.folderId;
                    shouldUpdateNote = true;
                } else if (draggedNode.folderId) {
                    const folderNodeExistsOnCanvas = localNodes.some(n => n.type === 'folder' && n.folderId === draggedNode.folderId);
                    if (folderNodeExistsOnCanvas) {
                        updatedNoteData.folder = undefined;
                        shouldUpdateNote = true;
                    } else {
                        newFolderId = draggedNode.folderId;
                        newCustomColor = draggedNode.customColor;
                    }
                }

                if (themeGroup && themeGroup.themeId) {
                    newThemeId = themeGroup.themeId;
                    updatedNoteData.theme = themeGroup.themeId;
                    shouldUpdateNote = true;
                } else if (draggedNode.themeId) {
                    const themeGroupExistsOnCanvas = localGroups.some(g => g.themeId === draggedNode.themeId);
                    if (themeGroupExistsOnCanvas) {
                        updatedNoteData.theme = undefined;
                        shouldUpdateNote = true;
                    } else {
                        newThemeId = draggedNode.themeId;
                    }
                }

                // Check if dropped on a folder in the sidebar
                const draggedElement = document.getElementById(`node-${activeDragNode}`);
                if (draggedElement) draggedElement.style.visibility = 'hidden';
                const elementUnderPointer = document.elementFromPoint(e.clientX, e.clientY);
                if (draggedElement) draggedElement.style.visibility = 'visible';
                
                const sidebarFolder = elementUnderPointer?.closest('[data-folder-id]');
                if (sidebarFolder) {
                    const sidebarFolderId = sidebarFolder.getAttribute('data-folder-id');
                    if (sidebarFolderId) {
                        newFolderId = sidebarFolderId;
                        const folder = folders.find(f => f.id === sidebarFolderId);
                        if (folder) newCustomColor = folder.color;
                        updatedNoteData.folder = sidebarFolderId;
                        shouldUpdateNote = true;
                    }
                }

                const targetNoteId = draggedNode.noteId || draggedNode.id;
                let newNoteId = undefined;
                if (shouldUpdateNote && targetNoteId) {
                    const note = library.find(n => n.id === targetNoteId);
                    if (note) {
                        onUpdateNote({ 
                            ...note, 
                            ...updatedNoteData
                        });
                    } else if (draggedNode.source === 'neural_dump' || draggedNode.type === 'spark' || draggedNode.type === 'collision' || draggedNode.type === 'synthesis' || draggedNode.type === 'asset') {
                        // If it's a special node not yet in library, save it now with the theme/folder
                        const noteType = draggedNode.type === 'spark' ? 'spark' : 
                                         draggedNode.type === 'collision' || draggedNode.type === 'synthesis' ? 'collision' : 
                                         draggedNode.type === 'asset' ? 'asset' : 'note';
                        
                        const newNote: Note = {
                            id: draggedNode.id,
                            title: draggedNode.title || "Generated Insight",
                            summary: [draggedNode.content || ""],
                            type: noteType as any,
                            createdAt: Date.now(),
                            lastReviewedAt: Date.now(),
                            reviewCount: 0,
                            platform: Platform.GENERIC,
                            sourceUrl: draggedNode.source === 'neural_dump' ? 'neural://dump' : '',
                            tags: [],
                            quizAttempts: [],
                            needsRevision: false,
                            folder: newFolderId,
                            theme: newThemeId
                        };
                        if (onAddNote) onAddNote(newNote);
                        newNoteId = newNote.id;
                    }
                }

                const newNodes = nodesRef.current.map(n => {
                    if (n.id === activeDragNode) {
                        return { 
                            ...n, 
                            folderId: newFolderId,
                            themeId: newThemeId,
                            customColor: newCustomColor,
                            ...(newNoteId ? { noteId: newNoteId } : {})
                        };
                    }
                    return n;
                });
                
                setLocalNodes(newNodes);
                pushHistory(newNodes, edgesRef.current, groupsRef.current);
            } else {
                pushHistory(nodesRef.current, edgesRef.current, groupsRef.current);
            }

            if (!hasDragged.current && !editingNodeId && wasSelectedOnDown.current) {
                setSelectedNodeIds(prev => {
                    const next = new Set(prev);
                    if (typeof activeDragNode === 'string') { next.delete(activeDragNode); }
                    return next;
                });
            }
        }
        if (isResizing) {
            pushHistory(nodesRef.current, edgesRef.current, groupsRef.current);
            setIsResizing(false);
            setResizeNodeId(null);
        }
        setIsDraggingCanvas(false);
        setActiveDragNode(null);
        if (e.currentTarget instanceof Element) { e.currentTarget.releasePointerCapture(e.pointerId); }
    };

    const handleCanvasDragOver = (e: React.DragEvent) => {
        e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
    };

    const handleEdgeDrawStart = (e: React.PointerEvent, node: CanvasNode) => {
        if (interactionMode === 'pan' || isReadOnly) return;
        e.stopPropagation();
        const zoom = viewport.zoom;
        const rect = canvasRef.current?.getBoundingClientRect();
        const offsetX = rect ? rect.left : 0;
        const offsetY = rect ? rect.top : 0;
        const startX = (e.clientX - offsetX - viewport.x) / zoom;
        const startY = (e.clientY - offsetY - viewport.y) / zoom;
        setDrawingEdge({ sourceId: node.id, startX, startY, currentX: startX, currentY: startY });
    };

    const handleEdgeClick = (e: React.MouseEvent | React.PointerEvent, edgeId: string) => {
        if (interactionMode === 'pan') return;
        e.stopPropagation();
        const isShift = e.shiftKey;
        setSelectedEdgeIds(prev => {
            const next = new Set(prev);
            if (isShift) {
                if (next.has(edgeId)) next.delete(edgeId);
                else next.add(edgeId);
            } else {
                next.clear();
                next.add(edgeId);
            }
            return next;
        });
        const edge = edgesRef.current.find(e => e.id === edgeId);
        if (edge) {
            const source = nodesRef.current.find(n => n.id === edge.source);
            const target = nodesRef.current.find(n => n.id === edge.target);
            if (source && target) {
                const sx = source.x + (source.width || 250) / 2;
                const sy = source.y + 75;
                const tx = target.x + (target.width || 250) / 2;
                const ty = target.y + 75;
                setEdgeMenuPosition({ x: (sx + tx) / 2, y: (sy + ty) / 2 });
            }
        }
    };

    const updateSelectedEdges = (updates: Partial<CanvasEdge>) => {
        if (isReadOnly) return;
        if (updates.color) setLastUsedEdgeColor(updates.color);
        if (updates.label !== undefined) setLastUsedEdgeLabel(updates.label);
        setLocalEdges(prev => {
            const next = prev.map(e => selectedEdgeIds.has(e.id) ? { ...e, ...updates } : e);
            pushHistory(localNodes, next);
            return next;
        });
    };

    const selectConnectedPath = (startEdgeId: string) => {
        const connected = new Set<string>();
        const queue = [startEdgeId];
        while (queue.length > 0) {
            const id = queue.shift()!;
            if (connected.has(id)) continue;
            connected.add(id);
            const edge = localEdges.find(e => e.id === id);
            if (edge) {
                // Find edges sharing source or target
                localEdges.forEach(e => {
                    if (e.id === id) return;
                    if (e.source === edge.source || e.source === edge.target || e.target === edge.source || e.target === edge.target) {
                        queue.push(e.id);
                    }
                });
            }
        }
        setSelectedEdgeIds(connected);
    };

    const handleNeuralDumpOnEdge = async (edgeIds: string[]) => {
        if (!canUsePremiumFeatures('NeuralDump')) return;
        const edges = localEdges.filter(e => edgeIds.includes(e.id));
        if (edges.length === 0) return;
        
        const nodeIds = new Set<string>();
        edges.forEach(e => { nodeIds.add(e.source); nodeIds.add(e.target); });
        const nodes = localNodes.filter(n => nodeIds.has(n.id));
        if (nodes.length < 2) return;
        
        const dumpId = `neural-dump-${Date.now()}`;
        const avgX = nodes.reduce((acc, n) => acc + n.x, 0) / nodes.length;
        const avgY = nodes.reduce((acc, n) => acc + n.y, 0) / nodes.length + 300;
        
        const dumpNode: CanvasNode = {
            id: dumpId,
            type: 'note',
            title: "Neural Mapping...",
            content: "",
            x: avgX,
            y: avgY,
            width: 400,
            isThinking: true,
            color: '#3B82F6',
            source: 'neural_dump'
        };
        
        setLocalNodes(prev => [...prev, dumpNode]);
        setSelectedEdgeIds(new Set());
        setEdgeMenuPosition(null);
        
        try {
            const inputs = nodes.map((n, i) => `${i+1}. ${n.title}: ${n.content}`).join('\n');
            const prompt = `Role: Knowledge Architect. Analyze the conceptual connection between these ${nodes.length} nodes:\n${inputs}\n\nProvide a deep neural dump of how these concepts interact, their dependencies, and hidden implications as a whole. Output JSON: { "title": "Neural Mapping: ${nodes.length} Concepts", "content": "Detailed analysis..." }. Respond entirely in ${systemLanguage || 'English'}.`;
            const response = await getAI().models.generateContent({ model: getModel('LogicGuard'), contents: prompt, config: { responseMimeType: 'application/json' } });
            onAIUsage?.();
            const data = cleanJson(response.text) as any;
            
            setLocalNodes(prev => prev.map(n => n.id === dumpId ? { ...n, title: data.title, content: data.content, isThinking: false } : n));
            setLocalEdges(prev => prev.map(e => edgeIds.includes(e.id) ? { ...e, type: 'neural' } : e));
            
            const finalNode = { ...dumpNode, title: data.title, content: data.content, isThinking: false };
            saveSpecialNodeToLibrary(finalNode, 'note');
        } catch (e) {
            console.error("Neural Dump Error", e);
            setLocalNodes(prev => prev.filter(n => n.id !== dumpId));
        }
    };

    const handleEdgeAIAction = (action: string) => {
        if (selectedEdgeIds.size === 0) return;
        const edges = localEdges.filter(e => selectedEdgeIds.has(e.id));
        const nodeIds = new Set<string>();
        edges.forEach(e => { nodeIds.add(e.source); nodeIds.add(e.target); });
        const nodes = localNodes.filter(n => nodeIds.has(n.id));
        if (nodes.length < 2) return;

        switch (action) {
            case 'collider':
                handleCollider(nodes);
                break;
            case 'alchemy':
                setSelectedNodeIds(new Set(nodes.map(n => n.id)));
                handleAlchemy();
                break;
            case 'spark':
                setSelectedNodeIds(new Set([nodes[0].id]));
                handleSpark();
                break;
            case 'logic_guard':
                edges.forEach(edge => runLogicGuardOnEdge(edge, edge.source, edge.target));
                break;
            case 'neural_dump':
                handleNeuralDumpOnEdge(Array.from(selectedEdgeIds));
                break;
        }
        setSelectedEdgeIds(new Set());
        setEdgeMenuPosition(null);
    };

    const handleEdgeDrawEnd = async (e: React.PointerEvent, targetNode: CanvasNode) => {
        e.stopPropagation();
        if (isReadOnly) {
            setDrawingEdge(null);
            setReconnectingEdge(null);
            return;
        }
        if (drawingEdge && drawingEdge.sourceId !== targetNode.id) {
            const sourceNode = localNodes.find(n => n.id === drawingEdge.sourceId);
            if (!sourceNode) return;

            const newEdge: CanvasEdge = {
                id: `edge-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                source: drawingEdge.sourceId,
                target: targetNode.id,
                type: 'manual',
                status: 'valid',
                color: lastUsedEdgeColor,
                label: lastUsedEdgeLabel
            };
            
            const newEdges = [...localEdges, newEdge];
            setLocalEdges(newEdges);
            pushHistory(localNodes, newEdges);
        } else if (reconnectingEdge) {
            const edge = localEdges.find(e => e.id === reconnectingEdge.edgeId);
            if (edge) {
                if (reconnectingEdge.end === 'source' && targetNode.id !== edge.target && targetNode.id !== edge.source) {
                    const newEdges = localEdges.map(e => e.id === edge.id ? { ...e, source: targetNode.id } : e);
                    setLocalEdges(newEdges);
                    pushHistory(localNodes, newEdges);
                } else if (reconnectingEdge.end === 'target' && targetNode.id !== edge.source && targetNode.id !== edge.target) {
                    const newEdges = localEdges.map(e => e.id === edge.id ? { ...e, target: targetNode.id } : e);
                    setLocalEdges(newEdges);
                    pushHistory(localNodes, newEdges);
                }
            }
        }
        setDrawingEdge(null);
        setReconnectingEdge(null);
    };

    const handleNodePointerDown = (e: React.PointerEvent, node: CanvasNode) => {
        if (interactionMode === 'pan') return;
        e.stopPropagation(); 
        if (editingNodeId) { handleSaveNodeEdit(); return; }
        const isSelected = selectedNodeIds.has(node.id);
        wasSelectedOnDown.current = isSelected;
        hasDragged.current = false;
        if (!isSelected) {
             const isMultiSelect = e.metaKey || e.ctrlKey;
             setSelectedNodeIds(prev => {
                 const next = new Set<string>(isMultiSelect ? prev : []);
                 next.add(node.id);
                 return next;
             });
        }
        if (isReadOnly) return;
        setActiveDragNode(node.id);
        dragStartValues.current = { mouseX: e.clientX, mouseY: e.clientY, nodeX: node.x, nodeY: node.y };
        
        // Ensure that clicking a card triggers context update if chat is open
        if (node.noteId && onOpenChat && document.activeElement !== canvasRef.current) {
            // Optional: Auto-focus chat context on selection if chat is visible
        }
    };
    
    const pushHistory = (nodes: CanvasNode[], edges: CanvasEdge[], groups?: CanvasGroup[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        const state: CanvasState = { nodes, edges, groups: groups || localGroups, viewport: viewportRef.current };
        newHistory.push(state);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        
        const stateToSave = { 
            nodes: state.nodes, 
            edges: state.edges || [], 
            groups: state.groups || [] 
        };
        lastProcessedStateRef.current = JSON.stringify(stateToSave);
        updateActiveCanvasState(state);
        
        if (activeCanvasId) {
            saveToStorage(`kno_nodes_${activeCanvasId}`, state.nodes);
            saveToStorage(`kno_edges_${activeCanvasId}`, state.edges || []);
            saveToStorage(`kno_groups_${activeCanvasId}`, state.groups || []);
        }
    };

    const updateActiveCanvasState = useCallback((newState: Partial<CanvasState>) => {
        if (!activeCanvas) return;
        onUpdateCanvases(prevCanvases => prevCanvases.map(c => {
            if (c.id === activeCanvas.id) {
                return {
                    ...c,
                    lastModified: Date.now(),
                    state: { ...c.state, ...newState }
                };
            }
            return c;
        }));
    }, [activeCanvas, onUpdateCanvases]);

    const syncLibraryWithState = (oldNodes: CanvasNode[], newNodes: CanvasNode[], isUndo: boolean = false) => {
        newNodes.forEach(newNode => {
            const oldNode = oldNodes.find(n => n.id === newNode.id);
            const targetNoteId = newNode.noteId || (oldNode ? oldNode.noteId : undefined);
            
            if (targetNoteId) {
                const folderChanged = oldNode ? oldNode.folderId !== newNode.folderId : true;
                const themeChanged = oldNode ? oldNode.themeId !== newNode.themeId : true;
                
                if (folderChanged || themeChanged) {
                    const libraryNote = library.find(n => n.id === targetNoteId);
                    if (libraryNote) {
                        onUpdateNote({
                            ...libraryNote,
                            ...(folderChanged ? { folder: newNode.folderId } : {}),
                            ...(themeChanged ? { theme: newNode.themeId } : {})
                        });
                    }
                }
            }
        });

        if (isUndo) {
            oldNodes.forEach(oldNode => {
                const newNode = newNodes.find(n => n.id === oldNode.id);
                if (!newNode && oldNode.noteId) {
                    // Node was removed during undo (i.e. we are undoing its addition)
                    const libraryNote = library.find(n => n.id === oldNode.noteId);
                    if (libraryNote) {
                        const folderChanged = oldNode.folderId !== oldNode.originalFolderId;
                        const themeChanged = oldNode.themeId !== oldNode.originalThemeId;
                        
                        if (folderChanged || themeChanged) {
                            onUpdateNote({
                                ...libraryNote,
                                ...(folderChanged ? { folder: oldNode.originalFolderId } : {}),
                                ...(themeChanged ? { theme: oldNode.originalThemeId } : {})
                            });
                        }
                    }
                }
            });
        }
    };

    const undo = () => {
        if (isReadOnly) return;
        if (historyIndex > 0) {
            const currentState = history[historyIndex];
            const prevState = history[historyIndex - 1];
            setLocalNodes(prevState.nodes);
            setLocalEdges(prevState.edges);
            if (prevState.groups) setLocalGroups(prevState.groups);
            setHistoryIndex(historyIndex - 1);
            
            const stateToSave = { 
                nodes: prevState.nodes, 
                edges: prevState.edges || [], 
                groups: prevState.groups || localGroups || [] 
            };
            lastProcessedStateRef.current = JSON.stringify(stateToSave);
            updateActiveCanvasState({ nodes: prevState.nodes, edges: prevState.edges, groups: prevState.groups || localGroups });
            syncLibraryWithState(currentState.nodes, prevState.nodes, true);
        }
    };

    const redo = () => {
        if (isReadOnly) return;
        if (historyIndex < history.length - 1) {
            const currentState = history[historyIndex];
            const nextState = history[historyIndex + 1];
            setLocalNodes(nextState.nodes);
            setLocalEdges(nextState.edges);
            if (nextState.groups) setLocalGroups(nextState.groups);
            setHistoryIndex(historyIndex + 1);
            
            const stateToSave = { 
                nodes: nextState.nodes, 
                edges: nextState.edges || [], 
                groups: nextState.groups || localGroups || [] 
            };
            lastProcessedStateRef.current = JSON.stringify(stateToSave);
            updateActiveCanvasState({ nodes: nextState.nodes, edges: nextState.edges, groups: nextState.groups || localGroups });
            syncLibraryWithState(currentState.nodes, nextState.nodes, false);
        }
    };
    
    const handleSelectSignal = useCallback((item: InboxItem) => {
        setPreviewSignal(item);
        setPreviewQuizAnswers({});
    }, []);
    const handleGoHomeCallback = useCallback(() => onSelectCanvas(null), [onSelectCanvas]);
    const handleDragWarnCallback = useCallback((item: InboxItem) => {
        setDragWarningItem(item);
        if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = setTimeout(() => setDragWarningItem(null), 4000);
    }, []);

    const handleDeleteNode = (nodeId: string) => {
        if (isReadOnly) return;
        setLocalNodes(currentNodes => {
            const nodeToDelete = currentNodes.find(n => n.id === nodeId);
            if (!nodeToDelete) return currentNodes;
            setTimeout(() => {
                setDeletedNodes(prev => [nodeToDelete, ...prev]);
                setLocalEdges((currentEdges: CanvasEdge[]) => currentEdges.filter(e => e.source !== nodeId && e.target !== nodeId));
            }, 0);
            return currentNodes.filter(n => n.id !== nodeId);
        });
    };

    const handleRestoreDeletedNode = (node: CanvasNode) => {
        setLocalNodes(prev => [...prev, node]);
        setDeletedNodes(prev => prev.filter(n => n.id !== node.id));
    };

    const handleCreateCanvas = () => {
        if (isReadOnly) return;
        if (!canCreateCanvas()) return;
        const newCanvas: CanvasDocument = {
            id: `canvas-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            title: 'Untitled Canvas',
            lastModified: Date.now(),
            state: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
        };
        onUpdateCanvases([newCanvas, ...canvases]);
        onSelectCanvas(newCanvas.id);
    };

    const handleAddNote = () => {
        if (isReadOnly) {
            alert("Read-Only Mode: You cannot create new notes within Kno while on the Free plan or without an active license.");
            return;
        }
        const centerX = ((-viewport.x + window.innerWidth / 2) / viewport.zoom);
        const centerY = ((-viewport.y + window.innerHeight / 2) / viewport.zoom);
        const newNode: CanvasNode = {
            id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            type: 'note',
            source: 'manual',
            title: 'New Note',
            content: '',
            x: centerX - 125, y: centerY - 75, width: 250,
        };
        const newNodes = [...localNodes, newNode];
        setLocalNodes(newNodes);
        pushHistory(newNodes, localEdges);
        setEditingNodeId(newNode.id);
        setTempNodeContent("");
        setTempNodeTitle("New Note");
    };

    const [summaryModal, setSummaryModal] = useState<string | null>(null);

    const handleAddSelectedToFolder = useCallback((folderId: string) => {
        if (selectedNodeIds.size === 0) return;
        
        const folder = folders.find(f => f.id === folderId);
        const customColor = folder ? folder.color : undefined;

        let newLibraryNotes: Note[] = [];
        let canvasNodeUpdates: Record<string, string> = {};

        const newNodes = localNodes.map(n => {
            if (selectedNodeIds.has(n.id) && n.type !== 'folder') {
                if (!n.noteId) {
                    const noteType = n.type === 'spark' ? 'spark' : 
                                     n.type === 'collision' || n.type === 'synthesis' ? 'collision' : 
                                     n.type === 'asset' ? 'asset' : 'note';
                    
                    const newNote: Note = {
                        id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                        title: n.title || "Untitled Note",
                        summary: [n.content || ""],
                        type: noteType as any,
                        createdAt: Date.now(),
                        lastReviewedAt: Date.now(),
                        reviewCount: 0,
                        platform: Platform.GENERIC,
                        sourceUrl: n.source === 'neural_dump' ? 'neural://dump' : '',
                        folder: folderId,
                        tags: [],
                        quizAttempts: [],
                        needsRevision: false
                    };
                    newLibraryNotes.push(newNote);
                    canvasNodeUpdates[n.id] = newNote.id;
                    
                    if (onAddNote) onAddNote(newNote);
                    
                    return { ...n, folderId, customColor, noteId: newNote.id };
                } else {
                    const note = library.find(l => l.id === n.noteId);
                    if (note) {
                        onUpdateNote({ ...note, folder: folderId });
                    }
                    return { ...n, folderId, customColor };
                }
            }
            return n;
        });
        
        setLocalNodes(newNodes);
        pushHistory(newNodes, edgesRef.current, groupsRef.current);
    }, [selectedNodeIds, localNodes, library, folders, onUpdateNote, onAddNote]);

    const handleAutoArrangeWithKeywords = async () => {
        if (isReadOnly) return;
        if (!canUsePremiumFeatures('ThematicArrange')) return;
        if (localNodes.length === 0) return;
        setIsThinking(true);
        try {
            const keywordMappings = await extractKeywordsForGrouping(localNodes);
            onAIUsage?.();
            const groups: { [key: string]: string[] } = {};
            
            keywordMappings.forEach(m => {
                m.keywords.forEach(kw => {
                    if (!groups[kw]) groups[kw] = [];
                    groups[kw].push(m.nodeId);
                });
            });

            // For simplicity, pick the first keyword for each node to group them
            const nodeToGroup: { [nodeId: string]: string } = {};
            const normalizedNames: { [lower: string]: string } = {};
            
            keywordMappings.forEach(m => {
                if (m.keywords.length > 0) {
                    const rawName = m.keywords[0].trim();
                    const lowerName = rawName.toLowerCase();
                    if (!normalizedNames[lowerName]) {
                        normalizedNames[lowerName] = rawName;
                    }
                    nodeToGroup[m.nodeId] = normalizedNames[lowerName];
                }
            });

            const uniqueGroups = Array.from(new Set(Object.values(nodeToGroup)));
            
            // Sync with global themes
            let currentY = -50;
            const newlyAddedThemes: Theme[] = [];
            const groupMetadata: CanvasGroup[] = uniqueGroups.map((groupName, idx) => {
                // Calculate dimensions based on number of nodes
                const nodesInGroup = localNodes.filter(n => nodeToGroup[n.id] === groupName);
                const maxInnerCol = Math.min(1, nodesInGroup.length - 1);
                const maxInnerRow = Math.floor((nodesInGroup.length - 1) / 2);
                const groupWidth = Math.max(500, (maxInnerCol + 1) * 260 + 50);
                const groupHeight = Math.max(400, (maxInnerRow + 1) * 220 + 50);
                
                // Check if theme exists
                let theme = themes.find(t => t.name.trim().toLowerCase() === groupName.trim().toLowerCase()) ||
                            newlyAddedThemes.find(t => t.name.trim().toLowerCase() === groupName.trim().toLowerCase());
                if (!theme) {
                    theme = onAddTheme({ 
                        name: groupName.trim(), 
                        color: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#06B6D4'][idx % 5],
                        isAutoGenerated: true
                    }, true);
                    newlyAddedThemes.push(theme);
                }
                
                const group = {
                    id: `group-${idx}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    themeId: theme.id,
                    title: groupName,
                    x: -50,
                    y: currentY,
                    width: groupWidth,
                    height: groupHeight,
                    color: theme.color
                };
                
                currentY += groupHeight + 100; // 100px spacing between groups
                return group;
            });

            const newNodes = localNodes.map(node => {
                const group = nodeToGroup[node.id];
                if (!group) {
                    if (node.themeId) {
                        if (node.noteId) {
                            const libraryNote = library.find(n => n.id === node.noteId);
                            if (libraryNote) {
                                onUpdateNote({
                                    ...libraryNote,
                                    theme: undefined
                                });
                            }
                        }
                        return { ...node, themeId: undefined };
                    }
                    return node;
                }
                const groupIndex = uniqueGroups.indexOf(group);
                const nodesInGroup = localNodes.filter(n => nodeToGroup[n.id] === group);
                const indexInGroup = nodesInGroup.findIndex(n => n.id === node.id);
                
                const innerCol = indexInGroup % 2;
                const innerRow = Math.floor(indexInGroup / 2);

                const groupMeta = groupMetadata[groupIndex];
                const themeId = groupMeta.themeId;
                
                if (node.noteId) {
                    const libraryNote = library.find(n => n.id === node.noteId);
                    if (libraryNote) {
                        onUpdateNote({
                            ...libraryNote,
                            theme: themeId
                        });
                    }
                } else if (node.source === 'neural_dump' || node.type === 'spark' || node.type === 'collision' || node.type === 'synthesis' || node.type === 'asset') {
                    // Save canvas-only nodes to library when auto-arranged into a theme
                    const noteType = node.type === 'spark' ? 'spark' : 
                                     node.type === 'collision' || node.type === 'synthesis' ? 'collision' : 
                                     node.type === 'asset' ? 'asset' : 'note';
                    
                    const newNote: Note = {
                        id: node.id,
                        title: node.title || "Generated Insight",
                        summary: [node.content || ""],
                        type: noteType as any,
                        createdAt: Date.now(),
                        lastReviewedAt: Date.now(),
                        reviewCount: 0,
                        platform: Platform.GENERIC,
                        sourceUrl: node.source === 'neural_dump' ? 'neural://dump' : '',
                        tags: [],
                        quizAttempts: [],
                        needsRevision: false,
                        theme: themeId
                    };
                    if (onAddNote) onAddNote(newNote);
                    node.noteId = newNote.id; // Update the local node object being mapped
                }

                return {
                    ...node,
                    x: groupMeta.x + 50 + innerCol * 260,
                    y: groupMeta.y + 50 + innerRow * 220,
                    themeId: themeId
                };
            });

            setLocalNodes(newNodes);
            setLocalGroups(groupMetadata);
            pushHistory(newNodes, localEdges, groupMetadata);
        } catch (e) {
            console.error("Auto-arrange failed", e);
        } finally {
            setIsThinking(false);
        }
    };

    const handleQuickShift = () => {
        if (localNodes.length === 0) return;
        const cols = Math.ceil(Math.sqrt(localNodes.length));
        const spacingX = 350;
        const spacingY = 300;
        const newNodes = localNodes.map((node, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            return { ...node, x: col * spacingX, y: row * spacingY };
        });
        setLocalNodes(newNodes);
        pushHistory(newNodes, localEdges);
        setViewport({ x: 50, y: 50, zoom: 0.8 });
    };

    const runLogicGuardOnEdge = async (edge: CanvasEdge, sourceId: string, targetId: string) => {
        if (isReadOnly) return;
        const sourceNode = localNodes.find(n => n.id === sourceId);
        const targetNode = localNodes.find(n => n.id === targetId);
        if (!sourceNode || !targetNode) return;
        
        try {
            const sourceContent = sourceNode.content || sourceNode.title || "";
            const targetContent = targetNode.content || targetNode.title || "";
            
            // Analyze the relationship between the two nodes
            const result = await analyzeFallacy(`Source: ${sourceContent}\n\nTarget: ${targetContent}\n\nAnalyze the logical relationship between these two statements. Is there a logical fallacy in connecting them?`);
            onLogicGuardUsage?.();
            
            if (result && !result.isSafe) {
                setLocalEdges(edges => {
                    const newEdges = edges.map(e => e.id === edge.id ? { ...e, status: 'fallacy' as const, fallacyReason: result.issue } : e);
                    pushHistory(localNodes, newEdges);
                    return newEdges;
                });
            }
        } catch (error) {
            console.error("Error running Logic Guard on edge:", error);
        }
    };

    const handleLogicScan = async () => {
        if (isReadOnly) return;
        if (!canUsePremiumFeatures('LogicGuard')) return;
        if (selectedNodeIds.size !== 1) return;
        const selection = Array.from(selectedNodeIds);
        const id = selection[0] as string; 
        const node = localNodes.find(n => n.id === id);
        if (!node) return;
        if (node.critique) {
            const currentVisibility = expandedCritiques[id];
            setExpandedCritiques(prev => ({ ...prev, [id]: !currentVisibility }));
            return;
        }
        setScanningNodeId(id); 
        try {
            const rawContent = node.content || node.title || "";
            const contentToCheck = typeof rawContent === 'string' ? rawContent : String(rawContent);
            const result = (await analyzeFallacy(contentToCheck)) as CritiqueResult;
            onLogicGuardUsage?.();
            setLocalNodes(currentNodes => {
                const updated = currentNodes.map(n => n.id === id ? { ...n, critique: result } : n);
                pushHistory(updated, localEdges);
                return updated;
            });
            setExpandedCritiques(prev => ({...prev, [id]: true}));
        } catch (e: any) { console.error("Logic Scan Error", e); } finally { setScanningNodeId(null); }
    };

    const saveSpecialNodeToLibrary = (node: CanvasNode, type: 'spark' | 'collision' | 'asset' | 'note') => {
        const newNote: Note = {
            id: node.id,
            title: node.title || "Generated Insight",
            summary: [node.content || ""],
            type: type,
            createdAt: Date.now(),
            lastReviewedAt: Date.now(),
            reviewCount: 0,
            platform: Platform.GENERIC,
            sourceUrl: '',
            tags: [],
            quizAttempts: [],
            needsRevision: false,
            folder: node.folderId,
            theme: node.themeId
        };
        if (onAddNote) onAddNote(newNote);
    };

    const handleSpark = async () => {
        if (isReadOnly) return;
        if (!canUsePremiumFeatures('Spark')) return;
        if (selectedNodeIds.size !== 1) return;
        const selectedId = Array.from(selectedNodeIds)[0] as string;
        const selectedNode = localNodes.find(n => n.id === selectedId);
        if (!selectedNode) return;
        const candidates = library.filter(n => n.id !== selectedNode.noteId);
        if (candidates.length === 0) return;
        const randomCandidate = candidates[Math.floor(Math.random() * candidates.length)];
        const sparkX = selectedNode.x + (selectedNode.width || 250) + 150;
        const sparkY = selectedNode.y;
        const sparkId = `spark-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        let folderId = undefined;
        let themeId = undefined;
        let customColor = undefined;

        const folderNode = localNodes.find(n => 
            n.type === 'folder' && 
            sparkX > n.x && sparkX < n.x + (n.width || 250) &&
            sparkY > n.y && sparkY < n.y + 200
        );
        
        const themeGroup = localGroups.find(g => 
            g.themeId &&
            sparkX > g.x && sparkX < g.x + g.width &&
            sparkY > g.y && sparkY < g.y + g.height
        );

        if (folderNode && folderNode.folderId) {
            folderId = folderNode.folderId;
            const folder = folders.find(f => f.id === folderNode.folderId);
            if (folder) customColor = folder.color;
        }
        if (themeGroup && themeGroup.themeId) {
            themeId = themeGroup.themeId;
        }

        const sparkNode: CanvasNode = {
            id: sparkId, type: 'insight', title: "Sparking Serendipity...", content: "", x: sparkX, y: sparkY, width: 300, color: '#F59E0B', isThinking: true, synthesisHistory: [], historyIndex: 0, folderId, themeId, customColor
        };
        const sparkEdge: CanvasEdge = { id: `spark-edge-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, source: selectedNode.id, target: sparkId, type: 'spark' };
        setLocalNodes(prev => [...prev, sparkNode]);
        setLocalEdges(prev => [...prev, sparkEdge]);
        try {
             const prompt = `Role: Serendipity Engine. Concept A: "${selectedNode.title} - ${selectedNode.content ? selectedNode.content.substring(0, 200) : ''}" Concept B: "${randomCandidate.title} - ${randomCandidate.summary.join(' ').substring(0, 200)}" Task: Find a surprising connection. Output JSON: { "title": "The Connection", "insight": "Insight text." }. Respond entirely in ${systemLanguage || 'English'}.`;
             
             const stream = await getAI().models.generateContentStream({ model: getModel('LogicGuard'), contents: prompt, config: { responseMimeType: 'application/json' } });
             onAIUsage?.();
             
             let fullText = "";
             let fullThinking = "";
             
             for await (const chunk of stream) {
                 const c = chunk as any;
                 const textPart = c.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || "";
                 const thoughtPart = c.candidates?.[0]?.content?.parts?.find((p: any) => p.thought)?.thought || "";
                 
                 if (thoughtPart) {
                     fullThinking += thoughtPart;
                     setLocalNodes(prev => prev.map(n => n.id === sparkId ? { ...n, thinking: fullThinking } : n));
                 }
                 if (textPart) {
                     fullText += textPart;
                     if (!thoughtPart && fullText.includes('"thinking"')) {
                         const match = fullText.match(/"thinking"\s*:\s*"([^"]+)"/);
                         if (match && match[1]) {
                             setLocalNodes(prev => prev.map(n => n.id === sparkId ? { ...n, thinking: match[1] } : n));
                         }
                     }
                 }
             }

             const responseText = fullText || "{}";
             const data = cleanJson(responseText) as any;
             const historyEntry = { title: data.title || "Spark Insight", content: `Connected to: "${randomCandidate.title}"\n\n${data.insight || "Connection established."}`, timestamp: Date.now() };
             setLocalNodes(currentNodes => {
                 const nodeToUpdate = currentNodes.find(n => n.id === sparkId);
                 if (nodeToUpdate) {
                     const finalNode = { ...nodeToUpdate, title: historyEntry.title, content: historyEntry.content, isThinking: false, synthesisHistory: [historyEntry], historyIndex: 0, noteId: sparkId };
                     const newNodes = currentNodes.map(n => n.id === sparkId ? finalNode : n);
                     pushHistory(newNodes, [...edgesRef.current, sparkEdge]); 
                     saveSpecialNodeToLibrary(finalNode, 'spark');
                     return newNodes;
                 }
                 return currentNodes;
             });
        } catch (e: any) {
            setLocalNodes(prev => prev.filter(n => n.id !== sparkId));
            setLocalEdges(prev => prev.filter(e => e.id !== sparkEdge.id));
        } finally { setSelectedNodeIds(new Set()); }
    };

    const handleCollider = async (nodesToCollide?: CanvasNode[]) => {
        if (isReadOnly) return;
        if (!canUsePremiumFeatures('Collider')) return;
        const targetNodes = nodesToCollide || localNodes.filter(n => selectedNodeIds.has(n.id));
        if (targetNodes.length < 2) return; 
        const avgX = targetNodes.reduce((sum, n) => sum + n.x, 0) / targetNodes.length;
        const maxY = Math.max(...targetNodes.map(n => n.y)); 
        const newId = `col-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const colX = avgX;
        const colY = maxY + 300;

        let folderId = undefined;
        let themeId = undefined;
        let customColor = undefined;

        const folderNode = localNodes.find(n => 
            n.type === 'folder' && 
            colX > n.x && colX < n.x + (n.width || 250) &&
            colY > n.y && colY < n.y + 200
        );
        
        const themeGroup = localGroups.find(g => 
            g.themeId &&
            colX > g.x && colX < g.x + g.width &&
            colY > g.y && colY < g.y + g.height
        );

        if (folderNode && folderNode.folderId) {
            folderId = folderNode.folderId;
            const folder = folders.find(f => f.id === folderNode.folderId);
            if (folder) customColor = folder.color;
        }
        if (themeGroup && themeGroup.themeId) {
            themeId = themeGroup.themeId;
        }

        const placeholder: CanvasNode = { id: newId, type: 'synthesis', title: "Colliding Concepts...", content: "", x: colX, y: colY, width: 350, isThinking: true, color: '#A855F7', folderId, themeId, customColor };
        const newEdges: CanvasEdge[] = targetNodes.map((n, i) => ({ id: `e-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}`, source: n.id, target: newId, type: 'conflict' }));
        setLocalNodes(prev => [...prev, placeholder]);
        setLocalEdges(prev => [...prev, ...newEdges]);
        try {
            const inputs = targetNodes.map((n, i) => `Input ${i+1}: "${n.title}"`).join('\n');
            
            const stream = await getAI().models.generateContentStream({ model: getModel('LogicGuard'), contents: `Role: Collider. Inputs:\n${inputs}\nTask: Synthesis. Output JSON: { "title": "Title", "content": "Insight." }. Respond entirely in ${systemLanguage || 'English'}.`, config: { responseMimeType: 'application/json' } });
            onAIUsage?.();
            
            let fullText = "";
            let fullThinking = "";
            
            for await (const chunk of stream) {
                const c = chunk as any;
                const textPart = c.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || "";
                const thoughtPart = c.candidates?.[0]?.content?.parts?.find((p: any) => p.thought)?.thought || "";
                
                if (thoughtPart) {
                    fullThinking += thoughtPart;
                    setLocalNodes(prev => prev.map(n => n.id === newId ? { ...n, thinking: fullThinking } : n));
                }
                if (textPart) {
                    fullText += textPart;
                    if (!thoughtPart && fullText.includes('"thinking"')) {
                        const match = fullText.match(/"thinking"\s*:\s*"([^"]+)"/);
                        if (match && match[1]) {
                            setLocalNodes(prev => prev.map(n => n.id === newId ? { ...n, thinking: match[1] } : n));
                        }
                    }
                }
            }

            const responseText = fullText || "{}";
            const data = cleanJson(responseText) as any;
            const historyEntry = { title: data.title, content: data.content, timestamp: Date.now() };
            setLocalNodes(currentNodes => {
                const nodeToUpdate = currentNodes.find(n => n.id === newId);
                if (nodeToUpdate) {
                    const finalNode = { ...nodeToUpdate, title: data.title || "Synthesis", content: data.content || "Connection found.", isThinking: false, synthesisHistory: [historyEntry], historyIndex: 0, noteId: newId };
                    const newNodes = currentNodes.map(n => n.id === newId ? finalNode : n);
                    pushHistory(newNodes, edgesRef.current);
                    saveSpecialNodeToLibrary(finalNode, 'collision');
                    return newNodes;
                }
                return currentNodes;
            });
        } catch (e: any) {
            setLocalNodes(prev => prev.filter(n => n.id !== newId));
            setLocalEdges(prev => prev.filter(e => !newEdges.find(ne => ne.id === e.id)));
        } finally { setSelectedNodeIds(new Set()); }
    };

    const handleAlchemy = async () => {
        if (!canUsePremiumFeatures('Alchemy')) return;
        if (selectedNodeIds.size < 2) return; 
        const sourceNodes = localNodes.filter(n => selectedNodeIds.has(n.id));
        const avgX = sourceNodes.reduce((sum, n) => sum + n.x, 0) / sourceNodes.length;
        const maxY = Math.max(...sourceNodes.map(n => n.y));
        const alchemyId = `alchemy-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const alchX = avgX;
        const alchY = maxY + 300;

        let folderId = undefined;
        let themeId = undefined;
        let customColor = undefined;

        const folderNode = localNodes.find(n => 
            n.type === 'folder' && 
            alchX > n.x && alchX < n.x + (n.width || 250) &&
            alchY > n.y && alchY < n.y + 200
        );
        
        const themeGroup = localGroups.find(g => 
            g.themeId &&
            alchX > g.x && alchX < g.x + g.width &&
            alchY > g.y && alchY < g.y + g.height
        );

        if (folderNode && folderNode.folderId) {
            folderId = folderNode.folderId;
            const folder = folders.find(f => f.id === folderNode.folderId);
            if (folder) customColor = folder.color;
        }
        if (themeGroup && themeGroup.themeId) {
            themeId = themeGroup.themeId;
        }

        const alchemyNode: CanvasNode = { id: alchemyId, type: 'asset', title: "Alchemy in progress...", content: "", x: alchX, y: alchY, width: 400, color: '#10B981', isThinking: true, synthesisHistory: [], historyIndex: 0, folderId, themeId, customColor };
        const newEdges = sourceNodes.map(n => ({ id: `edge-${n.id}-${alchemyId}`, source: n.id, target: alchemyId, type: 'synthesis' as const }));
        setLocalNodes(prev => [...prev, alchemyNode]);
        setLocalEdges(prev => [...prev, ...newEdges]);
        try {
            const inputs = sourceNodes.map((n, i) => `Input ${i+1}: ${n.title} - ${n.content ? n.content.substring(0, 150) : ''}`).join('\n');
            const prompt = `Role: Alchemy Engine. Inputs:\n${inputs}\nTask: Fuse into cohesive structure. Output JSON: { "title": "Title", "content": "Output." }. Respond entirely in ${systemLanguage || 'English'}.`;
            
            const stream = await getAI().models.generateContentStream({ model: getModel('LogicGuard'), contents: prompt, config: { responseMimeType: 'application/json' } });
            onAIUsage?.();
            
            let fullText = "";
            let fullThinking = "";
            
            for await (const chunk of stream) {
                const c = chunk as any;
                const textPart = c.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || "";
                const thoughtPart = c.candidates?.[0]?.content?.parts?.find((p: any) => p.thought)?.thought || "";
                
                if (thoughtPart) {
                    fullThinking += thoughtPart;
                    setLocalNodes(prev => prev.map(n => n.id === alchemyId ? { ...n, thinking: fullThinking } : n));
                }
                if (textPart) {
                    fullText += textPart;
                    if (!thoughtPart && fullText.includes('"thinking"')) {
                        const match = fullText.match(/"thinking"\s*:\s*"([^"]+)"/);
                        if (match && match[1]) {
                            setLocalNodes(prev => prev.map(n => n.id === alchemyId ? { ...n, thinking: match[1] } : n));
                        }
                    }
                }
            }

            const responseText = fullText || "{}";
            const data = cleanJson(responseText) as any;
            const historyEntry = { title: data.title || "Alchemical Gold", content: data.content || "Transformation complete.", timestamp: Date.now() };
            setLocalNodes(currentNodes => {
                const nodeToUpdate = currentNodes.find(n => n.id === alchemyId);
                if (nodeToUpdate) {
                    const finalNode = { ...nodeToUpdate, title: historyEntry.title, content: historyEntry.content, isThinking: false, synthesisHistory: [historyEntry], historyIndex: 0, noteId: alchemyId };
                    const newNodes = currentNodes.map(n => n.id === alchemyId ? finalNode : n);
                    pushHistory(newNodes, edgesRef.current);
                    saveSpecialNodeToLibrary(finalNode, 'asset');
                    return newNodes;
                }
                return currentNodes;
            });
        } catch (e: any) {
            setLocalNodes(prev => prev.filter(n => n.id !== alchemyId));
            setLocalEdges(prev => prev.filter(e => e.target !== alchemyId));
        } finally { setSelectedNodeIds(new Set()); }
    };

    const regenerateNode = async (node: CanvasNode) => {
        const parents = localEdges.filter(e => e.target === node.id).map(e => localNodes.find(n => n.id === e.source)).filter(Boolean) as CanvasNode[];
        if (parents.length === 0) return; 
        const isSpark = node.type === 'spark' || node.type === 'insight' || node.color === '#F59E0B';
        const isAlchemy = node.type === 'asset' || node.color === '#10B981';
        const isCollider = !isSpark && !isAlchemy;
        setLocalNodes(prev => prev.map(n => n.id === node.id ? { ...n, isThinking: true, title: "Regenerating..." } : n));
        try {
            let promptContents = "";
            if (isCollider) {
                 const inputs = parents.map((n, i) => `Input ${i+1}: "${n.title}"`).join('\n');
                 promptContents = `Role: Collider (Regeneration). Inputs:\n${inputs}\nPrevious: "${node.content}"\nTask: Different synthesis. Output JSON: { "title": "New Title", "content": "New Insight." }. Respond entirely in ${systemLanguage || 'English'}.`;
            } else if (isAlchemy) {
                 const inputs = parents.map((n, i) => `Input ${i+1}: ${n.title}`).join('\n');
                 promptContents = `Role: Alchemy (Regeneration). Inputs:\n${inputs}\nTask: Better structure. Output JSON: { "title": "Refined Gold", "content": "Output." }. Respond entirely in ${systemLanguage || 'English'}.`;
            } else if (isSpark) {
                 const sourceNode = parents[0];
                 const candidates = library.filter(n => n.id !== sourceNode.noteId);
                 if (candidates.length === 0) throw new Error("No candidates");
                 const randomCandidate = candidates[Math.floor(Math.random() * candidates.length)];
                 promptContents = `Role: Serendipity. A: "${sourceNode.title}" B: "${randomCandidate.title}" Task: Connection. Output JSON: { "title": "Connection", "insight": "Logic." }. Respond entirely in ${systemLanguage || 'English'}.`;
                 (node as any)._tempCandidate = randomCandidate.title;
            }
            const stream = await getAI().models.generateContentStream({ model: getModel('LogicGuard'), contents: promptContents, config: { responseMimeType: 'application/json' } });
            onAIUsage?.();
            
            let fullText = "";
            let fullThinking = "";
            
            for await (const chunk of stream) {
                const c = chunk as any;
                const textPart = c.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || "";
                const thoughtPart = c.candidates?.[0]?.content?.parts?.find((p: any) => p.thought)?.thought || "";
                
                if (thoughtPart) {
                    fullThinking += thoughtPart;
                    setLocalNodes(prev => prev.map(n => n.id === node.id ? { ...n, thinking: fullThinking } : n));
                }
                if (textPart) {
                    fullText += textPart;
                    if (!thoughtPart && fullText.includes('"thinking"')) {
                        const match = fullText.match(/"thinking"\s*:\s*"([^"]+)"/);
                        if (match && match[1]) {
                            setLocalNodes(prev => prev.map(n => n.id === node.id ? { ...n, thinking: match[1] } : n));
                        }
                    }
                }
            }

            const responseText = fullText || "{}";
            const data = cleanJson(responseText) as any;
            let finalContent = data.content;
            if (isSpark && (node as any)._tempCandidate) finalContent = `Connected to: "${(node as any)._tempCandidate}"\n\n${data.insight || data.content}`;
            const historyEntry = { title: data.title, content: finalContent, timestamp: Date.now() };
            const updatedHistory = [...(node.synthesisHistory || []), historyEntry];
            setLocalNodes(currentNodes => {
                const nodeToUpdate = currentNodes.find(n => n.id === node.id);
                if (nodeToUpdate) {
                    const finalNode = { ...nodeToUpdate, isThinking: false, title: data.title, content: finalContent, synthesisHistory: updatedHistory, historyIndex: updatedHistory.length - 1, noteId: node.id };
                    const newNodes = currentNodes.map(n => n.id === node.id ? finalNode : n);
                    saveSpecialNodeToLibrary(finalNode, isSpark ? 'spark' : isAlchemy ? 'asset' : 'collision');
                    return newNodes;
                }
                return currentNodes;
            });
        } catch (e: any) {
            setLocalNodes(prev => prev.map(n => n.id === node.id ? { ...n, isThinking: false, title: node.title } : n));
        }
    };

    const navigateHistory = (node: CanvasNode, direction: 'prev' | 'next') => {
        if (!node.synthesisHistory || node.synthesisHistory.length === 0) return;
        const currentIndex = node.historyIndex ?? (node.synthesisHistory.length - 1);
        const newIndex = direction === 'prev' ? Math.max(0, currentIndex - 1) : Math.min(node.synthesisHistory.length - 1, currentIndex + 1);
        const entry = node.synthesisHistory[newIndex];
        setLocalNodes(prev => prev.map(n => n.id === node.id ? { ...n, title: entry.title, content: entry.content, historyIndex: newIndex } : n));
    };

    const { edges: renderedEdges, handles: renderedHandles } = useMemo(() => {
        if (!localEdges || !localNodes) return { edges: null, handles: null };
        const drawnEdges: React.ReactNode[] = [];
        const drawnHandles: React.ReactNode[] = [];

        localEdges.forEach(edge => {
            const source = localNodes.find(n => n.id === edge.source);
            const target = localNodes.find(n => n.id === edge.target);
            if (!source || !target) return;
            
            const sourceDims = getActualDimensions(source.id, source.width || 250, source.height || 150, nodeDimensionsCache.current);
            const targetDims = getActualDimensions(target.id, target.width || 250, target.height || 150, nodeDimensionsCache.current);

            const scx = source.x + sourceDims.width / 2;
            const scy = source.y + sourceDims.height / 2;
            const tcx = target.x + targetDims.width / 2;
            const tcy = target.y + targetDims.height / 2;

            let sx = scx;
            let sy = scy;
            let tx = tcx;
            let ty = tcy;

            if (reconnectingEdge?.edgeId === edge.id) {
                if (reconnectingEdge.end === 'source') {
                    sx = reconnectingEdge.currentX;
                    sy = reconnectingEdge.currentY;
                    const tIntersect = getIntersection(tcx, tcy, sx, sy, target.x, target.y, targetDims.width, targetDims.height);
                    tx = tIntersect.x;
                    ty = tIntersect.y;
                } else {
                    tx = reconnectingEdge.currentX;
                    ty = reconnectingEdge.currentY;
                    const sIntersect = getIntersection(scx, scy, tx, ty, source.x, source.y, sourceDims.width, sourceDims.height);
                    sx = sIntersect.x;
                    sy = sIntersect.y;
                }
            } else {
                const sIntersect = getIntersection(scx, scy, tcx, tcy, source.x, source.y, sourceDims.width, sourceDims.height);
                const tIntersect = getIntersection(tcx, tcy, scx, scy, target.x, target.y, targetDims.width, targetDims.height);
                sx = sIntersect.x;
                sy = sIntersect.y;
                tx = tIntersect.x;
                ty = tIntersect.y;
            }

            const isSpark = edge.type === 'spark';
            const isConflict = edge.type === 'conflict';
            const isSynthesis = edge.type === 'synthesis';
            const isNeural = edge.type === 'neural'; 
            const isFallacy = edge.status === 'fallacy';
            const isSelected = selectedEdgeIds.has(edge.id);
            let strokeColor = edge.color || "#CBD5E1";
            if (!edge.color) {
                if (isSpark) strokeColor = "#fbbf24"; 
                if (isConflict) strokeColor = "#A855F7"; 
                if (isSynthesis) strokeColor = "#10B981"; 
                if (isNeural) strokeColor = "#3B82F6"; 
                if (isFallacy) strokeColor = "#EF4444";
            }
            
            let dashArray = "none";
            if (edge.lineStyle === 'dashed') dashArray = "8,8";
            else if (edge.lineStyle === 'dotted') dashArray = "2,4";
            else if (isSpark || isNeural || isFallacy) dashArray = "4,4";

            drawnEdges.push(
                <g key={edge.id} className="cursor-pointer pointer-events-auto" onPointerDown={(e) => handleEdgeClick(e, edge.id)} style={{ pointerEvents: reconnectingEdge?.edgeId === edge.id ? 'none' : 'all' }}>
                    {/* Invisible wider line for easier clicking */}
                    <line 
                        x1={sx} y1={sy} x2={tx} y2={ty} 
                        stroke="transparent" 
                        strokeWidth="40" 
                        className="cursor-pointer"
                        style={{ pointerEvents: reconnectingEdge?.edgeId === edge.id ? 'none' : 'all' }}
                    />
                    <line 
                        x1={sx} y1={sy} x2={tx} y2={ty} 
                        stroke={strokeColor} 
                        strokeWidth={isSelected ? "4" : (isFallacy ? "3" : "2")} 
                        strokeDasharray={dashArray} 
                        className={`${isConflict || isFallacy ? "animate-pulse" : ""}`} 
                        style={{ pointerEvents: 'none' }}
                    />
                    {isSelected && (
                        <line 
                            x1={sx} y1={sy} x2={tx} y2={ty} 
                            stroke="#3b82f6" 
                            strokeWidth="12" 
                            strokeOpacity="0.4"
                            className="animate-pulse"
                            style={{ pointerEvents: 'none' }}
                        />
                    )}
                    {edge.label && (
                        <foreignObject x={(sx + tx) / 2 - 50} y={(sy + ty) / 2 - 12} width="100" height="24" className="overflow-visible pointer-events-none">
                            <div className="w-full h-full flex items-center justify-center">
                                <span className="px-2 py-0.5 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full text-[9px] font-black uppercase tracking-widest text-gray-600 shadow-sm whitespace-nowrap">
                                    {edge.label}
                                </span>
                            </div>
                        </foreignObject>
                    )}
                    {isFallacy && (
                        <foreignObject x={(sx + tx) / 2 - 100} y={(sy + ty) / 2 - 100} width="200" height="200" className="overflow-visible pointer-events-none">
                            <div className="w-full h-full flex items-center justify-center pointer-events-none">
                                <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center shadow-sm border border-red-200 cursor-help group relative pointer-events-auto">
                                    <AlertTriangle className="w-3 h-3 text-red-600" />
                                    {edge.fallacyReason && (
                                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-red-900 text-white text-[10px] p-2 rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[100]">
                                            <div className="font-bold mb-1">Logic Guard</div>
                                            {edge.fallacyReason}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-red-900"></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </foreignObject>
                    )}
                </g>
            );

            if (isSelected && !isReadOnly) {
                drawnHandles.push(
                    <g key={`handles-${edge.id}`}>
                        <circle
                            cx={sx} cy={sy} r="8"
                            fill="#fff" stroke="#3b82f6" strokeWidth="3"
                            className="cursor-crosshair pointer-events-auto hover:stroke-[4px]"
                            style={{ pointerEvents: reconnectingEdge?.edgeId === edge.id ? 'none' : 'all' }}
                            onPointerDown={(e) => {
                                if (interactionMode === 'pan' || isReadOnly) return;
                                e.stopPropagation();
                                (e.currentTarget as Element).setPointerCapture(e.pointerId);
                                const zoom = viewportRef.current.zoom;
                                const rect = canvasRef.current?.getBoundingClientRect();
                                const offsetX = rect ? rect.left : 0;
                                const offsetY = rect ? rect.top : 0;
                                const currentX = (e.clientX - offsetX - viewportRef.current.x) / zoom;
                                const currentY = (e.clientY - offsetY - viewportRef.current.y) / zoom;
                                setReconnectingEdge({ edgeId: edge.id, end: 'source', currentX, currentY });
                            }}
                        />
                        <circle
                            cx={tx} cy={ty} r="8"
                            fill="#fff" stroke="#3b82f6" strokeWidth="3"
                            className="cursor-crosshair pointer-events-auto hover:stroke-[4px]"
                            style={{ pointerEvents: reconnectingEdge?.edgeId === edge.id ? 'none' : 'all' }}
                            onPointerDown={(e) => {
                                if (interactionMode === 'pan' || isReadOnly) return;
                                e.stopPropagation();
                                (e.currentTarget as Element).setPointerCapture(e.pointerId);
                                const zoom = viewportRef.current.zoom;
                                const rect = canvasRef.current?.getBoundingClientRect();
                                const offsetX = rect ? rect.left : 0;
                                const offsetY = rect ? rect.top : 0;
                                const currentX = (e.clientX - offsetX - viewportRef.current.x) / zoom;
                                const currentY = (e.clientY - offsetY - viewportRef.current.y) / zoom;
                                setReconnectingEdge({ edgeId: edge.id, end: 'target', currentX, currentY });
                            }}
                        />
                    </g>
                );
            }
        });

        if (drawingEdge) {
            const source = localNodes.find(n => n.id === drawingEdge.sourceId);
            if (source) {
                const sourceDims = getActualDimensions(source.id, source.width || 250, source.height || 150, nodeDimensionsCache.current);
                const scx = source.x + sourceDims.width / 2;
                const scy = source.y + sourceDims.height / 2;
                const sIntersect = getIntersection(scx, scy, drawingEdge.currentX, drawingEdge.currentY, source.x, source.y, sourceDims.width, sourceDims.height);
                const sx = sIntersect.x;
                const sy = sIntersect.y;
                drawnEdges.push(
                    <g key="drawing-edge">
                        <line 
                            x1={sx} y1={sy} x2={drawingEdge.currentX} y2={drawingEdge.currentY} 
                            stroke="#3B82F6" 
                            strokeWidth="2" 
                            strokeDasharray="4,4" 
                        />
                    </g>
                );
            }
        }

        return { edges: drawnEdges, handles: drawnHandles };
    }, [localEdges, localNodes, drawingEdge, reconnectingEdge, selectedEdgeIds, dimensionsVersion]);

    if (!activeCanvasId) { 
        return ( 
            <div className="h-full flex flex-col pt-24 pb-10 px-6 md:px-10 overflow-hidden relative">
                <div className="max-w-7xl mx-auto w-full flex flex-col h-full">
                    <div className="flex flex-col space-y-6 mb-8 flex-shrink-0 animate-fade-in">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-end">
                            <div>
                                <div className="flex items-center space-x-2 text-gray-400 mb-1"><LayoutGrid className="w-4 h-4" /><span className="text-[10px] font-black uppercase tracking-[0.2em]">{dashboardView === 'active' ? `${canvases.length} Active Boards` : `${canvasTrash.length} Deleted Boards`}</span></div>
                                <h1 className="text-3xl font-black text-gray-900 tracking-tight">Canvas</h1>
                            </div>
                            <div className="flex items-center gap-2 mt-4 md:mt-0">
                                <button onClick={onExitWorkspace} className="px-4 py-2.5 bg-white border border-gray-200 text-gray-400 hover:text-gray-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center hover:bg-gray-50 mr-2"><ArrowLeft className="w-3.5 h-3.5 mr-2" /> {t('About Kno', systemLanguage)}</button>
                                <div className="flex bg-gray-100 p-1 rounded-xl">
                                    <button onClick={() => setDashboardView('active')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${dashboardView === 'active' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>Active</button>
                                    <button onClick={() => setDashboardView('trash')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center ${dashboardView === 'trash' ? 'bg-white shadow-sm text-red-500' : 'text-gray-400 hover:text-gray-600'}`}><Trash2 className="w-3 h-3 mr-1" /> Bin</button>
                                </div>
                                {!isReadOnly && (
                                    <button onClick={handleCreateCanvas} className="group flex items-center px-5 py-2.5 bg-black text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl ml-2"><Plus className="w-4 h-4 mr-2" /> New Canvas</button>
                                )}
                            </div>
                        </div>
                    </div>
                     <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
                        {dashboardView === 'active' ? (
                            canvases.length === 0 ? (
                                <div className="flex flex-col items-center justify-center pt-20 opacity-30 cursor-pointer group" onClick={!isReadOnly ? handleCreateCanvas : undefined}>
                                    <LayoutGrid className="w-16 h-16 mb-4 group-hover:scale-110 transition-transform" />
                                    <p className="font-bold uppercase tracking-widest mb-4">No Canvases Created</p>
                                    {!isReadOnly && (
                                        <button className="px-6 py-2 bg-black text-white rounded-full text-xs font-bold uppercase tracking-widest hover:scale-105 transition-all">Create First Canvas</button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {canvases.map(canvas => (
                                        <div key={canvas.id} onClick={() => onSelectCanvas(canvas.id)} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-200 transition-all cursor-pointer group flex flex-col h-64 relative">
                                            {!isReadOnly && (
                                                <button onClick={(e) => { e.stopPropagation(); onMoveCanvasToTrash(canvas.id); }} className="absolute top-4 right-4 p-2 bg-white/80 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"><Trash2 className="w-4 h-4" /></button>
                                            )}
                                            <div className="flex-1 bg-gray-50 rounded-2xl mb-4 flex items-center justify-center border border-gray-100 relative overflow-hidden"><LayoutGrid className="w-8 h-8 text-gray-300" /></div>
                                            <div className="relative group/editarea">
                                                {editingCanvasTitleId === canvas.id ? (
                                                    <input 
                                                        value={tempCanvasTitleVal}
                                                        onChange={(e) => setTempCanvasTitleVal(e.target.value)}
                                                        onBlur={(e) => handleSaveCanvasRename(e)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveCanvasRename(e)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        autoFocus
                                                        className="font-bold text-lg text-gray-900 bg-transparent border-b-2 border-blue-500 focus:outline-none w-full"
                                                    />
                                                ) : (
                                                    <div onClick={(e) => e.stopPropagation()}>
                                                        <h3 className="font-bold text-lg text-gray-900 mb-1 break-words line-clamp-2 flex items-center cursor-text group/title hover:bg-gray-50 rounded px-1 -mx-1" onDoubleClick={(e) => handleStartCanvasRename(e, canvas)}>
                                                            {canvas.title}
                                                            {!isReadOnly && <Edit2 className="w-3 h-3 ml-2 text-gray-400 opacity-0 group-hover/title:opacity-100 hover:text-blue-500 transition-all cursor-pointer" onClick={(e) => handleStartCanvasRename(e, canvas)} />}
                                                        </h3>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center mt-2"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{canvas.state?.nodes?.length || 0} Nodes</span></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {canvasTrash.map(canvas => (
                                    <div key={canvas.id} className="bg-gray-50 p-6 rounded-3xl border border-gray-200 opacity-80 hover:opacity-100 transition-all flex flex-col h-64">
                                        <div className="flex-1 bg-gray-100 rounded-2xl mb-4 flex items-center justify-center border border-gray-200"><LayoutGrid className="w-8 h-8 text-gray-300" /></div>
                                        <div><h3 className="font-bold text-lg text-gray-500 mb-1 break-words line-clamp-2 line-through decoration-red-300">{canvas.title}</h3><div className="flex justify-between items-center mt-4">
                                            {!isReadOnly && (
                                                <>
                                                    <button onClick={() => onRestoreCanvas(canvas.id)} className="flex items-center text-[10px] font-bold text-blue-500 hover:text-blue-700 uppercase tracking-wider bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg"><RotateCw className="w-3 h-3 mr-1.5" /> Restore</button>
                                                    <button onClick={() => onDeleteCanvasForever(canvas.id)} className="flex items-center text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-wider bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg"><Trash2 className="w-3 h-3 mr-1.5" /> Delete</button>
                                                </>
                                            )}
                                        </div></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
    );}

    return (
        <div className="h-full relative overflow-hidden bg-gray-50 flex">
            {isThinking && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-white/90 backdrop-blur-md px-6 py-3 rounded-full shadow-2xl border border-indigo-100 flex items-center space-x-3 animate-fade-in pointer-events-none">
                    <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                    <span className="text-sm font-bold text-indigo-900 tracking-wide">Thematic Arrange Processing...</span>
                </div>
            )}
            <AnimatePresenceAny>
                {dragWarningItem && (
                    <MotionDiv initial={{ opacity: 0, y: -20, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: -20, x: '-50%' }} onClick={() => { setPreviewSignal(dragWarningItem); setDragWarningItem(null); }} className="fixed top-28 left-1/2 z-[200] bg-white/95 backdrop-blur-xl border border-gray-100 pl-2 pr-6 py-2 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center gap-3 cursor-pointer hover:scale-105 active:scale-95 transition-all group">
                        <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center border border-amber-100 group-hover:bg-amber-100 transition-colors relative overflow-hidden">
                            <Save className="w-5 h-5 text-amber-600 relative z-10" />
                            <div className="absolute inset-0 bg-amber-400/20 rounded-full animate-ping opacity-0 group-hover:opacity-100"></div>
                        </div>
                        <div className="flex flex-col justify-center">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-tight mb-0.5">Unprocessed Signal</span>
                            <span className="text-xs font-bold text-gray-900 group-hover:text-amber-700 transition-colors">Tap to review & save</span>
                        </div>
                        <div className="w-px h-6 bg-gray-100 mx-1"></div>
                        <div className="text-gray-300 group-hover:text-amber-500 transition-colors"><ArrowRight className="w-4 h-4" /></div>
                    </MotionDiv>
                )}
            </AnimatePresenceAny>
            <LibraryDrawer isOpen={drawerOpen} setIsOpen={setDrawerOpen} activeTab={drawerActiveTab} inbox={inbox} inboxTrash={inboxTrash} library={library} noteTrash={noteTrash} folders={folders} themes={themes} systemLanguage={systemLanguage} onDeleteSignal={onDeleteSignal} onRestoreSignal={onRestoreSignal} onDeleteSignalForever={onDeleteSignalForever} onDeleteNote={onDeleteNote} onRestoreNote={onRestoreNote} onDeleteNoteForever={onDeleteNoteForever} onSelectSignal={handleSelectSignal} onCapture={onCapture} onDragWarn={handleDragWarnCallback} onAddFolder={onAddFolder} onUpdateFolder={onUpdateFolder} onDeleteFolder={onDeleteFolder} onAddTheme={onAddTheme} onUpdateTheme={onUpdateTheme} onDeleteTheme={onDeleteTheme} onAddSelectedToFolder={handleAddSelectedToFolder} canUsePremiumFeatures={canUsePremiumFeatures} isReadOnly={isReadOnly} />
            {previewSignal && (
                <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreviewSignal(null)}>
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{previewSignal.platform} Signal</span><h2 className="text-xl font-black text-gray-900 leading-tight">{previewSignal.title}</h2></div>
                            <button onClick={() => setPreviewSignal(null)} className="p-2 hover:bg-gray-200 rounded-full"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div><h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3 flex items-center"><FileText className="w-4 h-4 mr-2" /> Summary</h3><div className="space-y-2">{previewSignal.summary.map((s, i) => (<div key={i} className="flex items-start text-sm text-gray-600 leading-relaxed"><span className="mr-3 mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"></span>{s}</div>))}</div></div>
                            {previewSignal.generatedQuiz && previewSignal.generatedQuiz.length > 0 && (
                                <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100"><h3 className="text-xs font-bold text-blue-900 uppercase tracking-widest mb-4 flex items-center"><HelpCircle className="w-4 h-4 mr-2" /> Quiz Preview</h3><div className="space-y-4">{previewSignal.generatedQuiz.map((q, i) => (<div key={i} className="bg-white p-4 rounded-xl border border-blue-100/50 shadow-sm"><p className="text-xs font-bold text-gray-900 mb-2">{i+1}. {q.question}</p><div className="grid grid-cols-1 md:grid-cols-2 gap-2">{q.options.map((opt, oi) => { const userSelection = previewQuizAnswers[i]; const hasAnswered = userSelection !== undefined; const isCorrect = oi === q.correctAnswerIndex; const isSelected = userSelection === oi; let styleClass = "bg-gray-50 border-gray-100 text-gray-600 hover:bg-white hover:border-gray-300"; if (hasAnswered) { if (isCorrect) styleClass = "bg-green-50 border-green-200 text-green-800 font-bold shadow-sm"; else if (isSelected) styleClass = "bg-red-50 border-red-200 text-red-800 font-bold"; else styleClass = "bg-white border-gray-100 text-gray-400 opacity-50"; } return (<button key={oi} onClick={() => setPreviewQuizAnswers(prev => ({...prev, [i as any]: oi}))} className={`text-[10px] px-3 py-2 rounded-lg border text-left transition-all flex justify-between items-center ${styleClass}`}><span className="mr-2">{opt}</span>{hasAnswered && isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}{hasAnswered && isSelected && !isCorrect && <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}</button>); })}</div></div>))}</div></div>
                            )}
                        </div>
                        {!isReadOnly && (
                            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                                <button onClick={() => { onDeleteSignal(previewSignal.id); setPreviewSignal(null); }} className="text-xs font-bold text-red-500 hover:text-red-700 px-4 py-2">Discard</button>
                                <button onClick={() => { onKeepSignal(previewSignal, undefined, previewQuizAnswers); setPreviewSignal(null); }} className="bg-black text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:scale-105 transition shadow-lg flex items-center"><Check className="w-4 h-4 mr-2" /> Save to Library</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {activeCanvas && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[60] bg-white/90 backdrop-blur-md px-6 py-2 rounded-full border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex items-center group/title cursor-text" onClick={(e) => handleStartCanvasRename(e, activeCanvas)} data-html2canvas-ignore="true" >
                    {editingCanvasTitleId === activeCanvas.id ? (
                        <input value={tempCanvasTitleVal} onChange={(e) => setTempCanvasTitleVal(e.target.value)} onBlur={(e) => handleSaveCanvasRename(e)} onKeyDown={(e) => e.key === 'Enter' && handleSaveCanvasRename(e)} autoFocus className="bg-transparent font-bold text-sm text-gray-900 focus:outline-none text-center min-w-[200px]" onClick={(e) => e.stopPropagation()} />
                    ) : (
                        <>
                            <span className="font-bold text-sm text-gray-900 mr-2">{activeCanvas.title}</span>
                            {!isReadOnly && <Edit2 className="w-3 h-3 text-gray-400 opacity-0 group-hover/title:opacity-100 transition-opacity" />}
                        </>
                    )}
                </div>
            )}
            {activeCanvas && (
                <div className="absolute top-6 right-6 z-[100] flex gap-2 pointer-events-auto" data-html2canvas-ignore="true">
                    <button onClick={() => handleExport('pdf')} disabled={isExporting} className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all font-bold text-xs flex items-center text-gray-700 hover:text-black cursor-pointer pointer-events-auto">
                        {isExporting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <FileExport className="w-3 h-3 mr-2" />} PDF
                    </button>
                    <button onClick={() => handleExport('md')} disabled={isExporting} className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all font-bold text-xs flex items-center text-gray-700 hover:text-black cursor-pointer pointer-events-auto">
                        <FileText className="w-3 h-3 mr-2" /> MD
                    </button>
                </div>
            )}
            <div ref={canvasRef} tabIndex={0} id="canvas-wrapper-id" className={`flex-1 relative overflow-hidden select-none touch-none overscroll-none outline-none ${interactionMode === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} onPointerCancel={handlePointerUp} onDoubleClick={(e) => !isReadOnly && handleCanvasDoubleClick(e)} onPaste={(e) => !isReadOnly && handleCanvasPaste(e)} onDragOver={(e) => !isReadOnly && handleCanvasDragOver(e)} onDrop={(e) => !isReadOnly && handleCanvasDrop(e)} style={{ backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)', backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`, backgroundPosition: `${viewport.x}px ${viewport.y}px`, touchAction: 'none', overscrollBehavior: 'none' }}>
                <div id="canvas-inner-id" className="absolute top-0 left-0 w-full h-full origin-top-left" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}>
                    {localGroups.map(group => (
                        <div 
                            key={group.id}
                            onPointerDown={(e) => {
                                if (interactionMode === 'pan' || isReadOnly) return;
                                e.stopPropagation();
                                setActiveDragNode(group.id);
                                
                                // Find all nodes inside this group
                                const nodesInGroup = localNodes.filter(n => {
                                    const nx = n.x;
                                    const ny = n.y;
                                    const nw = n.width || 250;
                                    const nh = 200; // default height
                                    return nx >= group.x && nx + nw <= group.x + group.width &&
                                           ny >= group.y && ny + nh <= group.y + group.height;
                                }).map(n => ({ id: n.id, startX: n.x, startY: n.y }));

                                dragStartValues.current = { 
                                    mouseX: e.clientX, 
                                    mouseY: e.clientY, 
                                    nodeX: group.x, 
                                    nodeY: group.y,
                                    groupNodes: nodesInGroup
                                };
                                (e.currentTarget as Element).setPointerCapture(e.pointerId);
                            }}
                            className={`absolute rounded-[40px] border-2 border-dashed border-black/10 flex flex-col items-center justify-start pt-4 group/group ${activeDragNode === group.id ? 'cursor-grabbing' : 'cursor-grab'} pointer-events-auto`}
                            style={{
                                left: group.x,
                                top: group.y,
                                width: group.width,
                                height: group.height,
                                backgroundColor: group.color,
                                opacity: 0.3,
                                zIndex: 0
                            }}
                        >
                            <div className="flex items-center space-x-2">
                                <input 
                                    value={group.title}
                                    onChange={(e) => {
                                        if (isReadOnly) return;
                                        setLocalGroups(prev => prev.map(g => g.id === group.id ? { ...g, title: e.target.value } : g));
                                    }}
                                    readOnly={isReadOnly}
                                    className="bg-transparent text-sm font-black text-black/60 uppercase tracking-[0.3em] text-center focus:outline-none focus:text-black transition-colors pointer-events-auto"
                                />
                                {!isReadOnly && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setLocalGroups(prev => prev.filter(g => g.id !== group.id));
                                        }}
                                        className="opacity-0 group-hover/group:opacity-100 transition-opacity p-1 hover:bg-black/10 rounded-full pointer-events-auto"
                                    >
                                        <X className="w-3 h-3 text-black/40" />
                                    </button>
                                )}
                            </div>
                            {/* Resize handle for group */}
                            {!isReadOnly && (
                                <div 
                                    className="absolute bottom-4 right-4 w-6 h-6 cursor-se-resize flex items-end justify-end p-1 hover:bg-black/10 rounded-br-lg pointer-events-auto group/resize"
                                    onPointerDown={(e) => {
                                        if (interactionMode === 'pan') return;
                                        e.stopPropagation();
                                        setIsResizing(true);
                                        setResizeNodeId(group.id);
                                        resizeStartValues.current = { 
                                            mouseX: e.clientX, 
                                            mouseY: e.clientY, 
                                            width: group.width, 
                                            height: group.height 
                                        };
                                        (e.currentTarget as Element).setPointerCapture(e.pointerId);
                                    }}
                                >
                                    <div className="w-3 h-3 border-r-[3px] border-b-[3px] border-black/40 group-hover/resize:border-black/70 transition-colors"></div>
                                </div>
                            )}
                        </div>
                    ))}
                    <svg className="absolute inset-0 pointer-events-none overflow-visible z-[0]" width="100%" height="100%">{renderedEdges}</svg>
                    {/* Render handles above nodes */}
                    <svg className="absolute inset-0 pointer-events-none overflow-visible z-[110]" width="100%" height="100%">{renderedHandles}</svg>
                    {selectionBox && (
                        <div 
                            className="absolute border-2 border-blue-400 bg-blue-100/20 pointer-events-none z-[100]"
                            style={{
                                left: Math.min(selectionBox.startX, selectionBox.endX),
                                top: Math.min(selectionBox.startY, selectionBox.endY),
                                width: Math.abs(selectionBox.startX - selectionBox.endX),
                                height: Math.abs(selectionBox.startY - selectionBox.endY)
                            }}
                        />
                    )}
                    {localNodes.map(node => {
                        const critique = node.critique;
                        const isBeingScanned = scanningNodeId === node.id;
                        const isSelected = selectedNodeIds.has(node.id);
                        const isCritiqueVisible = expandedCritiques[node.id]; 
                        const isNeuralDump = node.source === 'neural_dump';
                        const isSpark = node.type === 'spark' || node.type === 'insight' || node.color === '#F59E0B'; 
                        const isAlchemy = node.type === 'asset' || node.color === '#10B981';
                        const isCollider = node.type === 'synthesis' || node.type === 'conflict' || node.type === 'collision' || node.color === '#A855F7'; 
                        const isFolder = node.type === 'folder';
                        const isSource = !isNeuralDump && !isSpark && !isAlchemy && !isCollider && !isFolder;
                        const isManualNote = node.type === 'note' || node.source === 'manual' || (!node.source && !node.noteId && isSource);
                        const nodeHasHistory = isSynthesis(node); 
                        const isEditing = editingNodeId === node.id;
                        const nodeX = Math.round(node.x);
                        const nodeY = Math.round(node.y);
                        const linkedNote = node.noteId ? noteMap.get(node.noteId) : null;
                        const hasFiles = linkedNote?.userFiles && linkedNote.userFiles.length > 0;
                        const noteFolderId = node.folderId || linkedNote?.folder;
                        const folder = noteFolderId ? folders.find(f => f.id === noteFolderId) : null;
                        const activeColor = folder?.color;
                        
                        let cardClasses = "bg-white border-blue-200 shadow-sm"; 
                        let inlineStyle: React.CSSProperties = { left: nodeX, top: nodeY, width: node.width || 250, zIndex: activeDragNode === node.id || isEditing ? 100 : (isSelected ? 50 : 1) };

                        if (isFolder) {
                            const f = folders.find(f => f.id === node.folderId);
                            if (f?.color && f.color.startsWith('#')) {
                                inlineStyle.backgroundColor = `${f.color}15`;
                                inlineStyle.borderColor = f.color;
                                inlineStyle.borderWidth = '2px';
                            } else {
                                cardClasses = f?.color ? `bg-${f.color}-50 border-${f.color}-200 shadow-sm` : "bg-gray-50 border-gray-200 shadow-sm";
                            }
                        } else if (activeColor && activeColor.startsWith('#')) {
                            inlineStyle.backgroundColor = activeColor;
                            inlineStyle.borderColor = activeColor;
                            inlineStyle.borderWidth = '2px';
                            // Ensure text is readable on solid backgrounds
                            inlineStyle.color = '#000000'; 
                        } else if (node.customColor && node.customColor.startsWith('#')) {
                            inlineStyle.backgroundColor = `${node.customColor}15`;
                            inlineStyle.borderColor = node.customColor;
                            inlineStyle.borderWidth = '2px';
                        } else if (node.customColor) {
                            cardClasses = `${node.customColor} shadow-sm`;
                        } else if (isNeuralDump) {
                            cardClasses = "bg-blue-50 border-blue-200 shadow-sm";
                        } else if (isSpark) {
                            cardClasses = "bg-amber-50 border-amber-200 shadow-sm";
                        } else if (isAlchemy) {
                            cardClasses = "bg-emerald-50 border-emerald-200 shadow-sm";
                        } else if (isCollider) {
                            cardClasses = "bg-violet-50 border-violet-200 shadow-sm";
                        }
                        
                        let label = isFolder ? 'FOLDER' : (isNeuralDump ? 'NEURAL DUMP' : (isSpark ? 'SPARK' : isAlchemy ? 'ALCHEMY' : (isCollider ? 'COLLIDER' : (isManualNote ? 'NOTE' : 'SOURCE'))));
                        if (folder) label = `${label} - ${folder.name}`;
                        let ringColor = 'ring-blue-500 border-blue-500'; 
                        if (isSpark) ringColor = 'ring-amber-500 border-amber-500';
                        if (isAlchemy) ringColor = 'ring-emerald-500 border-emerald-500';
                        if (isCollider) ringColor = 'ring-violet-500 border-violet-500';
                        if (isNeuralDump) ringColor = 'ring-blue-600 border-blue-600';
                        let critiqueStatus = null;
                        if (critique) {
                            if (critique.structuredAnalysis) {
                                const logicStatus = critique.structuredAnalysis.logic?.status?.toLowerCase() || '';
                                const factualStatus = critique.structuredAnalysis.factual?.status?.toLowerCase() || '';
                                const balanceStatus = critique.structuredAnalysis.balance?.status?.toLowerCase() || '';
                                if (logicStatus.includes('fallacy') || factualStatus.includes('unverified')) critiqueStatus = 'danger';
                                else if (balanceStatus.includes('skewed') || balanceStatus.includes('echo')) critiqueStatus = 'warning';
                                else critiqueStatus = 'safe';
                            } else {
                                critiqueStatus = critique.isSafe ? 'safe' : 'danger';
                            }
                        }
                        return (
                            <div key={node.id} id={`node-${node.id}`} onPointerDown={(e) => handleNodePointerDown(e, node)} onPointerUp={(e) => { if (drawingEdge || reconnectingEdge) handleEdgeDrawEnd(e, node); }} onDoubleClick={(e) => { 
                                e.stopPropagation(); 
                                if (!isReadOnly) {
                                    setEditingNodeId(node.id); setTempNodeTitle(node.title || ""); setTempNodeContent(node.content || ""); 
                                }
                            }} className={`absolute rounded-2xl border p-4 group hover:shadow-xl transition-shadow select-none h-auto min-h-[150px] ${interactionMode === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${isSelected ? `ring-2 ${ringColor} z-50` : ''} ${isEditing ? 'ring-2 ring-blue-500 z-[100]' : ''} ${cardClasses} ${critiqueStatus === 'danger' && isCritiqueVisible ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : ''} ${critiqueStatus === 'safe' && isCritiqueVisible ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : ''}`} style={inlineStyle} >
                                {!isReadOnly && (
                                    <>
                                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border border-blue-400 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-50 flex items-center justify-center shadow-sm hover:scale-125 active:scale-95" onPointerDown={(e) => handleEdgeDrawStart(e, node)}>
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        </div>
                                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border border-blue-400 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-50 flex items-center justify-center shadow-sm hover:scale-125 active:scale-95" onPointerDown={(e) => handleEdgeDrawStart(e, node)}>
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        </div>
                                        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border border-blue-400 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-50 flex items-center justify-center shadow-sm hover:scale-125 active:scale-95" onPointerDown={(e) => handleEdgeDrawStart(e, node)}>
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        </div>
                                        <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border border-blue-400 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity z-50 flex items-center justify-center shadow-sm hover:scale-125 active:scale-95" onPointerDown={(e) => handleEdgeDrawStart(e, node)}>
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        </div>
                                    </>
                                )}
                                <div className="absolute top-1.5 right-1.5 flex items-center space-x-1.5 z-50 opacity-0 group-hover:opacity-100 transition-all">
                                    {onOpenChat && (
                                        <button onClick={(e) => { 
                                            e.stopPropagation(); 
                                            if (selectedNodeIds.size > 1 && selectedNodeIds.has(node.id)) {
                                                onOpenChat(); // Open chat with all selected nodes
                                            } else {
                                                setSelectedNodeIds(new Set([node.id]));
                                                onOpenChat(node.noteId || node.id); 
                                            }
                                        }} className="p-1 bg-white border border-gray-200 text-gray-900 rounded-lg transition-all transform hover:scale-110 active:scale-95 shadow-sm hover:shadow-md" title="Chat with Ko" > <KoLogo className="w-3.5 h-3.5" /> </button>
                                    )}
                                    {!isReadOnly && (
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }} className="bg-white/80 hover:bg-red-500 hover:text-white text-gray-400 rounded-full p-1 transition-all shadow-sm" title="Delete Node" > <X className="w-3 h-3" /> </button>
                                    )}
                                </div>
                                {isSelected && !isEditing && !isReadOnly && ( <div className="absolute bottom-3 right-3 w-6 h-6 cursor-se-resize z-50 flex items-end justify-end p-1 hover:bg-black/5 rounded-br-lg group/resize" onPointerDown={(e) => handleResizeStart(e, node)} > <div className="w-2 h-2 border-r-2 border-b-2 border-gray-300 group-hover/resize:border-blue-500 transition-colors"></div> </div> )}
                                {isCritiqueVisible && critiqueStatus === 'danger' && <div className="absolute -top-3 -right-2 z-20 bg-red-600 text-white px-3 py-1 text-[9px] font-bold tracking-wider rounded-full shadow-lg flex items-center gap-1 animate-in slide-in-from-bottom-2"><AlertTriangle size={10} fill="white" className="text-white" /> FALLACY DETECTED</div>}
                                {isCritiqueVisible && critiqueStatus === 'warning' && <div className="absolute -top-3 -right-2 z-20 bg-amber-500 text-white px-3 py-1 text-[9px] font-bold tracking-wider rounded-full shadow-lg flex items-center gap-1 animate-in slide-in-from-bottom-2"><Zap size={10} fill="white" className="text-white" /> COGNITIVE SKEW</div>}
                                {isCritiqueVisible && critiqueStatus === 'safe' && <div className="absolute -top-3 -right-2 z-20 bg-emerald-600 text-white px-3 py-1 text-[9px] font-bold tracking-wider rounded-full shadow-lg flex items-center gap-1 animate-in slide-in-from-bottom-1"><CheckCircle2 size={10} fill="white" className="text-white" /> SOLID LOGIC</div>}
                                {isBeingScanned && <div className="absolute inset-0 z-50 rounded-2xl bg-[#00FF41]/10 overflow-hidden pointer-events-none"><div className="absolute top-0 w-full h-1 bg-[#00FF41] shadow-[0_0_15px_#00FF41] animate-scanline"></div><div className="absolute bottom-2 right-2 text-[9px] font-mono font-bold text-[#00FF41] animate-pulse">LOGIC_SCANNING...</div></div>}
                                {isEditing ? (
                                    <div className="flex flex-col h-full space-y-2 relative z-50" onPointerDown={e => e.stopPropagation()}>
                                        <input value={tempNodeTitle} onChange={(e) => setTempNodeTitle(e.target.value)} className="font-bold text-sm bg-transparent border-b-2 border-blue-500 focus:outline-none pb-1 text-gray-900 w-full" placeholder={t("Title...", getSystemLanguage())} autoFocus />
                                        <textarea value={tempNodeContent} onChange={(e) => setTempNodeContent(e.target.value)} className="flex-1 text-[10px] bg-white/50 border border-gray-200 rounded p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none min-h-[100px] text-gray-700 leading-relaxed" placeholder={t("Type your note here...", getSystemLanguage())} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { handleSaveNodeEdit(); } }} />
                                        <div className="flex justify-end pt-2"><button onClick={handleSaveNodeEdit} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700 flex items-center"><Check className="w-3 h-3 mr-1" /> Save</button></div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-black/5">
                                            <div className="flex items-center space-x-2">
                                                <span className={`text-[9px] font-black uppercase tracking-widest ${isSpark ? 'text-amber-800 flex items-center' : isAlchemy ? 'text-emerald-800 flex items-center' : isCollider ? 'text-violet-800 flex items-center' : isNeuralDump ? 'text-blue-800 flex items-center' : 'text-blue-700 flex items-center'}`}>
                                                    {isSpark && <Sparkles className="w-3 h-3 mr-1 text-amber-500" />}
                                                    {isAlchemy && <FlaskConical className="w-3 h-3 mr-1 text-emerald-500" />}
                                                    {isCollider && <Zap className="w-3 h-3 mr-1 text-violet-500" />}
                                                    {isNeuralDump && <BrainCircuit className="w-3 h-3 mr-1 text-blue-500" />}
                                                    {label}
                                                </span>
                                            </div>
                                        </div>
                                        {node.question && <div className="mb-3 px-2 py-1.5 bg-white/50 rounded-lg border border-black/5"><p className="text-[9px] text-gray-400 font-bold uppercase mb-0.5">Asked:</p><p className="text-[10px] text-gray-600 font-medium italic line-clamp-2">"{node.question}"</p></div>}
                                        <h4 className={`font-bold text-sm mb-2 leading-snug break-words ${isSpark ? 'text-amber-900' : isAlchemy ? 'text-emerald-900' : isCollider ? 'text-violet-900' : isNeuralDump ? 'text-blue-900' : 'text-gray-900'}`}>{node.title || 'Untitled'}</h4>
                                        {node.isThinking ? (
                                            <div className="bg-black/90 p-4 rounded-xl"><ReasoningTrace title="Processing" platform={isSpark ? "Spark" : isAlchemy ? "Alchemy" : isNeuralDump ? "Neural Dump" : "Collider"} type="synthesis" thinking={node.thinking} /></div>
                                        ) : (
                                            <>
                                                {node.imageUrl && (
                                                    <div className="mb-3 rounded-lg overflow-hidden border border-black/10 group/image relative cursor-zoom-in" onClick={(e) => { e.stopPropagation(); setZoomedImage(node.imageUrl!); }}>
                                                        <img src={node.imageUrl} alt="Generated" className="w-full h-auto object-cover max-h-60" />
                                                        <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover/image:opacity-100"><ZoomIn className="w-6 h-6 text-white drop-shadow-md" /></div>
                                                    </div>
                                                )}
                                                
                                                {/* Cover Image/Video for Pasted Files */}
                                                {hasFiles && linkedNote?.userFiles?.[0] && (
                                                    <div className="mb-3 rounded-lg overflow-hidden border border-black/10 relative bg-gray-50 flex items-center justify-center cursor-pointer group/cover" onClick={(e) => { e.stopPropagation(); setSelectedNodeIds(new Set([node.id])); node.noteId && onOpenChat?.(node.noteId, 0); }}>
                                                        {(() => {
                                                            const fileData = linkedNote.userFiles[0];
                                                            if (fileData.startsWith('data:image')) {
                                                                return <img src={fileData} className="w-full h-auto object-cover max-h-32" alt="Cover" />;
                                                            } else if (fileData.startsWith('data:video')) {
                                                                return (
                                                                    <div className="w-full h-32 bg-black flex items-center justify-center relative">
                                                                        <video src={fileData} className="w-full h-full object-cover opacity-50" />
                                                                        <Play className="w-8 h-8 text-white absolute drop-shadow-md" />
                                                                    </div>
                                                                );
                                                            } else if (fileData.startsWith('data:audio')) {
                                                                return (
                                                                    <div className="w-full h-24 bg-blue-50 flex flex-col items-center justify-center relative">
                                                                        <Mic className="w-8 h-8 text-blue-400 mb-1" />
                                                                        <span className="text-[9px] font-bold text-blue-400 tracking-widest">AUDIO</span>
                                                                    </div>
                                                                );
                                                            } else {
                                                                const mimeType = fileData.split(';')[0].split(':')[1] || '';
                                                                let Icon = FileText;
                                                                let colorClass = "text-blue-300";
                                                                let bgClass = "bg-blue-50";
                                                                let label = "DOCUMENT";
                                                                
                                                                if (mimeType.includes('pdf')) {
                                                                    colorClass = "text-red-400";
                                                                    bgClass = "bg-red-50";
                                                                    label = "PDF";
                                                                } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
                                                                    Icon = FileSpreadsheet;
                                                                    colorClass = "text-green-400";
                                                                    bgClass = "bg-green-50";
                                                                    label = "SPREADSHEET";
                                                                } else if (mimeType.includes('word')) {
                                                                    colorClass = "text-blue-500";
                                                                    bgClass = "bg-blue-50";
                                                                    label = "WORD DOC";
                                                                } else if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('html')) {
                                                                    Icon = FileCode;
                                                                    colorClass = "text-yellow-500";
                                                                    bgClass = "bg-yellow-50";
                                                                    label = "CODE";
                                                                }

                                                                return (
                                                                    <div className={`w-full h-24 flex flex-col items-center justify-center ${bgClass}`}>
                                                                        <Icon className={`w-8 h-8 ${colorClass} mb-1`} />
                                                                        <span className={`text-[9px] font-bold ${colorClass} tracking-widest`}>{label}</span>
                                                                    </div>
                                                                );
                                                            }
                                                        })()}
                                                        <div className="absolute inset-0 bg-black/0 group-hover/cover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover/cover:opacity-100">
                                                            <MessageSquare className="w-6 h-6 text-white drop-shadow-md" />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Link Cover */}
                                                {String(node.content || "").startsWith('http') && !hasFiles && (
                                                    <div className="mb-3 rounded-lg overflow-hidden border border-blue-100 bg-blue-50 p-3 flex items-center space-x-3 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => window.open(String(node.content || ""), '_blank')}>
                                                        <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0">
                                                            <Link className="w-5 h-5 text-blue-600" />
                                                        </div>
                                                        <div className="overflow-hidden flex-1">
                                                            <p className="text-xs font-bold text-blue-900 break-words line-clamp-2">{node.content}</p>
                                                            <p className="text-[9px] text-blue-600 uppercase tracking-widest mt-0.5">External Link</p>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className={`text-[10px] whitespace-pre-wrap leading-relaxed break-words ${isSpark ? 'text-amber-800' : isAlchemy ? 'text-emerald-800' : isCollider ? 'text-violet-800' : isNeuralDump ? 'text-blue-800' : 'text-gray-500'}`}>{renderMarkdown(String(node.content || ""))}</div>
                                                {hasFiles && (
                                                    <div className="mt-3 pt-2 border-t border-dashed border-gray-200/50 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                                        {linkedNote?.userFiles?.map((f, i) => (
                                                            <div key={i} onClick={(e) => { e.stopPropagation(); setSelectedNodeIds(new Set([node.id])); node.noteId && onOpenChat?.(node.noteId, i); }} className="w-8 h-8 flex-shrink-0 rounded border border-gray-100 bg-gray-50 overflow-hidden flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors" title="Chat with this file">
                                                                {f.startsWith('data:image') ? (
                                                                    <img src={f} className="w-full h-full object-cover" alt="attachment" />
                                                                ) : f.startsWith('data:video') ? (
                                                                    <Play className="w-4 h-4 text-blue-500" />
                                                                ) : f.startsWith('data:audio') ? (
                                                                    <Mic className="w-4 h-4 text-blue-500" />
                                                                ) : f.includes('application/pdf') ? (
                                                                    <FileText className="w-4 h-4 text-red-400" />
                                                                ) : f.includes('spreadsheet') || f.includes('excel') || f.includes('csv') ? (
                                                                    <FileSpreadsheet className="w-4 h-4 text-green-400" />
                                                                ) : f.includes('word') ? (
                                                                    <FileText className="w-4 h-4 text-blue-500" />
                                                                ) : f.includes('json') || f.includes('javascript') || f.includes('html') ? (
                                                                    <FileCode className="w-4 h-4 text-yellow-500" />
                                                                ) : (
                                                                    <FileText className="w-4 h-4 text-gray-400" />
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {isCritiqueVisible && critique && (
                                            <div className="mt-3 bg-zinc-950 rounded-xl p-3 font-mono text-[9px] border border-zinc-800 shadow-lg relative overflow-hidden animate-slide-up text-zinc-300">
                                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${critiqueStatus === 'safe' ? 'bg-emerald-500' : critiqueStatus === 'warning' ? 'bg-amber-500' : 'bg-red-600'}`}></div>
                                                <div className="flex flex-col gap-3 relative z-10 pl-2">
                                                    <div className="flex items-center text-[8px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-1 mb-1">🛡️ CRITIC SCAN RESULTS</div>
                                                    {critique.structuredAnalysis ? (
                                                        <>
                                                            <div><div className="text-[8px] font-bold text-zinc-500 uppercase">1. 📊 FACTUAL ACCURACY</div><div className="pl-1"><div><span className="text-zinc-500 font-bold">Status:</span> {critique.structuredAnalysis.factual.status}</div><div><span className="text-zinc-500 font-bold">Issue:</span> {critique.structuredAnalysis.factual.issue}</div></div></div>
                                                            <div className="mt-1"><div className="text-[8px] font-bold text-zinc-500 uppercase">2. ⚖️ COGNITIVE BALANCE</div><div className="pl-1"><div><span className="text-zinc-500 font-bold">Status:</span> {critique.structuredAnalysis.balance.status}</div><div><span className="text-zinc-500 font-bold">Check:</span> {critique.structuredAnalysis.balance.check}</div></div></div>
                                                            <div className="mt-1"><div className="text-[8px] font-bold text-zinc-500 uppercase">3. 🧠 LOGICAL INTEGRITY</div><div className="pl-1"><div><span className="text-zinc-500 font-bold">Status:</span> {critique.structuredAnalysis.logic.status}</div><div><span className="text-zinc-500 font-bold">Type:</span> {critique.structuredAnalysis.logic.type}</div><div><span className="text-zinc-500 font-bold">Explanation:</span> {critique.structuredAnalysis.logic.explanation}</div></div></div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="flex items-start"><span className={`${critique.isSafe ? 'text-emerald-500' : 'text-red-500'} font-bold mr-2 shrink-0`}>{'>'} {critique.isSafe ? 'STATUS:' : 'ISSUE:'}</span><span className="leading-tight">{critique.issue || "Analyzed"}</span></div>
                                                            <div className="flex items-start"><span className="text-blue-400 font-bold mr-2 shrink-0">{'>'} {critique.isSafe ? 'ACTION:' : 'FIX:'}</span><span className="leading-tight">{critique.fix || "No action needed."}</span></div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {nodeHasHistory && !node.isThinking && (
                                            <div className={`mt-3 flex items-center justify-between border-t border-black/5 pt-2`}>
                                                <div className="flex items-center space-x-1">
                                                    <button onClick={(e) => {e.stopPropagation(); navigateHistory(node, 'prev')}} disabled={!node.historyIndex || node.historyIndex === 0} className="p-1 hover:bg-black/5 rounded disabled:opacity-30"><ChevronLeft className="w-3 h-3" /></button>
                                                    <span className={`text-[8px] font-bold ${isSpark ? 'text-amber-400' : isAlchemy ? 'text-emerald-400' : 'text-violet-300'}`}>V{(node.historyIndex || 0) + 1}</span>
                                                    <button onClick={(e) => {e.stopPropagation(); navigateHistory(node, 'next')}} disabled={node.historyIndex === (node.synthesisHistory?.length || 1) - 1} className="p-1 hover:bg-black/5 rounded disabled:opacity-30"><ChevronRight className="w-3 h-3" /></button>
                                                    <button onClick={(e) => {e.stopPropagation(); regenerateNode(node)}} className={`p-1 hover:bg-black/5 rounded ml-1 ${isSpark ? 'text-amber-600' : isAlchemy ? 'text-emerald-600' : 'text-violet-500'}`} title="Regenerate"><RefreshCw className="w-3 h-3" /></button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            <MotionDiv drag dragMomentum={false} className="fixed bottom-8 left-1/2 z-50 flex flex-col items-center cursor-move" style={{ x: '-50%' }} onPointerDown={(e) => e.stopPropagation()} >
                 <div className="bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 rounded-full p-2 flex items-center space-x-1 pointer-events-auto">
                    <ToolbarButton onClick={handleGoHomeCallback} icon={<ArrowLeft className="w-5 h-5 text-gray-600" />} title="Back" description="Return to all canvases" className="hover:bg-gray-100" />
                    <div className="w-px h-8 bg-gray-100 mx-1"></div>
                    <ToolbarButton onClick={() => { if (canUsePremiumFeatures('Inbox')) { setDrawerActiveTab('inbox'); setDrawerOpen(true); } }} icon={<Inbox className="w-5 h-5 text-purple-500" />} title="Inbox" description="Capture and process signals" className="hover:bg-purple-50" isLocked={isInboxLocked} />
                    <ToolbarButton onClick={() => { setDrawerActiveTab('assets'); setDrawerOpen(true); }} icon={<Database className="w-5 h-5 text-amber-500" />} title="Library" description="Browse your assets" className="hover:bg-amber-50" />
                    <div className="w-px h-8 bg-gray-100 mx-1"></div>
                    <ToolbarButton onClick={onGoToLibrary} icon={<Brain className="w-5 h-5 text-pink-500" />} title="Brain" description="View your knowledge archive" className="hover:bg-pink-50" />
                    <ToolbarButton 
                        onClick={() => selectedEdgeIds.size > 0 ? handleEdgeAIAction('neural_dump') : onOpenNeuralDump()} 
                        icon={
                            <div className="flex items-center space-x-2 px-1">
                                <Mic className="w-5 h-5 text-red-500" />
                            </div>
                        } 
                        title="Neural Dump" 
                        description="Double tap space to activate. Voice-to-text synthesis" 
                        className="hover:bg-red-50 rounded-xl" 
                        isLocked={isNeuralDumpLocked} 
                    />
                    <ToolbarButton onClick={onEnterMemoryLab} icon={<BrainCircuit className="w-5 h-5 text-blue-600" />} title="Memory Lab" description="Analyze retention and recall" className="hover:bg-blue-50" isLocked={isMemoryLabLocked} />
                    <ToolbarButton onClick={() => setInteractionMode(prev => prev === 'select' ? 'pan' : 'select')} icon={interactionMode === 'pan' ? <Move className="w-5 h-5" /> : <MousePointer2 className="w-5 h-5" />} title="Interact" description={interactionMode === 'pan' ? 'Switch to Select Mode' : 'Switch to Pan Mode'} active={interactionMode === 'pan'} />
                    {!isReadOnly && (
                        <>
                            <div className="w-px h-8 bg-gray-100 mx-1"></div>
                            <ToolbarButton onClick={handleAddNote} icon={<Plus className="w-5 h-5" />} title="New Note" description="Create a new memory node" />
                            <div className="relative group/arrange">
                                <ToolbarButton onClick={() => {}} icon={<LayoutGrid className="w-5 h-5" />} title="Arrange" description="Organize your thoughts" />
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 flex flex-col gap-1 z-50 opacity-0 invisible group-hover/arrange:opacity-100 group-hover/arrange:visible transition-all">
                                    <button onClick={handleQuickShift} onPointerDownCapture={(e) => e.stopPropagation()} className="px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 rounded-xl whitespace-nowrap flex items-center"><LayoutGrid className="w-4 h-4 mr-2" /> Auto Arrange</button>
                                    <button onClick={handleAutoArrangeWithKeywords} onPointerDownCapture={(e) => e.stopPropagation()} disabled={isThinking} className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap flex items-center ${isThinking ? 'text-gray-400 bg-gray-50 cursor-not-allowed' : 'text-indigo-600 hover:bg-indigo-50'}`}>{isThinking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Hexagon className="w-4 h-4 mr-2" />} {isThinking ? 'Processing...' : 'Thematic Arrange'} {!canUsePremiumFeatures('ThematicArrange', true) && <Lock className="w-3 h-3 ml-2 text-gray-400" />}</button>
                                </div>
                            </div>
                            <div className="w-px h-8 bg-gray-100 mx-1"></div>
                            <ToolbarButton onClick={() => selectedEdgeIds.size > 0 ? handleEdgeAIAction('collider') : handleCollider()} icon={<Zap className="w-5 h-5 fill-current text-purple-500" />} title="Collider" description="Synthesize two conflicting ideas" disabled={selectedNodeIds.size < 2 && selectedEdgeIds.size === 0} className="hover:bg-purple-50" isLocked={!canUsePremiumFeatures('Collider', true)} />
                            <ToolbarButton onClick={() => selectedEdgeIds.size > 0 ? handleEdgeAIAction('alchemy') : handleAlchemy()} icon={<FlaskConical className="w-5 h-5 text-emerald-500" />} title="Alchemy" description="Transform multiple notes into gold" disabled={selectedNodeIds.size < 2 && selectedEdgeIds.size === 0} className="hover:bg-green-50" isLocked={!canUsePremiumFeatures('Alchemy', true)} />
                            <ToolbarButton onClick={() => selectedEdgeIds.size > 0 ? handleEdgeAIAction('spark') : handleSpark()} icon={<Sparkles className="w-5 h-5 fill-current text-yellow-500" />} title="Spark" description="Find serendipitous connections" disabled={selectedNodeIds.size !== 1 && selectedEdgeIds.size === 0} className="hover:bg-yellow-50" isLocked={!canUsePremiumFeatures('Spark', true)} />
                            <ToolbarButton onClick={() => selectedEdgeIds.size > 0 ? handleEdgeAIAction('logic_guard') : handleLogicScan()} icon={<Shield className="w-5 h-5 text-red-500" />} title="Logic Guard" description="Scan for logical fallacies" disabled={selectedNodeIds.size !== 1 && selectedEdgeIds.size === 0} className="hover:bg-red-50" isLocked={!canUsePremiumFeatures('LogicGuard', true)} />
                            <div className="w-px h-8 bg-gray-100 mx-1"></div>
                            <ToolbarButton onClick={undo} icon={<Undo2 className="w-5 h-5" />} title="Undo" description="Revert last change" disabled={historyIndex <= 0} />
                            <ToolbarButton onClick={redo} icon={<Redo2 className="w-5 h-5" />} title="Redo" description="Redo reverted change" disabled={historyIndex >= history.length - 1} />
                        </>
                    )}
                    <div className="w-px h-8 bg-gray-100 mx-1"></div>
                    <ToolbarButton onClick={() => setIsTrashOpen(true)} icon={<Trash2 className="w-5 h-5" />} title="Recycle Bin" description="View deleted items" />
                    <div className="w-px h-8 bg-gray-100 mx-1"></div>
                    <ToolbarButton onClick={() => setViewport(prev => ({ ...prev, zoom: Math.min(prev.zoom + 0.2, 5) }))} icon={<ZoomIn className="w-5 h-5" />} title="Zoom In" description="Zoom in" />
                    <ToolbarButton onClick={() => setViewport(prev => ({ ...prev, zoom: Math.max(prev.zoom - 0.2, 0.1) }))} icon={<ZoomOut className="w-5 h-5" />} title="Zoom Out" description="Zoom out" />
                </div>
            </MotionDiv>
            {zoomedImage && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" onClick={() => setZoomedImage(null)}>
                    <div className="relative max-w-full max-h-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setZoomedImage(null)} className="absolute -top-12 right-0 text-white/70 hover:text-white transition p-2 bg-black/50 rounded-full"><X className="w-6 h-6" /></button>
                        <img src={zoomedImage} className="max-w-[90vw] max-h-[85vh] rounded-lg shadow-2xl object-contain" alt="Zoomed Visual" />
                        <div className="mt-6"><a href={zoomedImage} download={`kno-visual-${Date.now()}.png`} className="px-8 py-3 bg-white text-black rounded-full font-bold text-xs uppercase tracking-widest hover:scale-105 transition shadow-lg flex items-center" onClick={(e) => e.stopPropagation()}><Download className="w-4 h-4 mr-2" /> Download Visual</a></div>
                    </div>
                </div>
            )}
            {isTrashOpen && (
                 <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsTrashOpen(false)}>
                     <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[70vh]" onClick={(e) => e.stopPropagation()}>
                         <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                             <h3 className="font-bold text-lg text-gray-900">Recycle Bin</h3>
                             <button onClick={() => setIsTrashOpen(false)} className="p-2 hover:bg-gray-200 rounded-full"><X className="w-5 h-5" /></button>
                         </div>
                         <div className="p-4 overflow-y-auto flex-1 bg-gray-50/50 space-y-3">
                             {deletedNodes.map((node, i) => (
                                 <div key={i} className="bg-white p-3 rounded-xl border border-gray-200 flex justify-between items-center">
                                     <span className="text-sm font-bold break-words line-clamp-2 w-40">{node.title}</span>
                                     {!isReadOnly && (
                                         <button onClick={() => handleRestoreDeletedNode(node)} className="text-xs text-blue-500 font-bold">Restore</button>
                                     )}
                                 </div>
                             ))}
                         </div>
                     </div>
                 </div>
            )}
            {summaryModal && (
                <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSummaryModal(null)}>
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div><span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Ko's Summary</span><h2 className="text-xl font-black text-gray-900 leading-tight">Source Insights</h2></div>
                            <button onClick={() => setSummaryModal(null)} className="p-2 hover:bg-gray-200 rounded-full"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="prose prose-sm max-w-none">
                                <div className="space-y-2">
                                    {summaryModal.split('\n').map((line, i) => (
                                        <div key={i} className="flex items-start text-sm text-gray-600 leading-relaxed">
                                            {line.trim().startsWith('-') && <span className="mr-3 mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"></span>}
                                            {line.replace(/^-/, '').trim()}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button onClick={() => setSummaryModal(null)} className="bg-black text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:scale-105 transition shadow-lg">Close</button>
                        </div>
                    </div>
                </div>
            )}
            {edgeMenuPosition && selectedEdgeIds.size > 0 && !isReadOnly && (
                <MotionDiv 
                    key={`${Array.from(selectedEdgeIds).join('-')}-${edgeMenuPosition.x}-${edgeMenuPosition.y}`}
                    drag
                    dragMomentum={false}
                    className="fixed z-[1000] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 w-64 cursor-move"
                    initial={{ 
                        left: (edgeMenuPosition.x * viewport.zoom + viewport.x) + 20, 
                        top: (edgeMenuPosition.y * viewport.zoom + viewport.y) + 20
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-4 pointer-events-auto">
                        <div className="flex flex-col">
                            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Edge Settings</h3>
                            <span className="text-[9px] text-blue-500 font-bold uppercase">{selectedEdgeIds.size} {selectedEdgeIds.size === 1 ? 'Edge' : 'Edges'} Selected</span>
                        </div>
                        <button onClick={() => { setSelectedEdgeIds(new Set()); setEdgeMenuPosition(null); }} className="p-1 hover:bg-gray-100 rounded-full transition-colors cursor-pointer">
                            <X className="w-4 h-4 text-gray-400" />
                        </button>
                    </div>

                    <div className="space-y-4 pointer-events-auto">
                        {/* Path Selection */}
                        {selectedEdgeIds.size === 1 && (
                            <button 
                                onClick={() => selectConnectedPath(Array.from(selectedEdgeIds)[0])}
                                className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                            >
                                <Share2 className="w-3 h-3" />
                                <span>Select Connected Path</span>
                            </button>
                        )}

                        {/* Color Picker */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Color</label>
                            <div className="flex flex-wrap gap-2 items-center">
                                {edgeColors.map(c => (
                                    <button 
                                        key={c.value} 
                                        onClick={() => updateSelectedEdges({ color: c.value })}
                                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer ${Array.from(selectedEdgeIds).every(id => localEdges.find(e => e.id === id)?.color === c.value) ? 'border-blue-500 scale-110' : 'border-transparent'}`}
                                        style={{ backgroundColor: c.value }}
                                        title={c.name}
                                    />
                                ))}
                                <input 
                                    type="color" 
                                    value={Array.from(selectedEdgeIds).length > 0 ? (localEdges.find(e => e.id === Array.from(selectedEdgeIds)[0])?.color || '#CBD5E1') : '#CBD5E1'} 
                                    onChange={(e) => updateSelectedEdges({ color: e.target.value })} 
                                    className="w-6 h-6 rounded cursor-pointer border-0 p-0 ml-1" 
                                    title="Custom Color"
                                />
                            </div>
                        </div>

                        {/* Line Style Picker */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Line Style</label>
                            <div className="flex gap-2">
                                {edgeStyles.map(s => (
                                    <button 
                                        key={s.value} 
                                        onClick={() => updateSelectedEdges({ lineStyle: s.value as any })}
                                        className={`flex-1 py-1 px-2 rounded border text-[9px] font-bold uppercase tracking-widest transition-colors cursor-pointer ${Array.from(selectedEdgeIds).every(id => localEdges.find(e => e.id === id)?.lineStyle === s.value) ? 'bg-blue-500 text-white border-blue-600' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}
                                    >
                                        {s.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Relationship Label */}
                        {selectedEdgeIds.size === 1 && (
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Relationship Label</label>
                                <input 
                                    type="text"
                                    placeholder={t("e.g. Suspect, Evidence, Cause...", getSystemLanguage())}
                                    value={localEdges.find(e => e.id === Array.from(selectedEdgeIds)[0])?.label || ''}
                                    onChange={(e) => updateSelectedEdges({ label: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all cursor-text"
                                    onPointerDown={(e) => e.stopPropagation()}
                                />
                            </div>
                        )}

                        {/* Delete Button */}
                        <button 
                            onClick={() => {
                                const newEdges = localEdges.filter(e => !selectedEdgeIds.has(e.id));
                                setLocalEdges(newEdges);
                                pushHistory(localNodes, newEdges);
                                setSelectedEdgeIds(new Set());
                                setEdgeMenuPosition(null);
                            }}
                            className="w-full py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center space-x-2 cursor-pointer mt-2"
                        >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete {selectedEdgeIds.size === 1 ? 'Edge' : 'Edges'}</span>
                        </button>
                    </div>
                </MotionDiv>
            )}
        </div>
    );
};

function isSynthesis(node: CanvasNode) {
    const t = node.type as string;
    return t === 'synthesis' || t === 'spark' || t === 'asset' || t === 'conflict' || (node.color && ['#F59E0B', '#10B981', '#A855F7'].includes(node.color));
}