
import React, { useState, useEffect, useRef } from 'react';
import { Note, AppTheme, QuizAttempt, Platform, Folder, Theme } from '../types';
import { Trash2, Edit2, Copy, Check, ExternalLink, Play, Loader2, AlertTriangle, Hash, Sparkles, MessageSquare, Save, X, RotateCw, History, CheckCircle2, Shield, ShieldAlert, Award, FlaskConical, Zap, Layers, FileText, HelpCircle, RefreshCw, ChevronLeft, ChevronRight, PlusCircle, Lightbulb, Scale, Eye, Plus, Map, Lock as LockIcon } from 'lucide-react';
import { regenerateQuiz, getSystemLanguage } from '../services/geminiService';
import { getLocaleString, t } from '../src/i18n';

// Helper for basic markdown (Bold only for now)
const renderMarkdown = (text: string) => {
    if (!text) return null;
    return text.split(/(\*\*.*?\*\*)/g).map((part, i) => 
        (part.startsWith('**') && part.endsWith('**')) 
            ? <strong key={i} className="font-bold text-gray-900">{part.slice(2, -2)}</strong> 
            : part
    );
};

interface SmartCardProps {
  note: Note;
  theme: AppTheme;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdateNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  onOpenChat?: (fileIndex?: number) => void;
  onAddToCanvas?: (note: Note) => void;
  isSelected?: boolean;
  folders?: Folder[];
  themes?: Theme[];
  canUseLogicGuard?: () => boolean;
  canUsePremiumFeatures?: (feature: 'Folders' | 'Themes' | 'Quizzes' | 'Chat', silent?: boolean) => boolean;
  onAIUsage?: () => void;
  isReadOnly?: boolean;
}

