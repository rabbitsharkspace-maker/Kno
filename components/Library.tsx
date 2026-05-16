
import React, { useState, useEffect, useMemo } from 'react';
import { Note, AppTheme, QuizFeedbackType, Folder, CanvasDocument, Theme } from '../types';
import { Search, Brain, BrainCircuit, ArrowRight, Sparkles, LayoutGrid, AlertTriangle, Trash2, RotateCw, HelpCircle, Plus, Edit2, Check, X, ChevronDown, Lock } from 'lucide-react';
import { SmartCard } from './SmartCard';
import { t } from '../src/i18n';
import { getSystemLanguage } from '../services/geminiService';

interface LibraryProps {
  library: Note[];
  theme: AppTheme;
  folders: Folder[];
  themes: Theme[];
  onUpdateNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  showDeleteWarning: boolean;
  onToggleDeleteWarning: (show: boolean) => void;
  usedNoteIds: Set<string>; 
  onQuizFeedback?: (itemId: string, feedback: QuizFeedbackType, suppress: boolean) => void;
  initialFocusedNoteId?: string | null;
  onFocusCleared?: () => void;
  trash: Note[];
  onRestoreNote: (note: Note) => void;
  onDeleteForever: (id: string) => void;
  onDeleteAll: () => void;
  onDuplicateNote: (note: Note) => void;
  onOpenMemoryLab: () => void;
  onOpenNeuralDump: () => void;
  onOpenChat: (noteId?: string, fileIndex?: number) => void; // Updated
  onAddFolder: (folder: Omit<Folder, 'id'>) => void;
  onUpdateFolder: (folder: Folder) => void;
  onDeleteFolder: (id: string) => void;
  onAddTheme: (theme: Omit<Theme, 'id'> & { id?: string }) => Theme;
  onUpdateTheme: (theme: Theme) => void;
  onDeleteTheme: (id: string) => void;
  canvases?: CanvasDocument[];
  onAddSelectedToFolder?: (folderId: string) => void;
  isMemoryLabLocked?: boolean;
  isNeuralDumpLocked?: boolean;
  canUseLogicGuard?: () => boolean;
  canUsePremiumFeatures?: (feature: 'LogicGuard' | 'MemoryLab' | 'NeuralDump' | 'Spark' | 'Alchemy' | 'MultipleCanvases' | 'Collider' | 'Export' | 'Folders' | 'Themes' | 'ThematicArrange' | 'Chat' | 'Quizzes' | 'Inbox', silent?: boolean) => boolean;
  onAIUsage?: () => void;
  isReadOnly?: boolean;
}

