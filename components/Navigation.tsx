
import React from 'react';
import { Layers, Brain, Map, BrainCircuit } from 'lucide-react';
import { ViewState, AppTheme } from '../types';
import { KnoLogo } from './Logos';
import { t } from '../src/i18n';
import { getSystemLanguage } from '../services/geminiService';

interface NavigationProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  theme: AppTheme;
  notificationCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, onChangeView, theme, notificationCount }) => {
  let activeColor = '';
  switch(theme) {
      case AppTheme.MINIMAL: activeColor = 'text-gray-900'; break;
      case AppTheme.SERENITY: activeColor = 'text-green-700'; break;
      case AppTheme.EMBER: activeColor = 'text-red-600'; break;
      case AppTheme.BREEZE: activeColor = 'text-sky-700'; break;
      case AppTheme.LAVENDER: activeColor = 'text-purple-600'; break;
  }

  const NavItem = ({ view, icon: Icon, label, description }: { view: ViewState, icon: any, label: string, description: string }) => {
    const isActive = currentView === view;
    const showBadge = view === 'triage' && notificationCount > 0;

    return (
      <button 
        onClick={() => onChangeView(view)}
        title={description}
        className={`relative flex items-center justify-center md:justify-center lg:justify-start w-full md:w-auto transition-all duration-300 group flex-col md:flex-row md:px-4 md:py-3 md:mx-2 md:rounded-xl md:hover:bg-gray-100 ${isActive ? 'md:bg-gray-100' : 'opacity-50 hover:opacity-100'}`}
      >
        <div className={`relative p-2 rounded-2xl md:bg-transparent md:p-0 md:mr-3 ${isActive ? `${activeColor} bg-white shadow-soft md:shadow-none` : ''}`}>
            <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
            {showBadge && (
                <span className="lg:hidden absolute top-1 right-1 md:-top-1 md:-right-1 flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeColor.replace('text-', 'bg-')}`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${activeColor.replace('text-', 'bg-')}`}></span>
                </span>
            )}
        </div>
        <span className={`text-xs md:text-sm font-bold hidden lg:block ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
            {label}
        </span>
        {isActive && (
            <div className={`hidden md:block absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full ${activeColor.replace('text-', 'bg-')}`}></div>
        )}
      </button>
    );
  };

  return (
    <nav className="fixed z-30 transition-all duration-300 bottom-6 left-6 right-6 h-20 bg-white/90 backdrop-blur-xl rounded-3xl shadow-glow border border-white/50 flex justify-around items-center px-2 md:top-0 md:left-0 md:bottom-0 md:h-full md:w-20 lg:w-64 md:rounded-none md:border-r md:border-gray-200/50 md:flex-col md:justify-start md:items-stretch md:pt-8 md:space-y-2 md:bg-white/80">
      <div className="hidden md:flex items-center justify-center lg:justify-start w-full mb-8 lg:px-6">
        <div className="w-10 h-10 bg-white border border-gray-100 rounded-xl flex items-center justify-center shadow-soft mr-0 lg:mr-3 transform rotate-3 hover:rotate-6 transition-transform">
            <KnoLogo className="w-6 h-6 text-gray-900" />
        </div>
        <span className="hidden lg:block font-bold text-2xl tracking-tight text-gray-900">Kno</span>
      </div>
      <NavItem view="triage" icon={Layers} label={t("Inbox", getSystemLanguage())} description={t("Capture and process incoming signals", getSystemLanguage())} />
      <NavItem view="library" icon={Brain} label={t("Brain", getSystemLanguage())} description={t("Browse your knowledge library", getSystemLanguage())} />
      <NavItem view="memory" icon={BrainCircuit} label={t("Memory", getSystemLanguage())} description={t("Analyze retention and health", getSystemLanguage())} />
      <NavItem view="canvas" icon={Map} label={t("Canvas", getSystemLanguage())} description={t("Spatial thinking and synthesis", getSystemLanguage())} />
    </nav>
  );
};
