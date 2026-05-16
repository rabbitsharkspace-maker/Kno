import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { Key } from 'lucide-react';
import { getLocaleString, t } from '../src/i18n';
import { getSystemLanguage } from '../services/geminiService';
import { loadAllFromStorage } from '../services/storage';

interface ProfileScreenProps {
  userProfile: UserProfile | null;
  onClose: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  userProfile,
  onClose
}) => {
  const [apiKey, setApiKey] = useState(userProfile?.customApiKey || localStorage.getItem('customApiKey') || '');
  const [openaiKey, setOpenaiKey] = useState(userProfile?.openaiApiKey || localStorage.getItem('openaiApiKey') || '');
  const [anthropicKey, setAnthropicKey] = useState(userProfile?.anthropicApiKey || localStorage.getItem('anthropicApiKey') || '');
  const [nvidiaKey, setNvidiaKey] = useState(userProfile?.nvidiaApiKey || localStorage.getItem('nvidiaApiKey') || '');
  const [selectedProvider, setSelectedProvider] = useState(userProfile?.selectedAiProvider || localStorage.getItem('selectedAiProvider') || 'gemini');

  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  useEffect(() => {
    if (userProfile || localStorage) {
      setApiKey(localStorage.getItem('customApiKey') || '');
      setOpenaiKey(localStorage.getItem('openaiApiKey') || '');
      setAnthropicKey(localStorage.getItem('anthropicApiKey') || '');
      setNvidiaKey(localStorage.getItem('nvidiaApiKey') || '');
      setSelectedProvider(localStorage.getItem('selectedAiProvider') || 'gemini');
    }
  }, [userProfile]);

  const handleSaveApiKey = async () => {
    setIsSavingKey(true);
    try {
      localStorage.setItem('customApiKey', apiKey);
      localStorage.setItem('openaiApiKey', openaiKey);
      localStorage.setItem('anthropicApiKey', anthropicKey);
      localStorage.setItem('nvidiaApiKey', nvidiaKey);
      localStorage.setItem('selectedAiProvider', selectedProvider);
      
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 3000);
      
      // Reload to apply the local keys globally across the app instance
      window.location.reload();
    } catch (error) {
      console.error("Error saving API key:", error);
      alert("Failed to save API key completely to local storage. Check permissions.");
    } finally {
      setIsSavingKey(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
        <div className="p-4 md:p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-gray-900">App Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <div className="p-4 md:p-6 space-y-5 overflow-y-auto">
          {/* API Key Input */}
          <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200">
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-zinc-600" />
              <span className="text-sm font-semibold text-zinc-900">AI Provider & API Keys</span>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              Kno relies exclusively on your personal API keys for 100% privacy. Everything is processed and stored locally on your device.
            </p>
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-700">Select Primary AI Provider</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="gemini">Google Gemini (Recommended)</option>
                  <option value="openai">OpenAI (ChatGPT/GPT-4o)</option>
                  <option value="anthropic">Anthropic (Claude 3.5)</option>
                  <option value="nvidia">Nvidia NIM (Llama 3.1 405B)</option>
                </select>
              </div>

              {selectedProvider === 'gemini' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-700">Gemini API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste your Gemini key..."
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              
              {(selectedProvider === 'openai' || selectedProvider === 'gemini') && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-700">OpenAI API Key (Used for images & GPT)</label>
                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="Paste your OpenAI key..."
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {selectedProvider === 'anthropic' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-700">Anthropic API Key</label>
                  <input
                    type="password"
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="Paste your Anthropic key..."
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {selectedProvider === 'nvidia' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-700">Nvidia NIM API Key</label>
                  <input
                    type="password"
                    value={nvidiaKey}
                    onChange={(e) => setNvidiaKey(e.target.value)}
                    placeholder="Paste your Nvidia key..."
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <button
                onClick={handleSaveApiKey}
                disabled={isSavingKey}
                className="w-full px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors mt-2"
              >
                {isSavingKey ? 'Saving...' : keySaved ? 'Saved!' : 'Save Settings'}
              </button>
            </div>
          </div>

          {/* System Language Settings */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              <span className="text-sm font-semibold text-gray-900">System Language</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Choose the language for AI-generated summaries, quizzes, and responses.
            </p>
            <select
              value={userProfile?.language || localStorage.getItem('system_language') || 'English'}
              onChange={async (e) => {
                const newLang = e.target.value;
                localStorage.setItem('system_language', newLang);
                window.location.reload();
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
            >
              <option value="English">English</option>
              <option value="Chinese">中文 (Chinese)</option>
              <option value="Spanish">Español (Spanish)</option>
              <option value="French">Français (French)</option>
              <option value="German">Deutsch (German)</option>
              <option value="Japanese">日本語 (Japanese)</option>
              <option value="Korean">한국어 (Korean)</option>
            </select>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <button 
              onClick={async () => {
                const keys = ['kno_inbox', 'kno_library', 'kno_folders', 'kno_themes', 'kno_canvases'];
                const results = await loadAllFromStorage(keys);
                const data = {
                  inbox: results['kno_inbox'] || [],
                  library: results['kno_library'] || [],
                  folders: results['kno_folders'] || [],
                  themes: results['kno_themes'] || [],
                  canvases: results['kno_canvases'] || [],
                };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `kno_export_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="w-full py-2.5 px-4 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Export All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