export const Library: React.FC<LibraryProps> = ({ library, theme, folders, themes, onUpdateNote, onDeleteNote, showDeleteWarning, initialFocusedNoteId, onFocusCleared, trash, onRestoreNote, onDeleteForever, onDeleteAll, onOpenMemoryLab, onOpenChat, onAddFolder, onUpdateFolder, onDeleteFolder, onAddTheme, onUpdateTheme, onDeleteTheme, onAddSelectedToFolder, isMemoryLabLocked, canUseLogicGuard, canUsePremiumFeatures, onAIUsage, isReadOnly = false }) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleFolderExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleThemeExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedThemes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const [filterMode, setFilterMode] = useState<'all' | 'revision'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  // Updated state to hold an array of selected tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');
  
  // Sidebar Tab State
  const [activeSidebarTab, setActiveSidebarTab] = useState<'sources' | 'folders' | 'themes'>(() => {
      const saved = localStorage.getItem('activeSidebarTab');
      return (saved as any) || 'sources';
  });

  useEffect(() => {
      localStorage.setItem('activeSidebarTab', activeSidebarTab);
  }, [activeSidebarTab]);

  // Delete Modal State
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Folder Management State
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3B82F6');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editFolderColor, setEditFolderColor] = useState('');

  // Theme Management State
  const [isAddingTheme, setIsAddingTheme] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeColor, setNewThemeColor] = useState('#3B82F6');
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [editThemeName, setEditThemeName] = useState('');
  const [editThemeColor, setEditThemeColor] = useState('');

  // Handle initial focus for deep-linking
  useEffect(() => {
    if (initialFocusedNoteId) {
        setExpandedId(initialFocusedNoteId);
        // Scroll to the item
        setTimeout(() => {
          const el = document.getElementById(`note-${initialFocusedNoteId}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        if (onFocusCleared) onFocusCleared();
    }
  }, [initialFocusedNoteId]);

  // Get all unique tags from library
  const allTags = useMemo(() => {
      const tags = new Set<string>();
      (library || []).forEach(note => {
          if (note.tags) (note.tags || []).forEach(t => tags.add(t));
      });
      return Array.from(tags).sort();
  }, [library]);

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
    }
  };

  // New handler for toggling tags
  const toggleTag = (tag: string) => {
      setSelectedTags(prev => 
          prev.includes(tag) 
              ? prev.filter(t => t !== tag) 
              : [...prev, tag]
      );
  };

  const handleDeleteRequest = (id: string) => {
    if (showDeleteWarning) {
        setPendingDeleteId(id);
    } else {
        performDelete(id);
    }
  };

  const performDelete = (id: string) => {
    onDeleteNote(id);
    if (expandedId === id) setExpandedId(null);
    setPendingDeleteId(null);
  };

  const filteredLibrary = (library || []).filter(note => {
    const matchesSearch = (note.title || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    // Updated Logic: OR Filter (Match if note has ANY of the selected tags)
    // If no tags selected, match all.
    const matchesTag = selectedTags.length === 0 
        ? true 
        : selectedTags.some(t => (note.tags || []).includes(t));

    const matchesFolder = selectedFolder === null ? true : note.folder === selectedFolder;
    const matchesTheme = selectedTheme === null ? true : (note.theme === selectedTheme);

    if (filterMode === 'revision') return matchesSearch && matchesTag && matchesFolder && matchesTheme && note.needsRevision;
    return matchesSearch && matchesTag && matchesFolder && matchesTheme;
  });

  return (
    // Outer container handles scrolling for the entire page. 
    <div className="h-full w-full overflow-y-auto bg-white/50 scroll-smooth">
      <div className="flex flex-col pt-4 md:pt-20 px-4 md:px-10 max-w-7xl mx-auto w-full pb-32 min-h-full">
          
          {/* Header & Controls */}
          <div className="flex flex-col space-y-6 mb-8 animate-fade-in pt-12 md:pt-0">
              {/* Header Row */}
              <div className="flex flex-col md:flex-row md:justify-between md:items-end">
                  <div>
                      <div className="flex items-center space-x-2 text-gray-400 mb-1">
                          <Brain className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                              {viewMode === 'active' ? `${filteredLibrary.length} Neural Nodes` : 'Data Purge Sector'}
                          </span>
                      </div>
                      <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                          {viewMode === 'active' ? t('My Brain', getSystemLanguage()) : t('Recycle Bin', getSystemLanguage())}
                      </h1>
                  </div>
                  
                  <div className="flex items-center space-x-4 mt-4 md:mt-0">
                      <button 
                          onClick={onOpenMemoryLab} 
                          className="flex items-center px-5 py-2.5 bg-gray-100 rounded-xl transition-all duration-300 relative"
                      >
                          <BrainCircuit className="w-4 h-4 mr-2 text-gray-600 transition-colors" />
                          <span className="text-xs font-black uppercase tracking-widest text-gray-600 transition-colors">{t('Memory Lab', getSystemLanguage())}</span>
                          {isMemoryLabLocked ? (
                              <Lock className="w-3 h-3 ml-2 text-gray-400 transition-all" />
                          ) : (
                              <ArrowRight className="w-3 h-3 ml-2 text-gray-400 transition-all" />
                          )}
                      </button>
                  </div>
              </div>

              {/* Neural Status Card */}
              {viewMode === 'active' ? (
                <div 
                    onClick={onOpenMemoryLab}
                    className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden group cursor-pointer transition-all"
                >
                     <div className="absolute top-0 right-0 p-10 opacity-5 transition-opacity transform duration-700">
                         <Brain className="w-32 h-32" />
                     </div>
                     <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                         <div>
                             <h3 className="text-lg font-bold mb-1 flex items-center">
                                 <Sparkles className="w-4 h-4 text-yellow-400 mr-2" /> 
                                 {t('Neural Engine Online', getSystemLanguage())}
                                 {isMemoryLabLocked && <Lock className="w-4 h-4 ml-2 text-gray-500" />}
                             </h3>
                             <p className="text-sm text-gray-400 max-w-md">{t('Your second brain is active. Knowledge is being indexed for long-term retention.', getSystemLanguage())}</p>
                         </div>
                         <div className="flex gap-4 items-center">
                             <div className="bg-white/10 rounded-2xl p-3 px-5 backdrop-blur-sm border border-white/5">
                                 <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{t('Sources', getSystemLanguage())}</div>
                                 <div className="text-2xl font-black">{library.length}</div>
                             </div>
                             <div className="bg-white/10 rounded-2xl p-3 px-5 backdrop-blur-sm border border-white/5">
                                 <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{t('Reviews', getSystemLanguage())}</div>
                                 <div className="text-2xl font-black">{library.reduce((acc, n) => acc + (n.reviewCount || 0), 0)}</div>
                             </div>
                             {!isReadOnly && (
                                 <button onClick={(e) => {
                                     e.stopPropagation();
                                     if (window.confirm(t('Are you sure you want to delete all sources? This will move them to the recycle bin.', getSystemLanguage()))) {
                                         onDeleteAll();
                                     }
                                 }} className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-xs font-bold transition-colors flex items-center h-fit">
                                     <Trash2 className="w-3.5 h-3.5 mr-2" /> {t('Delete All', getSystemLanguage())}
                                 </button>
                             )}
                         </div>
                     </div>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-3xl p-6 text-gray-900 shadow-inner relative overflow-hidden">
                     <div className="relative z-10 flex items-center justify-between">
                         <div>
                            <h3 className="text-lg font-bold mb-1 flex items-center text-red-500"><Trash2 className="w-4 h-4 mr-2" /> Recovery Protocol</h3>
                            <p className="text-sm text-gray-500">Items here can be restored or permanently deleted.</p>
                         </div>
                         <div className="flex gap-2">
                             <button onClick={() => {
                                 if (window.confirm(t('Are you sure you want to permanently delete all items in the trash? This cannot be undone.', getSystemLanguage()))) {
                                     trash.forEach(note => onDeleteForever(note.id));
                                 }
                             }} className="px-4 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-xl text-xs font-bold shadow-sm transition-colors">{t('Empty Trash', getSystemLanguage())}</button>
                             <button onClick={() => setViewMode('active')} className="px-4 py-2 bg-white rounded-xl text-xs font-bold shadow-sm">{t('Back to Brain', getSystemLanguage())}</button>
                         </div>
                     </div>
                </div>
              )}
          </div>

          {/* Main Content Area */}
          <div className="flex flex-col lg:flex-row gap-8">
              
              {/* Sidebar Filters */}
              <div className="lg:w-64 flex-shrink-0 space-y-6 lg:sticky lg:top-6 lg:h-fit">
                  {/* Search */}
                  <div className="relative group">
                      <Search className="absolute left-4 top-3.5 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                      <input 
                          type="text" 
                          placeholder={t("Search neural paths...", getSystemLanguage())}
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full bg-white border border-gray-100 rounded-xl py-3 pl-11 pr-4 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-50 transition-all shadow-sm"
                      />
                  </div>

                  {/* Sidebar Tabs */}
                  <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                      <button 
                          onClick={() => setActiveSidebarTab('sources')} 
                          className={`flex-1 text-[10px] font-black uppercase tracking-widest py-3 rounded-lg transition-all ${activeSidebarTab === 'sources' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                          All
                      </button>
                      <button 
                          onClick={() => setActiveSidebarTab('folders')} 
                          className={`flex-1 text-[10px] font-black uppercase tracking-widest py-3 rounded-lg transition-all ${activeSidebarTab === 'folders' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                          Folders
                      </button>
                      <button 
                          onClick={() => setActiveSidebarTab('themes')} 
                          className={`flex-1 text-[10px] font-black uppercase tracking-widest py-3 rounded-lg transition-all ${activeSidebarTab === 'themes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                          Themes
                      </button>
                  </div>

                  {activeSidebarTab === 'sources' && (
                      <>
                          {/* Filter View Toggles */}
                          <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                                <button 
                                    onClick={() => { setViewMode('active'); setFilterMode('all'); setSelectedFolder(null); setSelectedTheme(null); }}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest mb-1 flex items-center ${viewMode === 'active' && filterMode === 'all' && selectedFolder === null && selectedTheme === null ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    <LayoutGrid className="w-3.5 h-3.5 mr-2" /> All Sources
                                </button>
                                <button 
                                    onClick={() => { setViewMode('active'); setFilterMode('revision'); setSelectedFolder(null); setSelectedTheme(null); }}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold mb-1 flex items-center ${filterMode === 'revision' ? 'bg-red-50 text-red-600' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    <AlertTriangle className="w-3.5 h-3.5 mr-2" /> Needs Review
                                </button>
                                <div className="h-px bg-gray-100 my-2"></div>
                                <button 
                                    onClick={() => setViewMode('trash')}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center ${viewMode === 'trash' ? 'bg-gray-100 text-red-500' : 'text-gray-500 hover:bg-gray-50'}`}
                                >
                                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Recycle Bin
                                </button>
                          </div>

                          {/* Tags */}
                          <div>
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-2">Knowledge Tags</h3>
                            <div className="flex flex-wrap gap-2">
                                {allTags.map(tag => (
                                    <button 
                                        key={tag}
                                        onClick={() => toggleTag(tag)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${selectedTags.includes(tag) ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-gray-100 text-gray-500 hover:border-blue-200'}`}
                                    >
                                        {tag.replace('#', '')}
                                    </button>
                                ))}
                                {selectedTags.length > 0 && (
                                    <button 
                                        onClick={() => setSelectedTags([])}
                                        className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                          </div>
                      </>
                  )}

                  {activeSidebarTab === 'folders' && (
                      <div>
                        <div className="flex items-center justify-between mb-3 px-2">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Folders</h3>
                            {!isReadOnly && (
                                <button 
                                    onClick={() => { if (!canUsePremiumFeatures || canUsePremiumFeatures('Folders')) setIsAddingFolder(true); }}
                                    className="text-gray-400 hover:text-blue-500 transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        <div className="flex flex-col gap-1">
                            {isAddingFolder && (
                                <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm mb-2">
                                    <input 
                                        type="text" 
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && newFolderName.trim()) {
                                                onAddFolder({ name: newFolderName.trim(), color: newFolderColor });
                                                setIsAddingFolder(false);
                                                setNewFolderName('');
                                            }
                                        }}
                                        placeholder={t("Folder name", getSystemLanguage())}
                                        className="w-full text-xs font-bold bg-gray-50 border-none rounded-lg px-2 py-1.5 mb-2 focus:ring-1 focus:ring-blue-500 outline-none"
                                        autoFocus
                                    />
                                    <div className="flex items-center justify-between">
                                        <input 
                                            type="color" 
                                            value={newFolderColor}
                                            onChange={(e) => setNewFolderColor(e.target.value)}
                                            className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                                        />
                                        <div className="flex space-x-1">
                                            <button onClick={() => { setIsAddingFolder(false); setNewFolderName(''); }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                                            <button 
                                                onClick={() => {
                                                    if (newFolderName.trim()) {
                                                        onAddFolder({ name: newFolderName.trim(), color: newFolderColor });
                                                        setIsAddingFolder(false);
                                                        setNewFolderName('');
                                                    }
                                                }} 
                                                className="p-1 text-blue-500 hover:text-blue-600"
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {folders.map(folder => (
                                <div key={folder.id} className="group relative">
                                    {editingFolderId === folder.id ? (
                                        <div className="bg-white p-2 rounded-xl border border-blue-200 shadow-sm">
                                            <input 
                                                type="text" 
                                                value={editFolderName}
                                                onChange={(e) => setEditFolderName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && editFolderName.trim()) {
                                                        onUpdateFolder({ ...folder, name: editFolderName.trim(), color: editFolderColor });
                                                        setEditingFolderId(null);
                                                    }
                                                }}
                                                className="w-full text-xs font-bold bg-gray-50 border-none rounded-lg px-2 py-1.5 mb-2 focus:ring-1 focus:ring-blue-500 outline-none"
                                                autoFocus
                                            />
                                            <div className="flex items-center justify-between">
                                                <input 
                                                    type="color" 
                                                    value={editFolderColor}
                                                    onChange={(e) => setEditFolderColor(e.target.value)}
                                                    className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                                                />
                                                <div className="flex space-x-1">
                                                    <button onClick={() => setEditingFolderId(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                                                    <button 
                                                        onClick={() => {
                                                            if (editFolderName.trim()) {
                                                                onUpdateFolder({ ...folder, name: editFolderName.trim(), color: editFolderColor });
                                                                setEditingFolderId(null);
                                                            }
                                                        }} 
                                                        className="p-1 text-blue-500 hover:text-blue-600"
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="group/item">
                                            <div 
                                                className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold transition-colors ${selectedFolder === folder.id ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    e.currentTarget.classList.add('bg-blue-100');
                                                }}
                                                onDragLeave={(e) => {
                                                    e.currentTarget.classList.remove('bg-blue-100');
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    e.currentTarget.classList.remove('bg-blue-100');
                                                    const noteId = e.dataTransfer.getData('noteId');
                                                    if (noteId) {
                                                        const note = library.find(n => n.id === noteId);
                                                        if (note) {
                                                            onUpdateNote({ ...note, folder: folder.id });
                                                        }
                                                    }
                                                }}
                                            >
                                                <div className="flex items-center flex-1">
                                                    <button 
                                                        onClick={(e) => toggleFolderExpand(folder.id, e)}
                                                        className="p-1 hover:bg-gray-200 rounded-md mr-1 transition-colors"
                                                    >
                                                        <ChevronDown className={`w-3 h-3 transition-transform ${expandedFolders.has(folder.id) ? '' : '-rotate-90'}`} />
                                                    </button>
                                                    <button 
                                                        onClick={() => { setViewMode('active'); setSelectedFolder(folder.id === selectedFolder ? null : folder.id); setSelectedTheme(null); }}
                                                        className="flex items-center flex-1 text-left"
                                                    >
                                                        <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: folder.color }}></div>
                                                        {folder.name}
                                                        <span className="ml-2 text-[9px] text-gray-400">({library.filter(n => n.folder === folder.id).length})</span>
                                                    </button>
                                                </div>
                                                <div className="hidden group-hover/item:flex items-center space-x-1">
                                                    {!isReadOnly && onAddSelectedToFolder && (
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onAddSelectedToFolder(folder.id);
                                                            }}
                                                            className="p-1 text-gray-400 hover:text-green-500"
                                                            title="Add selected whiteboard notes to folder"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                    {!isReadOnly && (
                                                        <>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingFolderId(folder.id);
                                                                    setEditFolderName(folder.name);
                                                                    setEditFolderColor(folder.color);
                                                                }}
                                                                className="p-1 text-gray-400 hover:text-blue-500"
                                                            >
                                                                <Edit2 className="w-3 h-3" />
                                                            </button>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (window.confirm(`Delete folder "${folder.name}"? Notes will not be deleted.`)) {
                                                                        onDeleteFolder(folder.id);
                                                                        if (selectedFolder === folder.id) setSelectedFolder(null);
                                                                    }
                                                                }}
                                                                className="p-1 text-gray-400 hover:text-red-500"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Expanded Notes */}
                                            {expandedFolders.has(folder.id) && (
                                                <div className="ml-4 mt-2 space-y-2 border-l-2 border-gray-100 pl-4">
                                                    {library.filter(n => n.folder === folder.id).length === 0 ? (
                                                        <div className="text-[10px] text-gray-400 py-1 italic">Empty folder</div>
                                                    ) : (
                                                        library.filter(n => n.folder === folder.id).map(note => (
                                                            <div 
                                                                key={note.id}
                                                                draggable
                                                                onDragStart={(e) => {
                                                                    e.dataTransfer.setData('noteId', note.id);
                                                                    e.dataTransfer.effectAllowed = 'move';
                                                                }}
                                                                onClick={() => { if (!canUsePremiumFeatures || canUsePremiumFeatures('Chat')) onOpenChat?.(note.id); }}
                                                                className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm cursor-grab active:cursor-grabbing group/note relative"
                                                                style={{ borderLeftColor: folder.color, borderLeftWidth: '4px' }}
                                                            >
                                                                <h4 className="text-[10px] font-bold text-gray-900 mb-1.5 leading-snug truncate pr-6">{note.title}</h4>
                                                                <div className="flex justify-between items-center">
                                                                    <span className={`text-[7px] font-black px-1 py-0.5 rounded uppercase tracking-widest bg-gray-50 text-gray-500`}>
                                                                        {note.type === 'spark' ? t('Spark', getSystemLanguage()) : note.type === 'insight' ? t('AI Chat', getSystemLanguage()) : note.type === 'collision' ? t('Collision', getSystemLanguage()) : note.type === 'asset' ? t('Alchemy', getSystemLanguage()) : note.sourceUrl === 'neural://dump' ? t('Neural Dump', getSystemLanguage()) : t('Note', getSystemLanguage())}
                                                                    </span>
                                                                    {!isReadOnly && (
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }} 
                                                                            className="absolute top-1.5 right-1.5 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition"
                                                                        >
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                      </div>
                  )}

                  {activeSidebarTab === 'themes' && (
                      <div>
                        <div className="flex items-center justify-between mb-3 px-2">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Themes</h3>
                            {!isReadOnly && (
                                <button 
                                    onClick={() => { if (!canUsePremiumFeatures || canUsePremiumFeatures('Themes')) setIsAddingTheme(true); }}
                                    className="text-gray-400 hover:text-blue-500 transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        <div className="flex flex-col gap-1">
                            {isAddingTheme && (
                                <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm mb-2">
                                    <input 
                                        type="text" 
                                        value={newThemeName}
                                        onChange={(e) => setNewThemeName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && newThemeName.trim()) {
                                                onAddTheme({ name: newThemeName.trim(), color: newThemeColor });
                                                setIsAddingTheme(false);
                                                setNewThemeName('');
                                            }
                                        }}
                                        placeholder={t("Theme name", getSystemLanguage())}
                                        className="w-full text-xs font-bold bg-gray-50 border-none rounded-lg px-2 py-1.5 mb-2 focus:ring-1 focus:ring-blue-500 outline-none"
                                        autoFocus
                                    />
                                    <div className="flex items-center justify-between">
                                        <input 
                                            type="color" 
                                            value={newThemeColor}
                                            onChange={(e) => setNewThemeColor(e.target.value)}
                                            className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                                        />
                                        <div className="flex space-x-1">
                                            <button onClick={() => { setIsAddingTheme(false); setNewThemeName(''); }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                                            <button 
                                                onClick={() => {
                                                    if (newThemeName.trim()) {
                                                        onAddTheme({ name: newThemeName.trim(), color: newThemeColor });
                                                        setIsAddingTheme(false);
                                                        setNewThemeName('');
                                                    }
                                                }} 
                                                className="p-1 text-blue-500 hover:text-blue-600"
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {themes.map(theme => (
                                <div key={theme.id} className="group relative">
                                    {editingThemeId === theme.id ? (
                                        <div className="bg-white p-2 rounded-xl border border-blue-200 shadow-sm">
                                            <input 
                                                type="text" 
                                                value={editThemeName}
                                                onChange={(e) => setEditThemeName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && editThemeName.trim()) {
                                                        onUpdateTheme({ ...theme, name: editThemeName.trim(), color: editThemeColor });
                                                        setEditingThemeId(null);
                                                    }
                                                }}
                                                className="w-full text-xs font-bold bg-gray-50 border-none rounded-lg px-2 py-1.5 mb-2 focus:ring-1 focus:ring-blue-500 outline-none"
                                                autoFocus
                                            />
                                            <div className="flex items-center justify-between">
                                                <input 
                                                    type="color" 
                                                    value={editThemeColor}
                                                    onChange={(e) => setEditThemeColor(e.target.value)}
                                                    className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                                                />
                                                <div className="flex space-x-1">
                                                    <button onClick={() => setEditingThemeId(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                                                    <button 
                                                        onClick={() => {
                                                            if (editThemeName.trim()) {
                                                                onUpdateTheme({ ...theme, name: editThemeName.trim(), color: editThemeColor });
                                                                setEditingThemeId(null);
                                                            }
                                                        }} 
                                                        className="p-1 text-blue-500 hover:text-blue-600"
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="group/item">
                                            <div 
                                                className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-bold transition-colors ${selectedTheme === theme.id ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    e.currentTarget.classList.add('bg-blue-100');
                                                }}
                                                onDragLeave={(e) => {
                                                    e.currentTarget.classList.remove('bg-blue-100');
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    e.currentTarget.classList.remove('bg-blue-100');
                                                    const noteId = e.dataTransfer.getData('noteId');
                                                    if (noteId) {
                                                        const note = library.find(n => n.id === noteId);
                                                        if (note) {
                                                            onUpdateNote({ ...note, theme: theme.id });
                                                        }
                                                    }
                                                }}
                                                draggable
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData('themeId', theme.id);
                                                }}
                                            >
                                                <div className="flex items-center flex-1">
                                                    <button 
                                                        onClick={(e) => toggleThemeExpand(theme.id, e)}
                                                        className="p-1 hover:bg-gray-200 rounded-md mr-1 transition-colors"
                                                    >
                                                        <ChevronDown className={`w-3 h-3 transition-transform ${expandedThemes.has(theme.id) ? '' : '-rotate-90'}`} />
                                                    </button>
                                                    <button 
                                                        onClick={() => { setViewMode('active'); setSelectedTheme(theme.id === selectedTheme ? null : theme.id); setSelectedFolder(null); }}
                                                        className="flex items-center flex-1 text-left"
                                                    >
                                                        <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: theme.color }}></div>
                                                        {theme.name}
                                                        <span className="ml-2 text-[9px] text-gray-400">({library.filter(n => n.theme === theme.id).length})</span>
                                                    </button>
                                                </div>
                                                <div className="hidden group-hover/item:flex items-center space-x-1">
                                                    {!isReadOnly && (
                                                        <>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingThemeId(theme.id);
                                                                    setEditThemeName(theme.name);
                                                                    setEditThemeColor(theme.color);
                                                                }}
                                                                className="p-1 text-gray-400 hover:text-blue-500"
                                                            >
                                                                <Edit2 className="w-3 h-3" />
                                                            </button>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (window.confirm(`Delete theme "${theme.name}"?`)) {
                                                                        onDeleteTheme(theme.id);
                                                                        if (selectedTheme === theme.id) setSelectedTheme(null);
                                                                    }
                                                                }}
                                                                className="p-1 text-gray-400 hover:text-red-500"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Expanded Notes */}
                                            {expandedThemes.has(theme.id) && (
                                                <div className="ml-4 mt-2 space-y-2 border-l-2 border-gray-100 pl-4">
                                                    {library.filter(n => n.theme === theme.id).length === 0 ? (
                                                        <div className="text-[10px] text-gray-400 py-1 italic">No notes in theme</div>
                                                    ) : (
                                                        library.filter(n => n.theme === theme.id).map(note => (
                                                            <div 
                                                                key={note.id}
                                                                draggable
                                                                onDragStart={(e) => {
                                                                    e.dataTransfer.setData('noteId', note.id);
                                                                    e.dataTransfer.effectAllowed = 'move';
                                                                }}
                                                                onClick={() => { if (!canUsePremiumFeatures || canUsePremiumFeatures('Chat')) onOpenChat?.(note.id); }}
                                                                className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm cursor-grab active:cursor-grabbing group/note relative"
                                                                style={{ borderLeftColor: theme.color, borderLeftWidth: '4px' }}
                                                            >
                                                                <h4 className="text-[10px] font-bold text-gray-900 mb-1.5 leading-snug truncate pr-6">{note.title}</h4>
                                                                <div className="flex justify-between items-center">
                                                                    <span className={`text-[7px] font-black px-1 py-0.5 rounded uppercase tracking-widest bg-gray-50 text-gray-500`}>
                                                                        {note.type === 'spark' ? t('Spark', getSystemLanguage()) : note.type === 'insight' ? t('AI Chat', getSystemLanguage()) : note.type === 'collision' ? t('Collision', getSystemLanguage()) : note.type === 'asset' ? t('Alchemy', getSystemLanguage()) : note.sourceUrl === 'neural://dump' ? t('Neural Dump', getSystemLanguage()) : t('Note', getSystemLanguage())}
                                                                    </span>
                                                                    {!isReadOnly && (
                                                                        <button 
                                                                            onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }} 
                                                                            className="absolute top-1.5 right-1.5 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition"
                                                                        >
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                      </div>
                  )}
              </div>

              {/* Notes Grid */}
              <div className="flex-1">
                  {viewMode === 'trash' ? (
                        trash.length === 0 ? (
                            <div className="flex flex-col items-center justify-center pt-20 opacity-30">
                                <Sparkles className="w-16 h-16 mb-4" />
                                <p className="font-bold uppercase tracking-widest">Bin is empty</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {trash.map(note => (
                                    <div key={note.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm opacity-60 hover:opacity-100 transition-all">
                                        <div className="flex justify-between items-start mb-4">
                                            <span className="px-2 py-1 rounded-md text-[10px] font-black bg-gray-100 text-gray-500 uppercase tracking-wider">{note.platform}</span>
                                            <div className="flex space-x-2">
                                                <button onClick={() => onRestoreNote(note)} className="p-2 text-blue-500 bg-blue-50 rounded-full hover:bg-blue-100 transition text-xs font-bold flex items-center"><RotateCw className="w-3 h-3 mr-1" /> Restore</button>
                                                <button onClick={() => onDeleteForever(note.id)} className="p-2 text-red-500 bg-red-50 rounded-full hover:bg-red-100 transition text-xs font-bold flex items-center"><Trash2 className="w-3 h-3 mr-1" /> Delete Forever</button>
                                            </div>
                                        </div>
                                        <h3 className="text-lg font-bold mb-2 line-through decoration-red-300">{note.title}</h3>
                                        <p className="text-sm text-gray-400">Deleted content.</p>
                                    </div>
                                ))}
                            </div>
                        )
                  ) : (
                        <>
                            {filteredLibrary.length === 0 ? (
                                <div className="flex flex-col items-center justify-center pt-20 opacity-30">
                                    <Brain className="w-16 h-16 mb-4" />
                                    <p className="font-bold uppercase tracking-widest">No Memories Found</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-6">
                                    {selectedFolder && (
                                        <div className="flex items-center justify-between mb-4 px-2">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: folders.find(f => f.id === selectedFolder)?.color }}></div>
                                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Folder: {folders.find(f => f.id === selectedFolder)?.name}</h3>
                                            </div>
                                            <button onClick={() => setSelectedFolder(null)} className="text-[10px] font-bold text-blue-600 hover:underline">Clear Filter</button>
                                        </div>
                                    )}
                                    {selectedTheme && (
                                        <div className="flex items-center justify-between mb-4 px-2">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: themes.find(t => t.id === selectedTheme)?.color }}></div>
                                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Theme: {themes.find(t => t.id === selectedTheme)?.name}</h3>
                                            </div>
                                            <button onClick={() => setSelectedTheme(null)} className="text-[10px] font-bold text-blue-600 hover:underline">Clear Filter</button>
                                        </div>
                                    )}
                                    {filteredLibrary.map(note => (
                                        <div key={note.id} className="relative group">
                                            {/* External Badge for Quizzes if not expanded */}
                                            {note.generatedQuiz && note.generatedQuiz.length > 0 && expandedId !== note.id && (
                                                <div className="absolute top-4 right-16 z-20 flex items-center space-x-1 bg-yellow-50 text-yellow-600 px-2 py-1 rounded-full text-[9px] font-bold border border-yellow-200">
                                                    <HelpCircle className="w-3 h-3" />
                                                    <span>Quiz Ready</span>
                                                </div>
                                            )}
                                            <SmartCard 
                                                note={note}
                                                theme={theme}
                                                isExpanded={expandedId === note.id}
                                                onToggleExpand={() => toggleExpand(note.id)}
                                                onUpdateNote={onUpdateNote}
                                                onDeleteNote={isReadOnly ? () => {} : handleDeleteRequest}
                                                onOpenChat={(fileIndex) => onOpenChat(note.id, fileIndex)} // Pass the index
                                                folders={folders}
                                                themes={themes}
                                                canUseLogicGuard={canUseLogicGuard}
                                                canUsePremiumFeatures={canUsePremiumFeatures}
                                                onAIUsage={onAIUsage}
                                                isReadOnly={isReadOnly}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
              </div>
          </div>
          
          {/* Delete Confirmation Modal */}
          {pendingDeleteId && (
              <div 
                className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
                onClick={() => setPendingDeleteId(null)}
              >
                  <div 
                    className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-scale-in"
                    onClick={(e) => e.stopPropagation()}
                  >
                      <div className="flex items-center space-x-3 mb-4 text-red-600">
                          <Trash2 className="w-6 h-6" />
                          <h3 className="text-lg font-black uppercase tracking-tight">Delete Memory?</h3>
                      </div>
                      <p className="text-sm text-gray-500 mb-8 font-medium leading-relaxed">
                          This will move the selected note to the recycle bin. You can restore it later if needed.
                      </p>
                      <div className="flex justify-end space-x-3">
                          <button 
                              onClick={() => setPendingDeleteId(null)} 
                              className="px-6 py-3 rounded-xl text-gray-500 hover:bg-gray-100 font-bold text-xs uppercase tracking-widest transition-colors"
                          >
                              Cancel
                          </button>
                          <button 
                              onClick={() => performDelete(pendingDeleteId)} 
                              className="px-6 py-3 rounded-xl bg-red-600 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-200 transition-all active:scale-95"
                          >
                              Delete
                          </button>
                      </div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};
