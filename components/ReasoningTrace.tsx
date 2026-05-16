import React, { useState, useEffect, useMemo } from 'react';

export const ReasoningTrace: React.FC<{ title: string; platform: string; type?: 'triage' | 'synthesis' | 'forensic' | 'course'; isFinished?: boolean; thinking?: string }> = ({ title, platform = 'triage', isFinished = false, thinking }) => {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  
  const baseSequence = useMemo(() => [
    `> [SYSTEM_INIT] Loading Neural Distillation Engine...`,
    `> Identifying signal from ${platform} stream...`,
    `> Parsing semantic structure of "${(title || "Unknown").substring(0, 32)}..."`,
    `> Extracting high-signal takeaways...`,
    `> Filtering redundant noise clusters...`,
    `> Mapping context to Global Brain Graph...`,
  ], [title, platform]);

  const loopSequence = useMemo(() => [
    `> Re-evaluating semantic density...`,
    `> Cross-referencing internal knowledge nodes...`,
    `> Optimizing retention pathways...`,
    `> Synthesizing key insights...`,
    `> Verifying factual consistency...`
  ], []);

  useEffect(() => {
    if (thinking) {
        // If we have actual thinking text, just show it
        const lines = thinking.split('\n').filter(l => l.trim().length > 0);
        setVisibleLines(lines.slice(-8)); // Show last 8 lines
        return;
    }

    let currentIdx = 0;
    let loopIdx = 0;
    let timeoutId: any;
    let mounted = true;

    const addLine = () => {
      if (!mounted) return;

      if (currentIdx < baseSequence.length) {
        setVisibleLines(prev => [...prev, baseSequence[currentIdx]]);
        currentIdx++;
        timeoutId = setTimeout(addLine, Math.random() * 600 + 400);
      } else if (!isFinished) {
        setVisibleLines(prev => {
            const next = [...prev];
            if (next.length > 8) next.shift(); 
            next.push(loopSequence[loopIdx % loopSequence.length]);
            return next;
        });
        loopIdx++;
        timeoutId = setTimeout(addLine, 1500);
      } else {
        setVisibleLines(prev => [...prev, `> [DONE] Internalization signal ready.`]);
      }
    };

    addLine();

    return () => {
        mounted = false;
        clearTimeout(timeoutId);
    };
  }, [baseSequence, loopSequence, isFinished, thinking]);

  return (
    <div className="space-y-2 font-mono text-[10px] leading-relaxed text-[#00FF41] min-h-[160px] flex flex-col justify-end">
      {visibleLines.map((line, idx) => (
        <div key={idx} className="flex items-start animate-fade-in">
          <span className="opacity-90">{line}</span>
        </div>
      ))}
      {!isFinished && (
          <div className="flex items-center">
              <span className="inline-block w-1.5 h-3 bg-[#00FF41] ml-1 animate-pulse" />
          </div>
      )}
    </div>
  );
};
