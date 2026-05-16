
import React, { useState } from 'react';
import { ArrowRight, Zap, Brain, Sparkles, Layers, Mic, ShieldCheck, FlaskConical, Database, Inbox, BrainCircuit, MousePointer2, Plus, LayoutGrid, Shield, Download, HardDrive, FileOutput, MessageSquare, X } from 'lucide-react';
import { KnoLogo } from './Logos';
import { t } from '../src/i18n';
import { getSystemLanguage } from '../services/geminiService';

interface WelcomeScreenProps {
  onEnter: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onEnter }) => {
  const [activePolicy, setActivePolicy] = useState<'terms' | 'privacy' | 'refund' | null>(null);

  return (
    <div className="fixed inset-0 bg-white z-[100] animate-fade-in selection:bg-black selection:text-white font-sans overflow-y-auto">
      {/* Top Navigation */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-50">
        <div className="flex items-center gap-2">
          <KnoLogo className="w-6 h-6 text-gray-900" />
          <span className="font-bold text-lg tracking-tight">Kno</span>
        </div>
      </div>

      <div className="flex min-h-full items-center justify-center p-8 relative overflow-hidden">
        {/* Background Floating Elements */}
        <div className="absolute inset-0 pointer-events-none z-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl aspect-square bg-blue-500 blur-[120px] opacity-10 rounded-full animate-pulse-slow"></div>
            
            {/* Scattered Toolbar Icons - Evenly Distributed in a Circle */}
            {[
                { Icon: Inbox, color: 'text-purple-500', desc: t('Inbox: Capture everything', getSystemLanguage()), angle: -90 },
                { Icon: Database, color: 'text-amber-500', desc: t('Library: Stored knowledge', getSystemLanguage()), angle: -60 },
                { Icon: Brain, color: 'text-pink-500', desc: t('Brain: Knowledge Graph', getSystemLanguage()), angle: -30 },
                { Icon: Mic, color: 'text-red-500', desc: t('Neural Dump: Voice capture', getSystemLanguage()), angle: 0 },
                { Icon: MousePointer2, color: 'text-gray-700', desc: t('Interact: Select & move', getSystemLanguage()), angle: 30 },
                { Icon: LayoutGrid, color: 'text-gray-700', desc: t('Arrange: Organize canvas', getSystemLanguage()), angle: 60 },
                { Icon: Shield, color: 'text-red-500', desc: t('Logic Guard: Verify facts', getSystemLanguage()), angle: 90 },
                { Icon: Sparkles, color: 'text-yellow-500 fill-current', desc: t('Spark: AI Assistance', getSystemLanguage()), angle: 120 },
                { Icon: FlaskConical, color: 'text-emerald-500', desc: t('Alchemy: Synthesize ideas', getSystemLanguage()), angle: 150 },
                { Icon: Zap, color: 'text-purple-500 fill-current', desc: t('Collider: Merge concepts', getSystemLanguage()), angle: 180 },
                { Icon: Plus, color: 'text-gray-700', desc: t('New Note: Create from scratch', getSystemLanguage()), angle: 210 },
                { Icon: BrainCircuit, color: 'text-blue-600', desc: t('Memory Lab: Connect ideas', getSystemLanguage()), angle: 240 }
            ].map((item, i) => {
                const radiusX = 38;
                const radiusY = 32;
                const left = 50 + Math.cos(item.angle * Math.PI / 180) * radiusX;
                const top = 50 + Math.sin(item.angle * Math.PI / 180) * radiusY;
                const delay = (i * 0.4).toFixed(1);
                return (
                    <div key={i} className="absolute animate-float group pointer-events-auto cursor-help" style={{ top: `${top}%`, left: `${left}%`, transform: 'translate(-50%, -50%)', animationDelay: `${delay}s` }}>
                        <div className="transition-transform duration-500">
                            <item.Icon className={`w-10 h-10 md:w-12 md:h-12 ${item.color}`} strokeWidth={1.5} />
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 px-4 py-2 bg-gray-900/95 backdrop-blur-sm text-white text-sm font-medium rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap z-[100] shadow-xl pointer-events-none transform group-hover:translate-y-0 -translate-y-2">
                            {item.desc}
                        </div>
                    </div>
                );
            })}
        </div>

        <div className="max-w-2xl w-full text-center flex flex-col items-center z-10 my-16 mt-32">
        
        {/* Typography */}
        <div className="space-y-4 mb-16">
            <h1 className="text-8xl md:text-[120px] font-black tracking-tighter text-[#111827] leading-none">
            Kno.
            </h1>
            <div className="flex flex-col items-center space-y-2">
              <p className="text-3xl md:text-4xl font-bold text-[#9CA3AF] tracking-tight">
                {t('From Feed to Knowledge.', getSystemLanguage())}
              </p>
            </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col items-center space-y-8 w-full max-w-4xl mx-auto z-10 px-4">
            <div className="flex flex-wrap items-center justify-center gap-4 w-full">
                <button 
                    onClick={onEnter}
                    className="group relative inline-flex items-center justify-center px-8 py-4 bg-black text-white rounded-full font-bold text-sm uppercase tracking-widest active:scale-95 transition-all shadow-xl overflow-hidden"
                >
                    <span className="relative z-10 flex items-center">
                        {t('OPEN APP', getSystemLanguage())} <ArrowRight className="w-4 h-4 ml-3 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <div className="absolute inset-0 bg-gray-800 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
                </button>
            </div>

            {/* Sync Info */}
            <div className="flex items-center justify-center gap-6 text-xs font-medium text-gray-500 mt-4">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>{t('100% Local-First & Offline', getSystemLanguage())}</span>
                </div>
                <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-gray-400" />
                    <span>{t('Your Data, Your Device', getSystemLanguage())}</span>
                </div>
                <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>{t('BYOK: Bring Your Own API Key', getSystemLanguage())}</span>
                </div>
            </div>
        </div>
      </div>
      </div>

      {/* Feature Showcase */}
      <div className="max-w-7xl mx-auto px-8 py-24 border-t border-gray-100 bg-white relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-black tracking-tight text-gray-900 mb-4">{t('Everything you need to know.', getSystemLanguage())}</h2>
          <p className="text-lg text-gray-500 font-medium max-w-2xl mx-auto">
            {t('Kno is a complete AI knowledge internalization engine. Capture content, distill wisdom, and build your personal knowledge graph.', getSystemLanguage())}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          
          <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 hover:border-gray-200 transition-colors">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 text-purple-600">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-xl text-gray-900 mb-3">{t('Inbox', getSystemLanguage())}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{t('Upload files or paste links. Kno automatically generates a comprehensive summary and a multi-choice quiz for every source.', getSystemLanguage())}</p>
          </div>

          <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 hover:border-gray-200 transition-colors">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 text-amber-600">
              <Database className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-xl text-gray-900 mb-3">{t('Library', getSystemLanguage())}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{t('Your organized repository. Group sources into custom Folders and Themes with personalized colors and names.', getSystemLanguage())}</p>
          </div>

          <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 hover:border-gray-200 transition-colors">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 text-pink-600">
              <Brain className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-xl text-gray-900 mb-3">{t('Brain', getSystemLanguage())}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{t('The core knowledge hub. Access summaries, personal thoughts, quiz history, and linked files for every source in your network.', getSystemLanguage())}</p>
          </div>

          <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 hover:border-gray-200 transition-colors">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 text-blue-600">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-xl text-gray-900 mb-3">{t('Memory', getSystemLanguage())}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{t('Track your learning. Monitor quiz scores, identify topics to review, and view a timeline of when you acquired knowledge.', getSystemLanguage())}</p>
          </div>

          <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 hover:border-gray-200 transition-colors">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 text-emerald-600">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-xl text-gray-900 mb-3">{t('Neural Dump', getSystemLanguage())}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{t('Your whiteboard housekeeper. Generate images, learning paths, and structured content instantly from selected sources.', getSystemLanguage())}</p>
          </div>

          <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 hover:border-gray-200 transition-colors">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 text-gray-700">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-xl text-gray-900 mb-3">{t('Arrange', getSystemLanguage())}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{t('Instantly tidy your workspace. Automatically snap sources to a grid or group them into intelligent themes.', getSystemLanguage())}</p>
          </div>

          <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 hover:border-gray-200 transition-colors">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 text-purple-600">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <h3 className="font-bold text-xl text-gray-900 mb-3">{t('Collider', getSystemLanguage())}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{t('Compare multiple sources to highlight differing opinions, contradictions, and contrasting viewpoints.', getSystemLanguage())}</p>
          </div>

          <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 hover:border-gray-200 transition-colors">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 text-emerald-500">
              <FlaskConical className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-xl text-gray-900 mb-3">{t('Alchemy', getSystemLanguage())}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{t('Synthesize two or more sources to forge entirely new perspectives, ideas, and connections.', getSystemLanguage())}</p>
          </div>

          <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 hover:border-gray-200 transition-colors">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 text-yellow-500">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-xl text-gray-900 mb-3">{t('Spark', getSystemLanguage())}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{t('The knowledge matchmaker. Automatically discover and connect a source to other potentially related sources in your library.', getSystemLanguage())}</p>
          </div>

          <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 hover:border-gray-200 transition-colors">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 text-red-500">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-xl text-gray-900 mb-3">{t('Logic Guard', getSystemLanguage())}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{t('Scan sources to verify factual accuracy, cognitive balance, and logical integrity before trusting the information.', getSystemLanguage())}</p>
          </div>

          <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 hover:border-gray-200 transition-colors">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 text-blue-500">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-xl text-gray-900 mb-3">{t('Ko Assistant', getSystemLanguage())}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{t('Your AI whiteboard secretary. Ask questions about any source and save the insights directly alongside your notes.', getSystemLanguage())}</p>
          </div>

          <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 hover:border-gray-200 transition-colors">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 text-gray-800">
              <FileOutput className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-xl text-gray-900 mb-3">{t('Export', getSystemLanguage())}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{t('Take your knowledge anywhere. Export your entire whiteboard to Markdown or PDF for easy sharing and backup.', getSystemLanguage())}</p>
          </div>

        </div>
      </div>
      
      {/* Background Texture */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
      
      {/* Footer with Policies */}
      <footer className="relative z-10 border-t border-gray-100 bg-white py-8 w-full mt-auto">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Kno. All rights reserved.
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm font-medium text-gray-600">
            <button onClick={() => setActivePolicy('terms')} className="hover:text-black transition-colors bg-transparent border-none p-0 cursor-pointer">Terms of Service</button>
            <button onClick={() => setActivePolicy('privacy')} className="hover:text-black transition-colors bg-transparent border-none p-0 cursor-pointer">Privacy Policy</button>
            <button onClick={() => setActivePolicy('refund')} className="hover:text-black transition-colors bg-transparent border-none p-0 cursor-pointer">Refund Policy</button>
          </div>
        </div>
      </footer>

      {activePolicy && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setActivePolicy(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-8 relative" onClick={(e) => e.stopPropagation()}>
             <button onClick={() => setActivePolicy(null)} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer border-none bg-transparent">
               <X className="w-5 h-5 text-gray-500" />
             </button>
             <h2 className="text-2xl font-bold mb-6 text-gray-900">
               {activePolicy === 'terms' && 'Terms of Service'}
               {activePolicy === 'privacy' && 'Privacy Policy'}
               {activePolicy === 'refund' && 'Refund Policy'}
             </h2>
             <div className="prose prose-sm text-gray-600 space-y-4">
               {activePolicy === 'terms' && (
                 <>
                   <p>Welcome to Kno. By using our application, you agree to these terms.</p>
                   <h3 className="font-bold text-gray-900 text-lg mt-6 mb-2">1. Acceptance of Terms</h3>
                   <p>By accessing and using Kno, you accept and agree to be bound by the terms and provision of this agreement.</p>
                   <h3 className="font-bold text-gray-900 text-lg mt-6 mb-2">2. Description of Service</h3>
                   <p>Kno is a spatial knowledge OS that allows users to organize and connect information.</p>
                   <h3 className="font-bold text-gray-900 text-lg mt-6 mb-2">3. User Constraints</h3>
                   <p>Users must not use the service for any illegal or unauthorized purpose.</p>
                   <h3 className="font-bold text-gray-900 text-lg mt-6 mb-2">4. Modifications to Service</h3>
                   <p>We reserve the right to modify or discontinue, temporarily or permanently, the service with or without notice.</p>
                 </>
               )}
               {activePolicy === 'privacy' && (
                 <>
                   <p>Your privacy is important to us. It is Kno's policy to respect your privacy regarding any information we may collect from you across our website and application.</p>
                   <h3 className="font-bold text-gray-900 text-lg mt-6 mb-2">1. Information we collect</h3>
                   <p>We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent.</p>
                   <h3 className="font-bold text-gray-900 text-lg mt-6 mb-2">2. Use of Information</h3>
                   <p>We use the information we collect in various ways, including to provide, operate, and maintain our application.</p>
                   <h3 className="font-bold text-gray-900 text-lg mt-6 mb-2">3. Data Storage</h3>
                   <p>Your data is stored locally on your device and synced securely if you opt into cloud features.</p>
                 </>
               )}
               {activePolicy === 'refund' && (
                 <>
                   <p>Thanks for purchasing our products at Kno.</p>
                   <h3 className="font-bold text-gray-900 text-lg mt-6 mb-2">1. Eligibility for Refunds</h3>
                   <p>We offer a full money-back guarantee for all purchases made on our website. If you are not satisfied with the product that you have purchased from us, you can get your money back no questions asked.</p>
                   <h3 className="font-bold text-gray-900 text-lg mt-6 mb-2">2. Timeframe</h3>
                   <p>You are eligible for a full reimbursement within 14 calendar days of your purchase.</p>
                   <h3 className="font-bold text-gray-900 text-lg mt-6 mb-2">3. Process</h3>
                   <p>After the 14-day period, you will no longer be eligible and won't be able to receive a refund. If you have any additional questions, feel free to contact us.</p>
                 </>
               )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