export const SmartCard: React.FC<SmartCardProps> = ({ 
  note, 
  isExpanded, 
  onToggleExpand, 
  onUpdateNote, 
  onDeleteNote,
  onOpenChat,
  onAddToCanvas,
  folders = [],
  themes = [],
  canUseLogicGuard,
  canUsePremiumFeatures,
  onAIUsage,
  isReadOnly = false
}) => {
  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title);
  const [editSummary, setEditSummary] = useState((note.summary || []).join('\n'));
  const [editTags, setEditTags] = useState((note.tags || []).join(', '));
  const [editFolder, setEditFolder] = useState(note.folder || "");
  
  // Reflection State
  const [reflection, setReflection] = useState(note.userThoughts || "");
  const [isSavingReflection, setIsSavingReflection] = useState(false);
  
  // Quiz State
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [quizActive, setQuizActive] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizFinished, setQuizFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<QuizAttempt | null>(null);

  // Copy Feedback
  const [showCopyCheck, setShowCopyCheck] = useState(false);

  // File Upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- THE CRITIC STATE ---
  const [isScanning, setIsScanning] = useState(false);
  
  // Persistence Logic: 
  const hasCritique = !!note.critique;
  const [isCritiqueVisible, setIsCritiqueVisible] = useState(hasCritique);

  // Determine Type & Styling
  const isSpark = note.type === 'spark';
  const isCollision = note.type === 'collision';
  const isAsset = note.type === 'asset';
  const isInsight = note.type === 'insight'; 
  
  // Determine if this is a File based card
  const isFileNote = note.platform === Platform.FILE;
  const primaryFile = (note.userFiles && note.userFiles.length > 0) ? note.userFiles[0] : null;
  const isImageFile = isFileNote && primaryFile && primaryFile.startsWith('data:image');
  const isPdfFile = isFileNote && primaryFile && primaryFile.startsWith('data:application/pdf');
  const isDocFile = isFileNote && primaryFile && !isImageFile && !isPdfFile; 

  // Visual Configuration based on Type
  const getCardStyle = () => {
      const folder = note.folder ? folders.find(f => f.id === note.folder) : null;
      const themeObj = note.theme ? themes.find(t => t.id === note.theme) : null;
      
      if ((folder?.color && folder.color.startsWith('#')) || (themeObj?.color && themeObj.color.startsWith('#'))) {
          return 'shadow-sm'; // Will use inline style for colors
      }
      
      if (isSpark) return 'bg-amber-50 border-amber-200 hover:border-amber-300 shadow-sm';
      if (isCollision) return 'bg-violet-50 border-violet-200 hover:border-violet-300 shadow-sm';
      if (isAsset) return 'bg-emerald-50 border-emerald-200 hover:border-emerald-300 shadow-sm';
      if (isInsight) return 'bg-amber-50 border-amber-200 hover:border-amber-300 shadow-sm'; 
      if (isDocFile || isPdfFile) return 'bg-white border-sky-300 hover:border-sky-400 shadow-sm'; 
      return 'bg-white border-sky-300 hover:border-sky-400 shadow-sm';
  };

  const folder = note.folder ? folders.find(f => f.id === note.folder) : null;
  const themeObj = note.theme ? themes.find(t => t.id === note.theme) : null;
  
  const cardInlineStyle: React.CSSProperties = {};
  
  // Apply solid tinted background if folder or theme is present
  const activeColor = folder?.color || themeObj?.color;
  
  if (activeColor && activeColor.startsWith('#')) {
      // Create a light tint for the background (10% opacity equivalent)
      cardInlineStyle.backgroundColor = `color-mix(in srgb, ${activeColor} 15%, white)`; // Solid but tinted
      cardInlineStyle.borderColor = activeColor;
      cardInlineStyle.borderWidth = '2px';
  } else if (isSpark || isInsight) {
      cardInlineStyle.backgroundColor = '#fffbeb'; // amber-50
  } else if (isCollision) {
      cardInlineStyle.backgroundColor = '#f5f3ff'; // violet-50
  } else if (isAsset) {
      cardInlineStyle.backgroundColor = '#ecfdf5'; // emerald-50
  }

  const getTypeIcon = () => {
      if (isSpark) return <Sparkles className="w-4 h-4 text-amber-600" />;
      if (isCollision) return <Zap className="w-4 h-4 text-violet-600" />;
      if (isAsset) return <FlaskConical className="w-4 h-4 text-emerald-600" />;
      if (isInsight) return <MessageSquare className="w-4 h-4 text-amber-600" />;
      if (isDocFile) return <FileText className="w-4 h-4 text-sky-600" />;
      if (isImageFile) return <Eye className="w-4 h-4 text-indigo-600" />;
      return <Layers className="w-4 h-4 text-sky-600" />;
  };

  const getTypeLabel = () => {
      let label = "";
      if (isSpark) label = t("Spark", getSystemLanguage());
      else if (isCollision) label = t("Collision", getSystemLanguage());
      else if (isAsset) label = t("Alchemy", getSystemLanguage());
      else if (isInsight) label = t("AI Chat", getSystemLanguage());
      else if (isDocFile) label = t("Document", getSystemLanguage());
      else if (isPdfFile) label = t("PDF", getSystemLanguage());
      else if (isImageFile) label = t("Snapshot", getSystemLanguage());
      else if (note.sourceUrl === 'neural://dump') label = t("Neural Dump", getSystemLanguage());
      else label = t("Note", getSystemLanguage());

      if (folder) return <span className="flex items-center" style={{ color: folder.color }}><span className="font-black">{label.toUpperCase()} - {folder.name}</span></span>;
      return <span className="font-black">{label.toUpperCase()}</span>;
  };

  useEffect(() => {
    if (!isEditing) {
        setEditTitle(note.title);
        setEditSummary((note.summary || []).join('\n'));
        setEditTags((note.tags || []).join(', '));
        setEditFolder(note.folder || "");
        setReflection(note.userThoughts || "");
    }
  }, [note, isEditing]);

  useEffect(() => {
      if (note.critique && !isCritiqueVisible) {
          setIsCritiqueVisible(true);
      }
  }, [note.critique]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `${note.title}\n\n${(note.summary || []).join('\n')}`;
    navigator.clipboard.writeText(text);
    setShowCopyCheck(true);
    setTimeout(() => setShowCopyCheck(false), 2000);
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    if (!isExpanded) onToggleExpand();
  };

  const handleSaveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedNote = {
        ...note,
        title: editTitle,
        summary: editSummary.split('\n').filter(line => line.trim() !== ''),
        tags: editTags.split(',').map(t => t.trim()).filter(t => t !== ''),
        folder: editFolder.trim() || undefined
    };
    onUpdateNote(updatedNote);
    setIsEditing(false);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    setEditTitle(note.title);
    setEditSummary((note.summary || []).join('\n'));
    setEditTags((note.tags || []).join(', '));
    setEditFolder(note.folder || "");
  };

  const handleReflectionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setReflection(e.target.value);
  };

  const saveReflection = () => {
      if (reflection !== note.userThoughts) {
          setIsSavingReflection(true);
          onUpdateNote({ ...note, userThoughts: reflection });
          setTimeout(() => setIsSavingReflection(false), 800);
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const files = Array.from(e.target.files) as File[];
          const newFiles: string[] = [];
          let processedCount = 0;

          files.forEach(file => {
              const reader = new FileReader();
              reader.onloadend = () => {
                  const r = reader.result;
                  const base64 = typeof r === 'string' ? r : '';
                  if (base64) {
                      newFiles.push(base64);
                  }
                  processedCount++;
                  
                  if (processedCount === files.length) {
                      onUpdateNote({ ...note, userFiles: [...(note.userFiles || []), ...newFiles] });
                  }
              };
              reader.readAsDataURL(file);
          });
          e.target.value = '';
      }
  };

  const removeFile = (index: number) => {
      const newFiles = (note.userFiles || []).filter((_, i) => i !== index);
      onUpdateNote({ ...note, userFiles: newFiles });
  };

  const handleStartQuiz = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (canUsePremiumFeatures && !canUsePremiumFeatures('Quizzes')) return;
      setQuizActive(true);
      setQuizStep(0);
      setQuizAnswers({});
      setQuizFinished(false);
      setShowHistory(false);
      setSelectedAttempt(null);
  };

  const handleAnswer = (optionIdx: number, e: React.MouseEvent) => {
      e.stopPropagation();
      const newAnswers = { ...quizAnswers, [quizStep]: optionIdx };
      setQuizAnswers(newAnswers);
      setTimeout(() => {
          if (quizStep < (note.generatedQuiz?.length || 0) - 1) {
              setQuizStep(prev => prev + 1);
          } else {
              finishQuiz(newAnswers);
          }
      }, 400);
  };

  const finishQuiz = (finalAnswers: Record<number, number>) => {
      if (!note.generatedQuiz) return;
      
      let correct = 0;
      note.generatedQuiz.forEach((q, i) => {
          if (finalAnswers[i] === q.correctAnswerIndex) correct++;
      });
      
      const attempt: QuizAttempt = {
          timestamp: Date.now(),
          score: correct,
          totalQuestions: note.generatedQuiz.length,
          answers: finalAnswers,
          questions: note.generatedQuiz
      };
      
      onUpdateNote({ 
          ...note, 
          quizAttempts: [...(note.quizAttempts || []), attempt], 
          lastReviewedAt: Date.now(), 
          reviewCount: (note.reviewCount || 0) + 1 
      });
      
      setScore(correct);
      setQuizFinished(true);
      setQuizActive(false);
  };

  const handleRegenerateQuiz = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (canUsePremiumFeatures && !canUsePremiumFeatures('Quizzes')) return;
      setIsRegenerating(true);
      try {
          const newQuiz = await regenerateQuiz(note.summary);
          onAIUsage?.();
          onUpdateNote({ ...note, generatedQuiz: newQuiz });
          setQuizActive(false);
          setQuizFinished(false);
          setShowHistory(false);
          setSelectedAttempt(null);
      } catch (err) {
          console.error("Quiz regeneration failed", err);
      } finally {
          setIsRegenerating(false);
      }
  };

  const handleScan = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (canUseLogicGuard && !canUseLogicGuard()) return;
      if (isCritiqueVisible) { setIsCritiqueVisible(false); return; }
      if (note.critique) { setIsCritiqueVisible(true); return; }
      setIsScanning(true);
      try {
          const { analyzeFallacy } = await import('../services/geminiService');
          const result = await analyzeFallacy(note.summary.join(' '));
          onUpdateNote({ ...note, critique: result });
          setIsCritiqueVisible(true);
      } catch (err) { console.error("Scan failed", err); } finally { setIsScanning(false); }
  };

  // --- Source / Action Handler ---
  const handleOpenSource = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (note.sourceUrl && (note.sourceUrl.startsWith('http') || note.sourceUrl.startsWith('https'))) {
          window.open(note.sourceUrl, '_blank');
      }
  };

  const renderQuizHistory = () => {
      if (selectedAttempt) {
          return (
              <div className="space-y-4 animate-slide-up">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedAttempt(null); }} className="text-xs font-bold text-gray-500 hover:text-gray-900 flex items-center">
                          <ChevronLeft className="w-3 h-3 mr-1" /> Back
                      </button>
                      <span className="text-xs font-black uppercase tracking-widest text-gray-400">
                          {new Date(selectedAttempt.timestamp).toLocaleDateString(getLocaleString(getSystemLanguage()))} • {selectedAttempt.score}/{selectedAttempt.totalQuestions}
                      </span>
                  </div>
                  
                  <div className="space-y-4">
                      {selectedAttempt.questions?.map((q, idx) => {
                          const userAnswer = selectedAttempt.answers[idx];
                          const isCorrect = userAnswer === q.correctAnswerIndex;
                          return (
                              <div key={idx} className={`p-4 rounded-xl border ${isCorrect ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                                  <p className="text-xs font-bold text-gray-900 mb-2">{idx + 1}. {q.question}</p>
                                  <div className="space-y-1">
                                      {q.options.map((opt, optIdx) => {
                                          let bg = 'bg-white/50 text-gray-500';
                                          if (optIdx === q.correctAnswerIndex) bg = 'bg-green-200/50 text-green-800 font-bold border border-green-200';
                                          if (optIdx === userAnswer && !isCorrect) bg = 'bg-red-200/50 text-red-800 font-bold border border-red-200';
                                          return (
                                              <div key={optIdx} className={`text-[10px] px-2 py-1.5 rounded-lg ${bg}`}>
                                                  {opt} {optIdx === userAnswer && (isCorrect ? '✅' : '❌')}
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
          );
      }

      return (
          <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-900 mb-2">Past Attempts</h4>
              {(note.quizAttempts || []).length === 0 ? (
                  <p className="text-xs text-gray-400">No history available yet.</p>
              ) : (
                  (note.quizAttempts || []).slice().reverse().map((attempt, idx) => (
                      <button 
                          key={idx} 
                          onClick={(e) => { e.stopPropagation(); setSelectedAttempt(attempt); }}
                          className="w-full flex items-center justify-center p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition text-left group"
                      >
                          <span className="text-xs font-medium text-gray-500 mr-auto">{new Date(attempt.timestamp).toLocaleDateString(getLocaleString(getSystemLanguage()))} {new Date(attempt.timestamp).toLocaleTimeString(getLocaleString(getSystemLanguage()), {hour: '2-digit', minute:'2-digit'})}</span>
                          <div className="flex items-center">
                              <span className={`text-xs font-bold px-2 py-1 rounded-md mr-2 ${attempt.score === attempt.totalQuestions ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                                  {attempt.score}/{attempt.totalQuestions}
                              </span>
                              <ChevronRight className="w-3 h-3 text-gray-300 transition-colors" />
                          </div>
                      </button>
                  ))
              )}
              <button onClick={(e) => { e.stopPropagation(); setShowHistory(false); }} className="w-full mt-2 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg">Back to Quiz</button>
          </div>
      );
  };

  const getCritiqueStatus = () => {
      if (!note.critique) return null;
      const { isSafe, structuredAnalysis } = note.critique;

      if (structuredAnalysis) {
          const logicStatus = structuredAnalysis.logic?.status?.toLowerCase() || '';
          const factualStatus = structuredAnalysis.factual?.status?.toLowerCase() || '';
          const balanceStatus = structuredAnalysis.balance?.status?.toLowerCase() || '';

          if (logicStatus.includes('fallacy') || logicStatus.includes('flaw') || factualStatus.includes('unverified') || factualStatus.includes('misleading')) {
              return 'danger';
          }
          if (balanceStatus.includes('skewed') || balanceStatus.includes('echo') || balanceStatus.includes('bias')) {
              return 'warning';
          }
          return 'safe';
      }
      if (note.critique.issue?.toLowerCase().includes('fallacy') || note.critique.issue?.toLowerCase().includes('flaw')) {
          return 'danger';
      }
      return isSafe ? 'safe' : 'danger';
  };

  const critiqueStatus = getCritiqueStatus();

  return (
    <div 
        id={`note-${note.id}`}
        draggable
        onDragStart={(e) => {
            e.dataTransfer.setData('noteId', note.id);
            e.dataTransfer.effectAllowed = 'move';
        }}
        onDragOver={(e) => {
            if (e.dataTransfer.types.includes('themeid') || e.dataTransfer.types.includes('themeId')) {
                e.preventDefault();
                e.currentTarget.classList.add('ring-2', 'ring-blue-500');
            }
        }}
        onDragLeave={(e) => {
            e.currentTarget.classList.remove('ring-2', 'ring-blue-500');
        }}
        onDrop={(e) => {
            e.currentTarget.classList.remove('ring-2', 'ring-blue-500');
            const themeId = e.dataTransfer.getData('themeId');
            if (themeId) {
                e.preventDefault();
                onUpdateNote({ ...note, theme: themeId });
            }
        }}
        className={`rounded-3xl p-6 md:p-8 shadow-sm transition-all duration-300 relative group overflow-hidden border ${getCardStyle()} ${isExpanded ? 'ring-2 ring-black/5' : ''}`}
        onClick={!isEditing ? onToggleExpand : undefined}
        style={cardInlineStyle}
    >
        {critiqueStatus === 'danger' && (
             <div className="absolute top-0 right-0 z-20 bg-rose-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-2xl rounded-tr-3xl flex items-center shadow-lg animate-scale-in">
                 <AlertTriangle className="w-3 h-3 mr-1.5 fill-current" /> FALLACY DETECTED
             </div>
        )}
        {critiqueStatus === 'warning' && (
             <div className="absolute top-0 right-0 z-20 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-2xl rounded-tr-3xl flex items-center shadow-lg animate-scale-in">
                 <Scale className="w-3 h-3 mr-1.5 fill-current" /> COGNITIVE SKEW
             </div>
        )}
        {critiqueStatus === 'safe' && note.critique && (
             <div className="absolute top-0 right-0 z-20 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-2xl rounded-tr-3xl flex items-center shadow-lg animate-scale-in">
                 <CheckCircle2 className="w-3 h-3 mr-1.5" /> SOLID LOGIC
             </div>
        )}

        {/* --- HEADER --- */}
        <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="flex items-center space-x-2">
                <div className={`p-2 rounded-xl bg-white/50 border border-black/5`}>
                    {getTypeIcon()}
                </div>
                <div className="flex flex-col">
                    <div className="text-[10px] font-black uppercase tracking-widest flex items-center space-x-2">
                        {getTypeLabel()}
                        <span>•</span>
                        <span className="text-gray-400">{new Date(note.createdAt).toLocaleDateString(getLocaleString(getSystemLanguage()))}</span>
                    </div>
                    {note.critique && !isExpanded && (
                         <div className={`text-[9px] font-bold flex items-center mt-0.5 ${
                             critiqueStatus === 'danger' ? 'text-rose-500' : 
                             critiqueStatus === 'warning' ? 'text-amber-600' : 
                             'text-emerald-600'
                         }`}>
                             {critiqueStatus === 'danger' ? <ShieldAlert className="w-3 h-3 mr-1" /> : 
                              critiqueStatus === 'warning' ? <Scale className="w-3 h-3 mr-1" /> :
                              <Shield className="w-3 h-3 mr-1" />}
                             
                             {critiqueStatus === 'danger' ? 'Fallacy Detected' : 
                              critiqueStatus === 'warning' ? 'Cognitive Skew' : 
                              'Logic Verified'}
                         </div>
                    )}
                </div>
            </div>

            <div className="flex items-center space-x-1 transition-opacity">
                {onAddToCanvas && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAddToCanvas(note); }}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-blue-500 transition"
                        title="Add to Canvas"
                    >
                        <Map className="w-4 h-4" />
                    </button>
                )}
                <button 
                    onClick={handleScan}
                    disabled={isScanning}
                    className={`p-2 rounded-full transition-colors ${isCritiqueVisible ? 'bg-gray-100 text-gray-600' : 'hover:bg-gray-100 text-gray-400'}`}
                    title="Logic Guard Scan"
                >
                    {isScanning ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <ShieldAlert className="w-4 h-4" />}
                </button>
                <button 
                    onClick={handleCopy} 
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition"
                    title="Copy to Clipboard"
                >
                    {showCopyCheck ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
                {!isReadOnly && (
                    <>
                        <button 
                            onClick={handleStartEdit} 
                            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition"
                            title="Edit Note"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }} 
                            className="p-2 hover:bg-red-50 rounded-full text-gray-400 hover:text-red-500 transition"
                            title="Delete Note"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>
        </div>

        {/* --- TITLE --- */}
        {isEditing ? (
            <input 
                type="text" 
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full text-xl md:text-2xl font-black text-gray-900 bg-transparent border-b-2 border-transparent focus:border-blue-500 focus:outline-none mb-4 pb-2 transition-colors placeholder-gray-300"
                placeholder={t("Title", getSystemLanguage())}
                autoFocus
            />
        ) : (
            <h3 className={`text-xl md:text-2xl font-black mb-4 leading-tight relative z-10 ${isSpark ? 'text-amber-900' : isCollision ? 'text-violet-900' : isAsset ? 'text-emerald-900' : isDocFile ? 'text-gray-900' : 'text-gray-900'}`}>
                {note.title}
            </h3>
        )}

        {/* --- SUMMARY CONTENT --- */}
        <div className="relative z-10">
            {isEditing ? (
                <div className="space-y-4">
                    <textarea 
                        value={editSummary}
                        onChange={(e) => setEditSummary(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onWheel={(e) => e.stopPropagation()}
                        className="w-full h-auto min-h-[300px] p-4 -ml-4 rounded-xl bg-transparent border-none focus:ring-0 text-base text-gray-700 leading-relaxed resize-none focus:bg-white/50 transition-colors placeholder-gray-400"
                        placeholder={t("Start typing your summary...", getSystemLanguage())}
                    />
                    <div className="space-y-1 pt-4 border-t border-black/5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tags</label>
                        <input 
                            type="text" 
                            value={editTags}
                            onChange={(e) => setEditTags(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full py-2 bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none text-sm text-gray-600 placeholder-gray-300"
                            placeholder={t("#Tag1, #Tag2", getSystemLanguage())}
                        />
                    </div>
                    <div className="space-y-1 pt-4 border-t border-black/5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Folder</label>
                        <select 
                            value={editFolder}
                            onChange={(e) => setEditFolder(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full py-2 bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none text-sm text-gray-600"
                        >
                            <option value="">No Folder</option>
                            {folders.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-between items-center pt-4">
                        <button onClick={handleCancelEdit} className="px-4 py-2 rounded-lg text-xs font-bold text-gray-500 hover:bg-black/5 transition-colors">Cancel</button>
                        {!isReadOnly && (
                            <button onClick={handleSaveEdit} className="px-6 py-2 rounded-lg text-xs font-bold bg-black text-white hover:bg-gray-800 flex items-center shadow-lg transition-all"><Save className="w-3 h-3 mr-2" /> Save Changes</button>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    {/* --- FILE PREVIEW --- */}
                    {isFileNote && primaryFile && (
                        <div className="mb-6 rounded-2xl overflow-hidden border border-black/5 bg-gray-50 aspect-video relative group/file">
                            {isImageFile ? (
                                <img src={primaryFile} className="w-full h-full object-cover" alt="Source Preview" />
                            ) : isPdfFile ? (
                                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                                    <FileText className="w-12 h-12 text-blue-500 mb-2" />
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">PDF Document</span>
                                    <p className="text-[10px] text-gray-400 mt-1">Click to open in chat for full preview</p>
                                </div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                                    <FileText className="w-12 h-12 text-gray-400 mb-2" />
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Word / Text Document</span>
                                    <p className="text-[10px] text-gray-400 mt-1">Full preview available in chat</p>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover/file:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover/file:opacity-100">
                                <button onClick={(e) => { e.stopPropagation(); if (!canUsePremiumFeatures || canUsePremiumFeatures('Chat')) onOpenChat?.(); }} className="bg-white text-black px-4 py-2 rounded-full text-xs font-bold shadow-lg transition-all">Open Preview</button>
                            </div>
                        </div>
                    )}

                    <div className={`space-y-3 ${!isExpanded ? 'line-clamp-3' : ''}`}>
                        {(note.summary || []).map((point, idx) => (
                            <div key={idx} className="flex items-start">
                                <span className={`mr-3 mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isSpark ? 'bg-amber-400' : isCollision ? 'bg-violet-400' : isAsset ? 'bg-emerald-400' : 'bg-blue-400'}`}></span>
                                <p className="text-gray-600 leading-relaxed text-sm md:text-base">{renderMarkdown(point)}</p>
                            </div>
                        ))}
                        {!isExpanded && (note.summary || []).length > 0 && (
                            <div className={`absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent`} />
                        )}
                    </div>
                </>
            )}
        </div>

        {/* --- CRITIQUE RESULT --- */}
        {isCritiqueVisible && note.critique && (
            <div className="mt-6 mb-2 animate-slide-up relative z-10">
                 <div className="bg-zinc-950 rounded-xl p-4 font-mono text-xs border border-zinc-800 shadow-xl relative overflow-hidden text-zinc-300">
                     <div className={`absolute left-0 top-0 bottom-0 w-1 ${critiqueStatus === 'safe' ? 'bg-emerald-500' : critiqueStatus === 'warning' ? 'bg-amber-500' : 'bg-red-600'}`}></div>
                     <div className="flex flex-col gap-3 pl-2 relative z-10">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                             <div className="flex items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                 {critiqueStatus === 'safe' ? <Shield className="w-3 h-3 mr-2 text-emerald-500" /> : 
                                  critiqueStatus === 'warning' ? <Scale className="w-3 h-3 mr-2 text-amber-500" /> :
                                  <ShieldAlert className="w-3 h-3 mr-2 text-red-500" />}
                                 🛡️ CRITIC SCAN RESULTS
                             </div>
                             <button onClick={(e) => { e.stopPropagation(); setIsCritiqueVisible(false); }} className="text-zinc-500 hover:text-white"><X className="w-3 h-3" /></button>
                        </div>
                        
                        {note.critique.structuredAnalysis ? (
                            <div className="space-y-4 pt-2">
                                <div>
                                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">1. 📊 FACTUAL ACCURACY</div>
                                    <div className="pl-2 border-l border-zinc-800">
                                        <div className="text-xs mb-0.5"><span className="text-zinc-500 font-bold">Status:</span> {note.critique.structuredAnalysis.factual.status}</div>
                                        <div className="text-xs"><span className="text-zinc-500 font-bold">Issue:</span> {note.critique.structuredAnalysis.factual.issue}</div>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">2. ⚖️ COGNITIVE BALANCE</div>
                                    <div className="pl-2 border-l border-zinc-800">
                                        <div className="text-xs mb-0.5"><span className="text-zinc-500 font-bold">Status:</span> {note.critique.structuredAnalysis.balance.status}</div>
                                        <div className="text-xs"><span className="text-zinc-500 font-bold">Check:</span> {note.critique.structuredAnalysis.balance.check}</div>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">3. 🧠 LOGICAL INTEGRITY</div>
                                    <div className="pl-2 border-l border-zinc-800">
                                        <div className="text-xs mb-0.5"><span className="text-zinc-500 font-bold">Status:</span> {note.critique.structuredAnalysis.logic.status}</div>
                                        <div className="text-xs mb-0.5"><span className="text-zinc-500 font-bold">Type:</span> {note.critique.structuredAnalysis.logic.type}</div>
                                        <div className="text-xs"><span className="text-zinc-500 font-bold">Explanation:</span> {note.critique.structuredAnalysis.logic.explanation}</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-start mt-1">
                                     <span className={`${note.critique.isSafe ? 'text-emerald-500' : 'text-red-500'} font-bold mr-3 shrink-0`}>{'>'} {note.critique.isSafe ? 'STATUS:' : 'ISSUE:'}</span>
                                     <span>{note.critique.issue || "Analyzed"}</span>
                                </div>
                                <div className="flex items-start">
                                     <span className="text-blue-400 font-bold mr-3 shrink-0">{'>'} {note.critique.isSafe ? 'ACTION:' : 'FIX:'}</span>
                                     <span>{note.critique.fix || "No action needed."}</span>
                                </div>
                            </>
                        )}
                     </div>
                 </div>
            </div>
        )}

        {/* --- EXPANDED FOOTER --- */}
        {isExpanded && !isEditing && (
            <div className="mt-8 pt-6 border-t border-black/5 relative z-10 animate-fade-in space-y-8">
                {/* Tags, Folder & Source */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-2">
                        {note.folder && folders.find(f => f.id === note.folder) && (
                            <span 
                                className="text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider flex items-center bg-gray-100 text-gray-700 border border-gray-200 max-w-[120px]"
                                style={{ borderColor: folders.find(f => f.id === note.folder)?.color, color: folders.find(f => f.id === note.folder)?.color }}
                            >
                                <span className="mr-1 shrink-0">📁</span>
                                <span className="truncate">{folders.find(f => f.id === note.folder)?.name}</span>
                            </span>
                        )}
                        {note.theme && themes.find(t => t.id === note.theme) && (
                            <span 
                                className="text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider flex items-center bg-gray-100 text-gray-700 border border-gray-200 max-w-[120px]"
                                style={{ borderColor: themes.find(t => t.id === note.theme)?.color, color: themes.find(t => t.id === note.theme)?.color }}
                            >
                                <div className="w-2 h-2 rounded-full mr-1 shrink-0" style={{ backgroundColor: themes.find(t => t.id === note.theme)?.color }}></div>
                                <span className="truncate">{themes.find(t => t.id === note.theme)?.name}</span>
                            </span>
                        )}
                        {note.tags?.map(tag => (
                            <span key={tag} className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider flex items-center ${isSpark ? 'bg-amber-100 text-amber-700' : isCollision ? 'bg-violet-100 text-violet-700' : isAsset ? 'bg-emerald-100 text-emerald-700' : isDocFile ? 'bg-sky-50 text-sky-700 border border-sky-100' : 'bg-sky-50 text-sky-700 border border-sky-100'}`}>
                                <Hash className="w-2.5 h-2.5 mr-0.5" />{tag.replace('#', '')}
                            </span>
                        ))}
                    </div>
                    {/* Source Link & Add to Canvas */}
                    <div className="flex items-center space-x-2">
                        {onAddToCanvas && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onAddToCanvas(note); }}
                                className="text-xs font-bold flex items-center px-3 py-1.5 rounded-lg transition-colors bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-200"
                            >
                                Add to Canvas <Map className="w-3 h-3 ml-2" />
                            </button>
                        )}
                        
                        {/* UNIFIED CHAT BUTTON - The Only Entry Point */}
                        {onOpenChat && (
                             <button 
                                onClick={(e) => { e.stopPropagation(); if (!canUsePremiumFeatures || canUsePremiumFeatures('Chat')) onOpenChat(); }} // Default open, let Orb handle defaults
                                className="text-xs font-bold flex items-center px-4 py-2 rounded-lg transition-colors bg-black text-white hover:bg-gray-800 shadow-md active:scale-95"
                                title="Chat with this memory"
                            >
                                <MessageSquare className="w-4 h-4 mr-2" /> Chat with Memory
                            </button>
                        )}

                        {note.sourceUrl && (
                            <button 
                                onClick={handleOpenSource}
                                className="text-xs font-bold flex items-center px-3 py-1.5 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                                title="Open Original Link"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* --- SPARK INSIGHTS SECTION --- */}
                {note.sparkInsights && note.sparkInsights.length > 0 && (
                    <div className="bg-amber-50/50 border border-amber-100 rounded-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-amber-100/50 border-b border-amber-100 p-4 flex items-center">
                            <Lightbulb className="w-4 h-4 text-amber-600 mr-2" />
                            <span className="text-xs font-black uppercase tracking-widest text-amber-800">Spark Insights</span>
                        </div>
                        <div className="p-4 space-y-4">
                            {note.sparkInsights.map((insight, idx) => (
                                <div key={insight.id || idx} className="bg-white p-4 rounded-xl border border-amber-100/50 shadow-sm">
                                    <div className="flex items-start mb-2">
                                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mr-2 mt-0.5">Q:</span>
                                        <p className="text-sm font-bold text-gray-800">{insight.question}</p>
                                    </div>
                                    <div className="flex items-start">
                                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mr-2 mt-0.5">A:</span>
                                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{renderMarkdown(insight.answer)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- FULL QUIZ INTERFACE --- */}
                <div className="bg-white/80 border border-gray-200 rounded-2xl overflow-hidden shadow-sm" onClick={e => e.stopPropagation()}>
                    {note.generatedQuiz && note.generatedQuiz.length > 0 ? (
                        <>
                            {/* Quiz Header */}
                            <div className="bg-gray-50/50 border-b border-gray-100 p-4 flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <HelpCircle className="w-4 h-4 text-blue-600" />
                                    <span className="text-xs font-black uppercase tracking-widest text-gray-700">Knowledge Check</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {(note.quizAttempts?.length || 0) > 0 && (
                                        <button onClick={(e) => {e.stopPropagation(); setShowHistory(!showHistory); setSelectedAttempt(null);}} className={`p-1.5 rounded-lg transition flex items-center text-[10px] font-bold ${showHistory ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200 text-gray-400 hover:text-gray-900'}`}>
                                            <History className="w-3.5 h-3.5 mr-1" /> History
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Quiz Content Area */}
                            <div className="p-6">
                                {showHistory ? renderQuizHistory() : (
                                    quizFinished ? (
                                        <div className="text-center py-6 animate-fade-in">
                                            <div className="inline-flex p-4 bg-green-50 text-green-600 rounded-full mb-4">
                                                <Award className="w-8 h-8" />
                                            </div>
                                            <h3 className="text-xl font-black text-gray-900 mb-2">Quiz Completed!</h3>
                                            <p className="text-sm text-gray-500 mb-6">You scored <span className="font-bold text-gray-900">{score}</span> out of <span className="font-bold text-gray-900">{note.generatedQuiz.length}</span></p>
                                            <div className="flex justify-center space-x-3">
                                                <button onClick={(e) => handleStartQuiz(e)} className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition flex items-center ${canUsePremiumFeatures && !canUsePremiumFeatures('Quizzes', true) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
                                                    {canUsePremiumFeatures && !canUsePremiumFeatures('Quizzes', true) ? <LockIcon className="w-3.5 h-3.5 mr-2" /> : <RotateCw className="w-3.5 h-3.5 mr-2" />} Retry
                                                </button>
                                                {!isReadOnly && (
                                                    <button onClick={(e) => handleRegenerateQuiz(e)} className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition flex items-center ${canUsePremiumFeatures && !canUsePremiumFeatures('Quizzes', true) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-black text-white'}`}>
                                                        {isRegenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : (canUsePremiumFeatures && !canUsePremiumFeatures('Quizzes', true) ? <LockIcon className="w-3.5 h-3.5 mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />)}
                                                        New Questions
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ) : quizActive ? (
                                        <div className="animate-slide-up">
                                            <div className="flex justify-between items-center mb-6">
                                                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Question {quizStep + 1} of {note.generatedQuiz.length}</span>
                                                <div className="flex gap-1">
                                                    {note.generatedQuiz.map((_, i) => (
                                                        <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === quizStep ? 'bg-blue-500' : i < quizStep ? 'bg-blue-200' : 'bg-gray-200'}`} />
                                                    ))}
                                                </div>
                                            </div>
                                            <h4 className="text-base font-bold text-gray-900 mb-6 leading-relaxed">{note.generatedQuiz[quizStep].question}</h4>
                                            <div className="space-y-3">
                                                {note.generatedQuiz[quizStep].options.map((opt, i) => (
                                                    <button 
                                                        key={i}
                                                        onClick={(e) => handleAnswer(i, e)}
                                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all flex justify-between items-center group ${quizAnswers[quizStep] === i ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-100 hover:border-blue-200 bg-white hover:bg-blue-50/30 text-gray-700'}`}
                                                    >
                                                        <span className="text-sm font-medium">{opt}</span>
                                                        {quizAnswers[quizStep] === i && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="font-bold text-gray-900 text-sm mb-1">Ready to review?</h4>
                                                <p className="text-xs text-gray-500">{note.generatedQuiz.length} questions available.</p>
                                            </div>
                                            <button onClick={(e) => handleStartQuiz(e)} className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-all flex items-center ${canUsePremiumFeatures && !canUsePremiumFeatures('Quizzes', true) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-black text-white'}`}>
                                                {canUsePremiumFeatures && !canUsePremiumFeatures('Quizzes', true) ? <LockIcon className="w-3 h-3 mr-2 fill-current" /> : <Play className="w-3 h-3 mr-2 fill-current" />} Start Quiz
                                            </button>
                                        </div>
                                    )
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="p-6 flex flex-col items-center justify-center bg-gray-50/50">
                            <HelpCircle className="w-8 h-8 text-gray-300 mb-2" />
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">No Quiz Generated</p>
                            {!isReadOnly && (
                                <button 
                                    onClick={(e) => handleRegenerateQuiz(e)} 
                                    className={`px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold uppercase tracking-widest transition shadow-sm flex items-center ${canUsePremiumFeatures && !canUsePremiumFeatures('Quizzes', true) ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'}`}
                                >
                                    {isRegenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : (canUsePremiumFeatures && !canUsePremiumFeatures('Quizzes', true) ? <LockIcon className="w-3.5 h-3.5 mr-2" /> : <PlusCircle className="w-3.5 h-3.5 mr-2" />)}
                                    Generate Quiz
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* File Attachments Grid - Removed Chat Button per spec */}
                <div className="mb-6" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center"><FileText className="w-3 h-3 mr-2" /> Attached Assets</h4>
                    </div>
                    
                    <div className="flex gap-3 overflow-x-auto pb-2">
                        {note.userFiles && note.userFiles.map((file, idx) => (
                            <div 
                                key={idx} 
                                onClick={(e) => { e.stopPropagation(); if (!canUsePremiumFeatures || canUsePremiumFeatures('Chat')) onOpenChat && onOpenChat(idx); }} 
                                className="relative group/file w-24 h-24 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex-shrink-0 cursor-pointer hover:border-blue-400 transition-colors"
                            >
                                {file.startsWith('data:image') ? (
                                    <img src={file} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400"><FileText className="w-8 h-8" /></div>
                                )}
                                {/* Removed individual chat/view buttons to enforce the One Button rule */}
                                {!isReadOnly && (
                                    <button onClick={(e) => { e.stopPropagation(); removeFile(idx); }} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full transition-opacity"><X className="w-3 h-3" /></button>
                                )}
                            </div>
                        ))}
                        {!isReadOnly && (
                            <div 
                                onClick={(e) => {e.stopPropagation(); fileInputRef.current?.click()}}
                                className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-all cursor-pointer flex-shrink-0 group/add"
                            >
                                <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center mb-1 transition-transform">
                                    <Plus className="w-4 h-4 text-gray-400 transition-colors" />
                                </div>
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider transition-colors">Add</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Reflection Area - FIX 2: Removed Upload Button */}
                <div className="mb-8" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center">
                            <MessageSquare className="w-3 h-3 mr-2" /> My Synthesis
                        </h4>
                        {isSavingReflection && <span className="text-[9px] font-bold text-gray-400 animate-pulse">Saving...</span>}
                    </div>
                    <div className="relative">
                        <textarea 
                            value={reflection}
                            onChange={handleReflectionChange}
                            onBlur={saveReflection}
                            onClick={(e) => e.stopPropagation()}
                            onWheel={(e) => e.stopPropagation()} // FIX 3: Stop scroll bubbling
                            placeholder={t("Add your own thoughts, connections, or synthesis here...", getSystemLanguage())}
                            className="w-full p-4 rounded-xl bg-white/50 border-none focus:ring-2 focus:ring-gray-200 text-sm text-gray-700 min-h-[100px] resize-y placeholder-gray-400 transition-shadow"
                            disabled={isReadOnly}
                        />
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple accept="image/*,application/pdf" />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end pt-4 border-t border-black/5">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
                        className="text-xs font-bold text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-widest"
                    >
                        Close Card
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};
