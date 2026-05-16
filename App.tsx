import React, { useState, useEffect, useRef, useMemo } from 'react';
import { InboxItem, Note, ViewState, AppTheme, ProcessingOptions, DailyActivity, QuizDifficulty, QuizFeedbackType, RetentionSummary, CanvasDocument, QuizAttempt, Platform, CanvasNode, SparkInsight, CanvasEdge, Folder, Theme, CanvasGroup, UserProfile } from './types';
import { Library } from './components/Library';
import { LearningCanvas } from './components/LearningCanvas';
import { MemoryLab } from './components/MemoryLab';
import { KoOrb } from './components/KoOrb';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { processUrlContent, detectPlatform, setCustomApiKey, setOpenaiApiKey } from './services/geminiService';
import { saveToStorage, loadAllFromStorage } from './services/storage';
import { THEME_CLASSES } from './constants';
import { useNeuralDump } from './hooks/useNeuralDump';
import { X, Crown, Shield } from 'lucide-react';

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsedError = JSON.parse(this.state.error.message);
        if (parsedError.error) {
          errorMessage = `Database Error: ${parsedError.error} (Op: ${parsedError.operationType})`;
        }
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-red-100">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <X className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Application Error</h2>
            <p className="text-gray-600 mb-8">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 px-6 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Removed MOCK_ASSETS

const DEFAULT_LIBRARY: Note[] = [];

const DEFAULT_INBOX: InboxItem[] = [];

