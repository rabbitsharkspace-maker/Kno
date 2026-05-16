
import React, { useMemo, useState } from 'react';
import { DailyActivity, AppTheme } from '../types';
import { getLocaleString } from '../src/i18n';
import { getSystemLanguage } from '../services/geminiService';

interface HeatmapProps {
  data: DailyActivity[];
  theme: AppTheme;
  endDate?: Date;
  onDayClick?: (date: Date) => void; // New callback prop
}

export const Heatmap: React.FC<HeatmapProps> = ({ data, theme, endDate, onDayClick }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Helper to get local date string YYYY-MM-DD
  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Generate last 7 days data based on endDate (defaults to today)
  const chartData = useMemo(() => {
    const days = [];
    const referenceDate = endDate ? new Date(endDate) : new Date();
    
    // Create array for last 7 days relative to referenceDate
    for (let i = 6; i >= 0; i--) {
      const d = new Date(referenceDate);
      d.setDate(referenceDate.getDate() - i);
      const dateStr = getLocalDateString(d);
      const activity = data.find(x => x.date === dateStr);
      
      days.push({
        dayName: d.toLocaleDateString(getLocaleString(getSystemLanguage()), { weekday: 'short' }),
        fullDate: d.toLocaleDateString(getLocaleString(getSystemLanguage()), { weekday: 'long', month: 'long', day: 'numeric' }),
        dateObject: d, // Pass full date object for click handler
        value: activity ? activity.count : 0
      });
    }
    return days;
  }, [data, endDate]);

  const maxVal = Math.max(...chartData.map(d => d.value), 5); // Minimum scale of 5

  const getThemeColor = () => {
    switch (theme) {
      case AppTheme.SERENITY: return '#16a34a'; // green-600
      case AppTheme.EMBER: return '#dc2626'; // red-600
      case AppTheme.BREEZE: return '#0284c7'; // sky-600
      case AppTheme.LAVENDER: return '#9333ea'; // purple-600
      case AppTheme.MINIMAL: 
      default: return '#1f2937'; // gray-800
    }
  };

  const getBarColor = (isHovered: boolean, hasData: boolean) => {
    // 1. Hover State: Always vibrant theme color
    if (isHovered) {
        return getThemeColor();
    }
    
    // 2. Idle State with Data: Neutral Grey
    if (hasData) {
        return '#9ca3af'; // gray-400
    }
    
    // 3. Idle State Empty: Light placeholder
    return '#f3f4f6'; // gray-100
  };

  return (
    <div 
      className="w-full h-32 flex items-end justify-between px-2 space-x-2 md:space-x-4"
      onMouseLeave={() => setHoveredIndex(null)} // Safety clear to prevent stuck bars
    >
      {chartData.map((d, i) => {
        // Calculate height percentage (min 10% for visibility of 0 values)
        const heightPct = d.value === 0 ? 10 : Math.max((d.value / maxVal) * 100, 15);
        const isHovered = hoveredIndex === i;
        const hasData = d.value > 0;
        const barColor = getBarColor(isHovered, hasData);
        
        return (
          <div 
            key={i} 
            className="flex-1 flex flex-col items-center group relative h-full justify-end cursor-pointer"
            onMouseEnter={() => setHoveredIndex(i)}
            onClick={() => onDayClick && onDayClick(d.dateObject)}
          >
            {/* Tooltip */}
            <div 
                className={`absolute -top-14 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] py-2 px-3 rounded-xl pointer-events-none whitespace-nowrap z-30 shadow-xl transition-all duration-200 ease-out transform origin-bottom ${isHovered ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'}`}
            >
               <div className="font-bold text-xs mb-0.5">{d.fullDate}</div>
               <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getThemeColor() }}></span>
                  <span className="text-gray-300 font-medium">{d.value} Knowledge Points</span>
               </div>
               <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
            </div>

            {/* Bar */}
            <div 
                className="w-full rounded-lg transition-all duration-200 ease-out min-w-[8px] relative overflow-hidden"
                style={{ 
                  height: `${heightPct}%`, 
                  backgroundColor: barColor,
                  boxShadow: isHovered ? `0 0 10px ${barColor}40` : 'none'
                }}
            >
                {/* Subtle shine effect on hover */}
                {isHovered && (
                    <div className="absolute inset-0 bg-white opacity-10"></div>
                )}
            </div>
            
            {/* Label */}
            <span 
                className={`text-[10px] font-bold mt-2 uppercase tracking-wider transition-colors duration-200 ${isHovered ? 'text-gray-900' : 'text-gray-400'}`}
                style={{ color: isHovered ? getThemeColor() : undefined }}
            >
                {d.dayName}
            </span>
          </div>
        );
      })}
    </div>
  );
};