const App: React.FC = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  const [view, setView] = useState<ViewState>('canvas');
  const [theme] = useState<AppTheme>(AppTheme.MINIMAL);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [inboxTrash, setInboxTrash] = useState<InboxItem[]>([]);
  const [library, setLibrary] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const prevDataRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const localProfile: UserProfile = {
      uid: 'localuser',
      email: 'localuser@kno.app',
      customApiKey: localStorage.getItem('customApiKey') || '',
      openaiApiKey: localStorage.getItem('openaiApiKey') || '',
      language: localStorage.getItem('system_language') || 'English',
      plan: 'Pro',
      createdAt: Date.now()
    };
    
    setUserProfile(localProfile);
    setCustomApiKey(localProfile.customApiKey || undefined);
    setOpenaiApiKey(localProfile.openaiApiKey || undefined);
  }, []);

  const isReadOnly = false;

  const checkGeneralUsage = (silent: boolean = false): boolean => {
    return true;
  };

  const checkFeatureAccess = (feature: string, silent: boolean = false): boolean => {
    return true;
  };

  const incrementUsage = async (isLogicGuard = false) => {
    // No-op
  };

  const handleAddFolder = (folder: Omit<Folder, 'id'>) => {
    const newFolder = { ...folder, id: `folder-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` };
    setFolders(prev => [...prev, newFolder]);
  };

  const handleUpdateFolder = (updatedFolder: Folder) => {
    setFolders(prev => prev.map(f => f.id === updatedFolder.id ? updatedFolder : f));
  };

  const handleDeleteFolder = (id: string) => {
    setFolders(prev => prev.filter(f => f.id !== id));
    setLibrary(prev => prev.map(n => n.folder === id ? { ...n, folder: undefined } : n));
  };

  const handleAddTheme = (theme: Omit<Theme, 'id'> & { id?: string }, skipCanvasGroup?: boolean) => {
    const newTheme = { ...theme, id: theme.id || `theme-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` };
    setThemes(prev => [...prev, newTheme]);
    
    // Also add to whiteboard if there's an active canvas
    if (activeCanvasId && !skipCanvasGroup) {
        setCanvases(prev => prev.map(c => {
            if (c.id === activeCanvasId) {
                const newGroup: CanvasGroup = {
                    id: `group-theme-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    themeId: newTheme.id,
                    title: newTheme.name,
                    x: 100, // Default position
                    y: 100,
                    width: 400,
                    height: 300,
                    color: newTheme.color
                };
                return {
                    ...c,
                    lastModified: Date.now(),
                    state: {
                        ...c.state,
                        groups: [...(c.state?.groups || []), newGroup]
                    }
                };
            }
            return c;
        }));
    }
    return newTheme;
  };

  const handleUpdateTheme = (updatedTheme: Theme) => {
    setThemes(prev => prev.map(t => t.id === updatedTheme.id ? updatedTheme : t));
    
    // Sync with canvases
    setCanvases(prev => prev.map(canvas => ({
        ...canvas,
        state: {
            ...canvas.state,
            groups: (canvas.state?.groups || []).map(g => g.themeId === updatedTheme.id ? { ...g, title: updatedTheme.name, color: updatedTheme.color } : g)
        }
    })));
  };

  const handleDeleteTheme = (id: string) => {
    setThemes(prev => prev.filter(t => t.id !== id));
    
    // Sync with canvases
    setCanvases(prev => prev.map(canvas => ({
        ...canvas,
        state: {
            ...canvas.state,
            groups: (canvas.state?.groups || []).filter(g => g.themeId !== id)
        }
    })));

    // Remove theme from library notes
    setLibrary(prev => prev.map(note => note.theme === id ? { ...note, theme: undefined } : note));
  };
  const [trash, setTrash] = useState<Note[]>([]);
  const [activity, setActivity] = useState<DailyActivity[]>([]);
  const [canvases, setCanvases] = useState<CanvasDocument[]>([]);
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null);
  const [canvasTrash, setCanvasTrash] = useState<CanvasDocument[]>([]);
  const [retentionData, setRetentionData] = useState<RetentionSummary | null>(null);

  const [showDeleteWarning, setShowDeleteWarning] = useState(true);
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const [quizDifficulty] = useState<QuizDifficulty>('Medium');

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatFileIndex, setChatFileIndex] = useState(0);
  const [initialChatQuery, setInitialChatQuery] = useState<string | null>(null);
  const [activeChatContextId, setActiveChatContextId] = useState<string | null>(null);

  const [selectedCanvasNodes, setSelectedCanvasNodes] = useState<CanvasNode[]>([]);

  const handleNeuralDumpComplete = (newNodes: any[]) => {
      incrementUsage();
      if (activeCanvasId) {
          const canvas = canvases.find(c => c.id === activeCanvasId);
          if (canvas) {
              let processedNodes = [...newNodes];
              let newEdges: CanvasEdge[] = [];
              
              // Create library notes for each new node
              const newLibraryNotes: Note[] = processedNodes.map(node => ({
                  id: node.id || `note-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                  title: node.title || "Neural Capture",
                  summary: [node.content || ""],
                  type: 'note',
                  createdAt: Date.now(),
                  lastReviewedAt: Date.now(),
                  reviewCount: 0,
                  platform: Platform.GENERIC,
                  sourceUrl: 'neural://dump',
                  tags: [],
                  quizAttempts: [],
                  needsRevision: false
              }));

              if (selectedCanvasNodes.length === 1) {
                   const parent = selectedCanvasNodes[0];
                   processedNodes = newNodes.map((node, i) => ({
                       ...node,
                       noteId: newLibraryNotes[i].id,
                       x: parent.x + (parent.width || 250) + 100,
                       y: parent.y + (i * 300)
                   }));
                   newEdges = processedNodes.map(node => ({
                       id: `edge-${parent.id}-${node.id}`,
                       source: parent.id,
                       target: node.id,
                       type: 'neural'
                   }));
              } else {
                  processedNodes = newNodes.map((node, i) => ({
                      ...node,
                      noteId: newLibraryNotes[i].id
                  }));
              }

              setLibrary(prev => [...newLibraryNotes, ...prev]);

              const updatedNodes = [...(canvas.state?.nodes || []), ...processedNodes];
              const updatedEdges = [...(canvas.state?.edges || []), ...newEdges];
              const updatedCanvas = {
                  ...canvas,
                  lastModified: Date.now(),
                  state: { ...canvas.state, nodes: updatedNodes, edges: updatedEdges }
              };
              setCanvases(prev => prev.map(c => c.id === activeCanvasId ? updatedCanvas : c));
          }
      } else {
          const inboxItems = newNodes.map(n => ({
              id: n.id,
              url: 'neural://dump',
              title: n.title || "Neural Capture",
              platform: Platform.GENERIC,
              capturedAt: Date.now(),
              summary: [n.content || ""],
              isProcessing: false
          } as InboxItem));
          setInbox(prev => [...inboxItems, ...prev]);
      }
  };

  const { isListening, isProcessing, isInputOpen, setIsInputOpen, transcript, setTranscript, triggerProcessing, setIsListening } = useNeuralDump({ 
      onComplete: handleNeuralDumpComplete,
      isLocked: !userProfile || userProfile.plan === 'Free',
      onLocked: () => setShowPricing(true)
  });

  const sanitizeSummary = (summary: any): string[] => {
      if (Array.isArray(summary)) return summary;
      if (typeof summary === 'string') return summary.split('\n').filter(s => s.trim() !== '');
      return [];
  };

  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const initData = async () => {
        try {
            const keys = [
                'kno_inbox', 'kno_inbox_trash', 'kno_library', 'kno_trash', 
                'kno_activity', 'kno_canvases', 'kno_canvas_trash', 
                'kno_memory_analytics', 'kno_version', 'kno_folders', 'kno_themes'
            ];
            
            const results = await loadAllFromStorage(keys);
            
            let lInbox = results['kno_inbox'] || null;
            let lInboxTrash = results['kno_inbox_trash'] || [];
            let lLibrary = results['kno_library'] || null;
            let lTrash = results['kno_trash'] || [];
            let lActivity = results['kno_activity'] || [];
            let lCanvases = results['kno_canvases'] || [];
            let lCTrash = results['kno_canvas_trash'] || [];
            let lRetention = results['kno_memory_analytics'] || null;
            let lVersion = results['kno_version'] || null;
            let lFolders = results['kno_folders'] || [];
            let lThemes = results['kno_themes'] || [];

            if (lVersion !== '1.1') {
                // Only clear if we explicitly know it's an old version that needs wiping, 
                // or if it's a completely new user (all data is empty/null).
                // Do NOT wipe if they have existing canvases or library items but no version.
                const hasExistingData = (lCanvases && lCanvases.length > 0) || (lLibrary && lLibrary.length > 0);
                
                if (!hasExistingData && lVersion === '1.0') {
                    lInbox = [];
                    lInboxTrash = [];
                    lLibrary = [];
                    lTrash = [];
                    lActivity = [];
                    lCanvases = [];
                    lCTrash = [];
                    lRetention = null;
                    lFolders = [];
                    lThemes = [];
                }
                saveToStorage('kno_version', '1.1');
            }

            // Remove the old default themes if they are present
            lThemes = lThemes.filter(t => t.id !== 'theme-ai' && t.id !== 'theme-label');

            const finalLibrary = lLibrary === null ? DEFAULT_LIBRARY : lLibrary;
            const finalInbox = lInbox === null ? DEFAULT_INBOX : lInbox;

            // Clean up unused auto-generated themes and specific old generated themes
            const usedThemeIds = new Set<string>();
            (finalLibrary || []).forEach(n => { if (n.theme) usedThemeIds.add(n.theme); });
            (lCanvases || []).forEach(c => {
                c.state?.groups?.forEach(g => { if (g.themeId) usedThemeIds.add(g.themeId); });
                c.state?.nodes?.forEach(n => { if (n.themeId) usedThemeIds.add(n.themeId); });
            });
            
            const oldGeneratedThemeNames = [
                "Empty Notes", 
                "Business & Case Studies", 
                "Educational Resources", 
                "Certifications",
                "Business & Competitions",
                "Education & Academic",
                "Health & Certifications",
                "Certifications & Health",
                "Uncategorized Notes"
            ];
            lThemes = lThemes.filter(t => {
                const isUsed = usedThemeIds.has(t.id);
                if (isUsed) return true;
                // If it's not used, delete it if it's auto-generated or one of the old ones
                if (t.isAutoGenerated || oldGeneratedThemeNames.includes(t.name.trim())) {
                    return false;
                }
                return true;
            });

            const finalInboxData = (finalInbox || []).map(item => ({ ...item, summary: sanitizeSummary(item.summary) }));
            const finalInboxTrashData = (lInboxTrash || []).map(item => ({ ...item, summary: sanitizeSummary(item.summary) }));
            
            const deduplicatedLibrary = (finalLibrary || []).filter((note, index, self) => 
                index === self.findIndex((t) => t.id === note.id)
            );
            const finalLibraryData = deduplicatedLibrary.map(note => ({ ...note, summary: sanitizeSummary(note.summary) }));
            
            const finalTrashData = (lTrash || []).map(note => ({ ...note, summary: sanitizeSummary(note.summary) }));
            const finalActivityData = lActivity || [];
            const finalCanvasesData = lCanvases || [];
            const finalCanvasTrashData = lCTrash || [];
            const finalRetentionData = lRetention;
            const finalFoldersData = lFolders || [];
            const finalThemesData = lThemes || [];

            prevDataRef.current['kno_inbox'] = JSON.stringify(finalInboxData);
            prevDataRef.current['kno_inbox_trash'] = JSON.stringify(finalInboxTrashData);
            prevDataRef.current['kno_library'] = JSON.stringify(finalLibraryData);
            prevDataRef.current['kno_trash'] = JSON.stringify(finalTrashData);
            prevDataRef.current['kno_activity'] = JSON.stringify(finalActivityData);
            prevDataRef.current['kno_canvases'] = JSON.stringify(finalCanvasesData);
            prevDataRef.current['kno_canvas_trash'] = JSON.stringify(finalCanvasTrashData);
            prevDataRef.current['kno_memory_analytics'] = JSON.stringify(finalRetentionData);
            prevDataRef.current['kno_folders'] = JSON.stringify(finalFoldersData);
            prevDataRef.current['kno_themes'] = JSON.stringify(finalThemesData);

            setInbox(finalInboxData);
            setInboxTrash(finalInboxTrashData);
            setLibrary(finalLibraryData);
            setTrash(finalTrashData);
            setActivity(finalActivityData);
            setCanvases(finalCanvasesData);
            setCanvasTrash(finalCanvasTrashData);
            setRetentionData(finalRetentionData);
            setFolders(finalFoldersData);
            setThemes(finalThemesData);
            setIsDataLoaded(true);
        } catch (error: any) {
            console.error("Critical error loading data:", error);
            const msg = error?.message || "Unknown error";
            alert(`Failed to load your data: ${msg}. Please check your internet connection and refresh the page. Do not continue using the app to prevent data loss.`);
        }
    };
    initData();
  }, []);

  useEffect(() => {
    if (activeCanvasId && !canvases.some(c => c.id === activeCanvasId)) {
        setActiveCanvasId(null);
    }
  }, [canvases, activeCanvasId]);

  useEffect(() => {
    if (!isDataLoaded) return;
    const saveDataIfChanged = (key: string, data: any) => {
      const dataStr = JSON.stringify(data);
      if (prevDataRef.current[key] !== dataStr) {
        prevDataRef.current[key] = dataStr;
        saveToStorage(key, data);
      }
    };
    saveDataIfChanged('kno_inbox', inbox);
    saveDataIfChanged('kno_inbox_trash', inboxTrash);
    saveDataIfChanged('kno_library', library);
    saveDataIfChanged('kno_trash', trash);
    saveDataIfChanged('kno_activity', activity);
    saveDataIfChanged('kno_canvases', canvases);
    saveDataIfChanged('kno_canvas_trash', canvasTrash);
    saveDataIfChanged('kno_memory_analytics', retentionData);
    saveDataIfChanged('kno_folders', folders);
    saveDataIfChanged('kno_themes', themes);
  }, [inbox, inboxTrash, library, trash, activity, canvases, canvasTrash, retentionData, folders, themes, isDataLoaded]);

  // Auto-cleanup unused auto-generated themes during the session
  useEffect(() => {
    if (!isDataLoaded) return;
    
    const usedThemeIds = new Set<string>();
    library.forEach(n => { if (n.theme) usedThemeIds.add(n.theme); });
    canvases.forEach(c => {
        c.state?.groups?.forEach(g => { if (g.themeId) usedThemeIds.add(g.themeId); });
        c.state?.nodes?.forEach(n => { if (n.themeId) usedThemeIds.add(n.themeId); });
    });
    
    const oldGeneratedThemeNames = [
        "Empty Notes", 
        "Business & Case Studies", 
        "Educational Resources", 
        "Certifications",
        "Business & Competitions",
        "Education & Academic",
        "Health & Certifications",
        "Certifications & Health",
        "Uncategorized Notes"
    ];

    const themesToDelete = themes.filter(t => {
        const isUsed = usedThemeIds.has(t.id);
        if (isUsed) return false;
        if (t.isAutoGenerated || oldGeneratedThemeNames.includes(t.name.trim())) {
            return true;
        }
        return false;
    });

    if (themesToDelete.length > 0) {
        setThemes(prev => prev.filter(t => !themesToDelete.some(td => td.id === t.id)));
    }
  }, [library, canvases, themes, isDataLoaded]);

  const handleCapture = async (url: string, options: ProcessingOptions) => {
    if (!checkGeneralUsage()) return Promise.resolve();
    const finalUrl = url || (options.files && options.files.length > 0 ? "File Upload" : "");
    if (!finalUrl) return Promise.resolve();
    const tempId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const platform = detectPlatform(finalUrl);
    const capturedFiles = options.files?.map(f => f.data) || [];
    
    const newItem: InboxItem = { 
        id: tempId, 
        url: finalUrl, 
        title: platform === Platform.FILE ? 'Analyzing Files...' : 'Processing Signal...', 
        platform: platform, 
        capturedAt: Date.now(), 
        summary: [], 
        tags: [], 
        isProcessing: true,
        userFiles: capturedFiles
    };
    setInbox(prev => [newItem, ...prev]);
    
    incrementUsage();
    const currentLang = userProfile?.language || localStorage.getItem('system_language') || 'English';
    processUrlContent(finalUrl, { ...options, quizDifficulty, targetLanguage: currentLang }, (thinking) => {
        setInbox(prev => prev.map(item => item.id === tempId ? { ...item, thinking } : item));
    })
        .then((processedData) => {
            setInbox(prev => prev.map(item => item.id === tempId ? { ...item, ...processedData, isProcessing: false } : item ));
        })
        .catch(err => {
            console.error("Processing failed for item", tempId, err);
            setInbox(prev => prev.map(item => item.id === tempId ? { 
                ...item, 
                title: "Processing Failed", 
                summary: ["Could not extract content. Please check URL."], 
                isProcessing: false 
            } : item));
        });
    return Promise.resolve();
  };

  const handleKeep = async (item: InboxItem, editedSummary?: string[], quizAnswers?: Record<number, number>, tags?: string[], editedTitle?: string) => {
    const quizAttempts: QuizAttempt[] = [];
    if (quizAnswers && Object.keys(quizAnswers).length > 0 && item.generatedQuiz) {
        let correctCount = 0;
        item.generatedQuiz.forEach((q, idx) => {
            if (quizAnswers[idx] === q.correctAnswerIndex) correctCount++;
        });
        quizAttempts.push({
            timestamp: Date.now(),
            score: correctCount,
            totalQuestions: item.generatedQuiz.length,
            answers: quizAnswers,
            questions: item.generatedQuiz
        });
    }
    const newNote: Note = { 
        id: item.id, 
        sourceUrl: item.url, 
        platform: item.platform, 
        title: editedTitle || item.title, 
        summary: editedSummary || item.summary || [], 
        tags: tags || item.tags || [], 
        createdAt: item.capturedAt, 
        lastReviewedAt: quizAttempts.length > 0 ? Date.now() : item.capturedAt, 
        reviewCount: quizAttempts.length, 
        generatedQuiz: item.generatedQuiz, 
        quizAttempts: quizAttempts, 
        needsRevision: false,
        suppressQuizFeedback: item.suppressQuizFeedback,
        userFiles: item.userFiles 
    };
    setLibrary(prev => [newNote, ...prev]);
    setInbox(prev => prev.filter(i => i.id !== item.id));
    recordActivity();
  };

  const handleKeepAllSignals = () => {
    const itemsToKeep = inbox.filter(i => !i.isProcessing);
    if (itemsToKeep.length === 0) return;
    const newNotes: Note[] = itemsToKeep.map(item => ({
        id: item.id,
        sourceUrl: item.url,
        platform: item.platform,
        title: item.title,
        summary: item.summary || [],
        tags: item.tags || [],
        createdAt: item.capturedAt,
        lastReviewedAt: item.capturedAt,
        reviewCount: 0,
        generatedQuiz: item.generatedQuiz,
        quizAttempts: [],
        needsRevision: false,
        suppressQuizFeedback: item.suppressQuizFeedback,
        userFiles: item.userFiles
    }));
    setLibrary(prev => [...newNotes, ...prev]);
    setInbox(prev => prev.filter(i => i.isProcessing));
    setActivity(prev => {
        const today = getLocalDateString();
        const existing = prev.find(d => d.date === today);
        const countToAdd = itemsToKeep.length;
        if (existing) return prev.map(d => d.date === today ? { ...d, count: (d.count || 0) + countToAdd } : d);
        return [...prev, { date: today, count: countToAdd }];
    });
  };

  const handleQuizFeedback = (id: string, type: QuizFeedbackType, suppress: boolean) => {
      setLibrary(prev => prev.map(n => n.id === id ? { ...n, quizFeedback: type, suppressQuizFeedback: suppress } : n));
  };

  const handleUpdateNote = (updatedNote: Note) => {
      setLibrary(prev => prev.map(old => old.id === updatedNote.id ? updatedNote : old));
  };

  const recordActivity = () => {
    const today = getLocalDateString();
    setActivity(prev => {
      const existing = (prev || []).find(d => d.date === today);
      if (existing) return prev.map(d => d.date === today ? { ...d, count: (d.count || 0) + 1 } : d);
      return [...(prev || []), { date: today, count: 1 }];
    });
  };

  const handleRestoreNote = (note: Note) => {
      setLibrary(prev => [note, ...prev]);
      setTrash(prev => prev.filter(n => n.id !== note.id));
  };

  const handleDuplicateNote = (note: Note) => {
      const newNote: Note = {
          ...note,
          id: Date.now().toString(),
          title: `${note.title} (Copy)`,
          createdAt: Date.now(),
          lastReviewedAt: Date.now(),
          quizAttempts: [],
          reviewCount: 0
      };
      setLibrary(prev => [newNote, ...prev]);
  };

  const handleDeleteForever = (id: string) => {
      setTrash(prev => prev.filter(n => n.id !== id));
  };

  const handleDeleteSignal = (id: string) => {
      const item = inbox.find(i => i.id === id);
      if (item) {
          setInboxTrash(prev => [item, ...prev]);
          setInbox(prev => prev.filter(i => i.id !== id));
      }
  };

  const handleRestoreSignal = (item: InboxItem) => {
      setInbox(prev => [item, ...prev]);
      setInboxTrash(prev => prev.filter(i => i.id !== item.id));
  };

  const handleDeleteSignalForever = (id: string) => {
      setInboxTrash(prev => prev.filter(i => i.id !== id));
  };

  const handleDeleteNote = (id: string) => {
      const n = library.find(x => x.id === id);
      if (n) {
          setLibrary(prev => prev.filter(x => x.id !== id));
          setTrash(prev => [n, ...prev]);
          setCanvases(prev => prev.map(c => ({
              ...c,
              state: {
                  ...c.state,
                  nodes: (c.state?.nodes || []).filter(node => node.noteId !== id)
              }
          })));
      }
  };

  const handleDeleteAllNotes = () => {
      setTrash(prev => [...library, ...prev]);
      setLibrary([]);
      setCanvases(prev => prev.map(c => ({
            ...c,
            state: {
                ...c.state,
                nodes: (c.state?.nodes || []).filter(node => !node.noteId)
            }
      })));
  };

  const handleSaveInsight = (question: string, answer: string, sourceTitle?: string) => {
      const activeItem = getActiveContextItem();
      const newInsight: SparkInsight = {
          id: `spark-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          question,
          answer,
          timestamp: Date.now()
      };
      if (activeItem) {
          const updatedNote = {
              ...activeItem,
              sparkInsights: [...(activeItem.sparkInsights || []), newInsight]
          };
          setLibrary(prev => prev.map(n => n.id === activeItem.id ? updatedNote : n));
      } else {
          const tags = ['#Insight', '#AI-Chat'];
          if (sourceTitle) {
              const cleanSource = sourceTitle.replace(/[#]/g, '').substring(0, 20);
              tags.push(`#${cleanSource}...`);
          }
          const newNote: Note = {
              id: `insight-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              sourceUrl: 'chat://insight',
              platform: Platform.GENERIC,
              title: question.trim(), 
              summary: [answer],
              tags: tags,
              createdAt: Date.now(),
              lastReviewedAt: Date.now(),
              reviewCount: 0,
              quizAttempts: [],
              needsRevision: false,
              type: 'insight'
          };
          setLibrary(prev => [newNote, ...prev]);
      }
      if (view === 'canvas' && activeCanvasId) {
          const canvas = canvases.find(c => c.id === activeCanvasId);
          if (canvas) {
              const sourceNode = selectedCanvasNodes.length === 1 ? selectedCanvasNodes[0] : null;
              const newNodeId = `spark-node-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
              const insightNode: CanvasNode = {
                  id: newNodeId,
                  type: 'spark',
                  title: question.substring(0, 30) + (question.length > 30 ? '...' : ''),
                  content: `**Q:** ${question}\n\n**A:** ${answer}`,
                  x: sourceNode ? sourceNode.x + (sourceNode.width || 250) + 50 : (-(canvas.state?.viewport?.x || 0) + 100) / (canvas.state?.viewport?.zoom || 1),
                  y: sourceNode ? sourceNode.y : (-(canvas.state?.viewport?.y || 0) + 100) / (canvas.state?.viewport?.zoom || 1),
                  width: 300,
                  color: '#F59E0B'
              };
              let newEdges = [...(canvas.state?.edges || [])];
              if (sourceNode) {
                  newEdges.push({
                      id: `edge-${sourceNode.id}-${newNodeId}`,
                      source: sourceNode.id,
                      target: newNodeId,
                      type: 'spark'
                  });
              }
              const updatedCanvas = {
                  ...canvas,
                  lastModified: Date.now(),
                  state: {
                      ...canvas.state,
                      nodes: [...(canvas.state?.nodes || []), insightNode],
                      edges: newEdges
                  }
              };
              setCanvases(prev => prev.map(c => c.id === activeCanvasId ? updatedCanvas : c));
          }
      }
      recordActivity();
  };

  const getActiveContextItem = (): Note | null => {
      if (view === 'canvas' && selectedCanvasNodes.length > 1) {
          return null;
      }
      
      // Prioritize explicit context set via card interaction
      if (isChatOpen && activeChatContextId) {
          const contextItem = library.find(n => n.id === activeChatContextId);
          if (contextItem) return contextItem;
      }
      
      // Fallback to active selection if chat is open but no specific context is hard-set
      if (view === 'canvas' && selectedCanvasNodes.length === 1) {
          const node = selectedCanvasNodes[0];
          if (node.noteId) return library.find(n => n.id === node.noteId) || null;
          if (node.content) {
              return {
                  id: node.id,
                  title: node.title || "Canvas Node",
                  summary: [node.content],
                  tags: [],
                  platform: Platform.GENERIC,
                  createdAt: Date.now(),
                  lastReviewedAt: Date.now(),
                  reviewCount: 0,
                  quizAttempts: [],
                  needsRevision: false,
                  sourceUrl: ''
              };
          }
      }

      if (focusedNoteId) {
          return library.find(n => n.id === focusedNoteId) || null;
      }
      
      return null;
  };

  const handleOpenChat = (noteId?: string, fileIndex?: number, query?: string) => {
    if (noteId) {
        setFocusedNoteId(noteId);
        setActiveChatContextId(noteId);
    } else {
        setActiveChatContextId(null);
    }
    if (fileIndex !== undefined) setChatFileIndex(fileIndex);
    else setChatFileIndex(0);
    
    if (query) setInitialChatQuery(query);
    else setInitialChatQuery(null);
    
    setIsChatOpen(true);
  };

  // Sync activeChatContextId to the single selected node to solve "same card" bug
  useEffect(() => {
    if (view === 'canvas') {
        if (selectedCanvasNodes.length === 1) {
            const node = selectedCanvasNodes[0];
            if (node.noteId) {
                setActiveChatContextId(node.noteId);
            } else {
                setActiveChatContextId(node.id);
            }
        } else {
            setActiveChatContextId(null);
        }
    }
  }, [selectedCanvasNodes, view]);

  const handleAddSelectedToFolder = (folderId: string) => {
    if (selectedCanvasNodes.length === 0) return;
    
    const existingNoteIds = new Set(selectedCanvasNodes.filter(n => n.noteId).map(n => n.noteId));
    const nodesToSave = selectedCanvasNodes.filter(n => !n.noteId);

    let newLibraryNotes: Note[] = [];
    let canvasNodeUpdates: Record<string, string> = {};

    nodesToSave.forEach(node => {
        const noteType = node.type === 'spark' ? 'spark' : 
                         node.type === 'collision' || node.type === 'synthesis' ? 'collision' : 
                         node.type === 'asset' ? 'asset' : 'note';
        
        const newNote: Note = {
            id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            title: node.title || "Untitled Note",
            summary: [node.content || ""],
            type: noteType as any,
            createdAt: Date.now(),
            lastReviewedAt: Date.now(),
            reviewCount: 0,
            platform: Platform.GENERIC,
            sourceUrl: node.source === 'neural_dump' ? 'neural://dump' : '',
            folder: folderId,
            tags: [],
            quizAttempts: [],
            needsRevision: false
        };
        newLibraryNotes.push(newNote);
        canvasNodeUpdates[node.id] = newNote.id;
    });

    setLibrary(prev => {
        const updated = prev.map(note => 
            existingNoteIds.has(note.id) ? { ...note, folder: folderId } : note
        );
        return [...newLibraryNotes, ...updated];
    });

    if (Object.keys(canvasNodeUpdates).length > 0 && activeCanvasId) {
        setCanvases(prev => prev.map(c => {
            if (c.id === activeCanvasId) {
                return {
                    ...c,
                    state: {
                        ...c.state,
                        nodes: (c.state?.nodes || []).map(n => 
                            canvasNodeUpdates[n.id] ? { ...n, noteId: canvasNodeUpdates[n.id] } : n
                        )
                    }
                };
            }
            return c;
        }));
    }
  };

  const handleAddNote = (note: Note) => {
    setLibrary(prev => {
      const exists = prev.some(n => n.id === note.id);
      if (exists) {
        return prev.map(n => n.id === note.id ? note : n);
      }
      return [note, ...prev];
    });
  };

  if (showWelcome) {
    return (
      <WelcomeScreen 
        onEnter={() => setShowWelcome(false)} 
      />
    );
  }

  return (
    <ErrorBoundary>
      <div className={`h-screen overflow-hidden flex flex-col ${THEME_CLASSES[theme]} font-sans animate-fade-in`}>

      {/* Auth & Profile Button */}
      {(view !== 'canvas' || !activeCanvasId) && (
        <div className="absolute top-6 right-6 z-[100] flex items-center gap-3">
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-black/10 shadow-sm">
              <div className="flex flex-col items-end mr-2">
                <span className="text-xs font-bold text-gray-900">Local User</span>
              </div>
              <button onClick={() => setShowProfile(true)} className="hover:opacity-80 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                    U
                  </div>
              </button>
            </div>
        </div>
      )}

      {showProfile && (
        <ProfileScreen
          userProfile={userProfile}
          onClose={() => setShowProfile(false)}
        />
      )}

      <main className="flex-1 h-full relative overflow-hidden flex flex-col">
      {/* Removed the isReadOnly conditional banner */}

        {view === 'canvas' && (
            <LearningCanvas 
                library={library || []} 
                inbox={inbox || []}
                inboxTrash={inboxTrash || []}
                noteTrash={trash || []}
                folders={folders || []}
                themes={themes || []}
                theme={theme} 
                canvases={canvases || []} 
                onUpdateCanvases={setCanvases} 
                canCreateCanvas={() => true}
                canUsePremiumFeatures={checkFeatureAccess}
                systemLanguage={userProfile?.language || localStorage.getItem('system_language') || 'English'}
                isReadOnly={isReadOnly}
                canvasTrash={canvasTrash || []} 
                onMoveCanvasToTrash={(id) => {const c = canvases.find(x => x.id === id); if(c) {setCanvases(prev => prev.filter(x => x.id !== id)); setCanvasTrash(prev => [c, ...prev]);}}} 
                onRestoreCanvas={(id) => {const c = canvasTrash.find(x => x.id === id); if(c) {setCanvasTrash(prev => prev.filter(x => x.id !== id)); setCanvases(prev => [c, ...prev]);}}} 
                onDeleteCanvasForever={(id) => setCanvasTrash(prev => prev.filter(x => x.id !== id))} 
                activeCanvasId={activeCanvasId} 
                onSelectCanvas={setActiveCanvasId} 
                onOpenNeuralDump={() => { if (checkFeatureAccess('NeuralDump')) setIsInputOpen(prev => !prev); }}
                onEnterMemoryLab={() => { if (checkFeatureAccess('MemoryLab')) setView('memory'); }}
                onGoToLibrary={() => setView('library')}
                onCapture={handleCapture}
                onDeleteSignal={handleDeleteSignal}
                onRestoreSignal={handleRestoreSignal}
                onDeleteSignalForever={handleDeleteSignalForever}
                onKeepSignal={handleKeep}
                onKeepAllSignals={handleKeepAllSignals}
                onUpdateNote={handleUpdateNote}
                onDeleteNote={handleDeleteNote}
                onRestoreNote={handleRestoreNote}
                onDeleteNoteForever={handleDeleteForever}
                onSelectionChange={setSelectedCanvasNodes}
                onExitWorkspace={() => setShowWelcome(true)}
                onOpenChat={handleOpenChat}
                onAddNote={handleAddNote}
                onAddFolder={handleAddFolder}
                onUpdateFolder={handleUpdateFolder}
                onDeleteFolder={handleDeleteFolder}
                onAddTheme={handleAddTheme}
                onUpdateTheme={handleUpdateTheme}
                onDeleteTheme={handleDeleteTheme}
                onAddSelectedToFolder={handleAddSelectedToFolder}
                isMemoryLabLocked={!checkFeatureAccess('MemoryLab', true)}
                isNeuralDumpLocked={!checkFeatureAccess('NeuralDump', true)}
                isInboxLocked={false}
                onAIUsage={() => incrementUsage(false)}
                onLogicGuardUsage={() => incrementUsage(true)}
            />
        )}
        
        {view === 'library' && (
             <div className="relative h-full w-full">
                <button 
                    onClick={() => setView('canvas')} 
                    className="absolute top-6 left-6 z-50 p-2 bg-white/10 backdrop-blur-md rounded-full text-black hover:bg-white/20 transition-all border border-black/10"
                >
                    <X className="w-6 h-6" />
                </button>
                <Library 
                    library={library || []} 
                    theme={theme} 
                    folders={folders || []}
                    themes={themes || []}
                    canvases={canvases || []}
                    isReadOnly={isReadOnly}
                    onUpdateNote={(note) => { if (!isReadOnly) handleUpdateNote(note); }} 
                    onDeleteNote={(id) => { if (!isReadOnly) handleDeleteNote(id); }}
                    onDeleteAll={() => { if (!isReadOnly) handleDeleteAllNotes(); }}
                    showDeleteWarning={showDeleteWarning}
                    onToggleDeleteWarning={setShowDeleteWarning}
                    usedNoteIds={new Set(canvases.flatMap(c => (c.state?.nodes || []).filter(n => n.noteId).map(n => n.noteId as string)))}
                    onQuizFeedback={handleQuizFeedback}
                    initialFocusedNoteId={focusedNoteId}
                    onFocusCleared={() => setFocusedNoteId(null)}
                    trash={trash}
                    onRestoreNote={(id) => { if (!isReadOnly) handleRestoreNote(id); }}
                    onDeleteForever={(id) => { if (!isReadOnly) handleDeleteForever(id); }}
                    onDuplicateNote={(id) => { if (!isReadOnly) handleDuplicateNote(id); }}
                    onOpenMemoryLab={() => { if (checkFeatureAccess('MemoryLab')) setView('memory'); }}
                    onOpenNeuralDump={() => { if (checkFeatureAccess('NeuralDump')) setIsInputOpen(prev => !prev); }}
                    onOpenChat={handleOpenChat}
                    onAddSelectedToFolder={(fid) => { if (!isReadOnly) handleAddSelectedToFolder(fid); }}
                    onAddFolder={(f) => { if (!isReadOnly) handleAddFolder(f); }}
                    onUpdateFolder={(f) => { if (!isReadOnly) handleUpdateFolder(f); }}
                    onDeleteFolder={(id) => { if (!isReadOnly) handleDeleteFolder(id); }}
                    onAddTheme={(t) => { if (!isReadOnly) return handleAddTheme(t); return t as any; }}
                    onUpdateTheme={(t) => { if (!isReadOnly) handleUpdateTheme(t); }}
                    onDeleteTheme={(id) => { if (!isReadOnly) handleDeleteTheme(id); }}
                    isMemoryLabLocked={!checkFeatureAccess('MemoryLab', true)}
                    isNeuralDumpLocked={!checkFeatureAccess('NeuralDump', true)}
                    canUseLogicGuard={() => checkFeatureAccess('LogicGuard')}
                    canUsePremiumFeatures={checkFeatureAccess}
                    onAIUsage={() => incrementUsage(false)}
                />
             </div>
        )}

        {view === 'memory' && (
             <div className="relative h-full w-full">
                <button 
                    onClick={() => setView('canvas')} 
                    className="absolute top-6 left-6 z-50 p-2 bg-white/10 backdrop-blur-md rounded-full text-black hover:bg-white/20 transition-all border border-black/10"
                >
                    <X className="w-6 h-6" />
                </button>
                <MemoryLab 
                    library={library || []}
                    theme={theme}
                    onNavigateToNote={(id) => { setFocusedNoteId(id); setView('library'); }}
                    onGoToLibrary={() => setView('library')}
                    data={retentionData}
                    onUpdateData={setRetentionData}
                    activity={activity}
                    onAIUsage={() => incrementUsage(false)}
                />
             </div>
        )}
      </main>

      {activeCanvasId && (
        <KoOrb 
          theme={theme} 
          library={library || []}
          isOpen={isChatOpen}
          isReadOnly={isReadOnly}
          onSetOpen={(open) => {
              if (open && !checkFeatureAccess('Chat')) return;
              setIsChatOpen(open);
              if (!open) setInitialChatQuery(null);
          }}
          isListening={isListening}
          onToggleListening={setIsListening}
          isInputOpen={isInputOpen}
          onToggleInput={setIsInputOpen}
          isProcessing={isProcessing}
          transcript={transcript}
          setTranscript={setTranscript}
          onProcess={(text, context) => triggerProcessing(text, context)}
          selectedNodes={view === 'canvas' ? selectedCanvasNodes : []}
          activeContextItem={getActiveContextItem()} 
          onSaveInsight={handleSaveInsight} 
          startAtIndex={chatFileIndex} 
          showNeuralInput={view === 'canvas'} 
          onUpdateNote={handleUpdateNote} 
          initialQuery={initialChatQuery}
          onSelectContext={(id, fileIndex) => {
              setActiveChatContextId(id);
              setChatFileIndex(fileIndex || 0);
          }}
          canUseLogicGuard={() => checkFeatureAccess('LogicGuard')}
          onLogicGuardUsed={() => incrementUsage(true)}
          canUseGeneralChat={() => checkFeatureAccess('Chat')}
          onGeneralChatUsed={() => incrementUsage(false)}
          isLogicGuardLocked={false}
        />
      )}
    </div>
    </ErrorBoundary>
  );
};

export default App;