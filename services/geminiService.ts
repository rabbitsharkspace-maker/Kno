
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { YoutubeTranscript } from 'youtube-transcript';
import { InboxItem, Note, ProcessingOptions, Platform, QuizQuestion, CanvasNode, RetentionSummary, CanvasEdge } from "../types";

export const getSystemLanguage = () => {
    return localStorage.getItem('system_language') || 'English';
};

let customApiKey: string | undefined;
let openaiApiKey: string | undefined;
let anthropicApiKey: string | undefined;
let nvidiaApiKey: string | undefined;
let selectedProvider: string = 'gemini';

export const setCustomApiKey = (key?: string) => {
    customApiKey = key;
};

export const setOpenaiApiKey = (key?: string) => {
    openaiApiKey = key;
};

export const setApiKeysAndProvider = (keys: { gemini?: string, openai?: string, anthropic?: string, nvidia?: string, provider?: string }) => {
    customApiKey = keys.gemini;
    openaiApiKey = keys.openai;
    anthropicApiKey = keys.anthropic;
    nvidiaApiKey = keys.nvidia;
    selectedProvider = keys.provider || 'gemini';
};

export const getOpenaiApiKey = () => {
    return openaiApiKey;
};

export const getModel = (_feature: 'LogicGuard' | 'General' = 'General') => {
    if (selectedProvider === 'openai') return 'gpt-4o';
    if (selectedProvider === 'anthropic') return 'claude-3-5-sonnet-20241022';
    if (selectedProvider === 'nvidia') return 'meta/llama-3.1-405b-instruct';
    return 'gemini-2.0-flash';
};

// Unified REST interface simulating GoogleGenAI
class UnifiedAIClient {
    apiKey: string;
    provider: string;
    
    constructor(provider: string, apiKey: string) {
        this.provider = provider;
        this.apiKey = apiKey;
    }

    private convertContents(contents: any): any[] {
        let messages = [];
        let systemPrompt = "";

        if (typeof contents === 'string') {
            messages.push({ role: 'user', content: contents });
        } else if (Array.isArray(contents)) {
             // Chat format: [{ role: 'user', parts: [{text: ""}] }]
             for (const item of contents) {
                 let combinedText = item.parts?.map((p:any) => p.text || '').join('\n') || '';
                 messages.push({ role: item.role === 'model' ? 'assistant' : 'user', content: combinedText });
             }
        } else if (contents.parts) {
             let combinedText = contents.parts.map((p:any) => p.text || '').join('\n');
             messages.push({ role: 'user', content: combinedText });
        }
        return messages;
    }

    models = {
        generateContent: async (params: any) => {
            if (this.provider === 'gemini') {
                const client = new GoogleGenAI({ apiKey: this.apiKey });
                return client.models.generateContent(params);
            }

            const messages = this.convertContents(params.contents);
            const isJson = params.config?.responseMimeType === 'application/json';

            if (this.provider === 'openai' || this.provider === 'nvidia') {
                const endpoint = this.provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://integrate.api.nvidia.com/v1/chat/completions';
                const body: any = {
                    model: params.model || getModel(),
                    messages: messages,
                };
                if (isJson && this.provider === 'openai') {
                    body.response_format = { type: "json_object" };
                }

                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify(body)
                });
                
                if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
                const data = await res.json();
                const text = data.choices[0]?.message?.content || "";
                return { text };
            }

            if (this.provider === 'anthropic') {
                let systemPrompt = "You are a helpful assistant.";
                let anthropicMessages = messages;
                
                // Anthropic doesn't support forcing JSON via API type, just rely on prompt
                const res = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': this.apiKey,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerously-allow-browser': 'true'
                    },
                    body: JSON.stringify({
                        model: params.model || getModel(),
                        messages: anthropicMessages,
                        max_tokens: 4096,
                        system: systemPrompt
                    })
                });
                if (!res.ok) throw new Error(`Anthropic Error: ${res.statusText}`);
                const data = await res.json();
                return { text: data.content[0]?.text || "" };
            }
            return { text: "" };
        },

        generateContentStream: async function* (params: any) {
            if (this.provider === 'gemini') {
                const client = new GoogleGenAI({ apiKey: this.apiKey });
                yield* client.models.generateContentStream(params);
                return;
            }

            // Fallback for non-gemini: just call generateContent and yield it as one chunk
            const res = await this.generateContent(params);
            yield {
                candidates: [{
                    content: {
                        parts: [{ text: res.text }]
                    }
                }]
            };
        }
    }
}

export const getAI = () => {
    let keyToUse = '';
    
    // Load local config on the fly in case it was updated
    const localProvider = localStorage.getItem('selectedAiProvider') || selectedProvider || 'gemini';
    if (localProvider === 'openai') keyToUse = localStorage.getItem('openaiApiKey') || openaiApiKey || '';
    if (localProvider === 'anthropic') keyToUse = localStorage.getItem('anthropicApiKey') || anthropicApiKey || '';
    if (localProvider === 'nvidia') keyToUse = localStorage.getItem('nvidiaApiKey') || nvidiaApiKey || '';
    if (localProvider === 'gemini') keyToUse = localStorage.getItem('customApiKey') || customApiKey || process.env.GEMINI_API_KEY || '';

    if (!keyToUse) {
        throw new Error(`Please enter your ${localProvider} API key in your Profile to use AI features.`);
    }

    if (localProvider === 'gemini') {
        return new GoogleGenAI({ apiKey: keyToUse });
    }

    return new UnifiedAIClient(localProvider, keyToUse);
};

export const getImageAI = () => {
    let keyToUse = localStorage.getItem('openaiApiKey') || openaiApiKey || localStorage.getItem('customApiKey') || customApiKey || process.env.GEMINI_API_KEY;
    if (!keyToUse) {
        throw new Error("Please enter your Image API key or Gemini API key in your Profile to use image features.");
    }
    return new GoogleGenAI({ apiKey: keyToUse });
};

/**
 * Robust JSON parser that handles markdown blocks and deep nesting.
 */
const safeJsonParse = (text: string, context = "unknown") => {
    if (!text) return {};
    let cleaned = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch (e) {
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
            try { return JSON.parse(potentialJson); } catch (innerE) { 
                const errorMessage = innerE instanceof Error ? innerE.message : String(innerE);
                console.error(`[Ko JSON Parser] Deep parse failed for ${context}:`, errorMessage); 
            }
        }
        return {}; 
    }
};

/**
 * Utility for exponential backoff retries on rate-limited requests.
 */
const callWithRetry = async <T>(
    fn: () => Promise<T>,
    retries = 3,
    delay = 2000
): Promise<T> => {
    try {
        return await fn();
    } catch (error: any) {
        const isRateLimit = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
        if (isRateLimit && retries > 0) {
            console.warn(`[Ko API] Quota exhausted. Retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return callWithRetry(fn, retries - 1, delay * 2);
        }
        throw error;
    }
};

// --- CORE SERVICES ---

export const analyzeFallacy = async (text: string) => {
    const prompt = `
        Role: You are an adversarial logic engine (The Critic). 
        Today's date is ${new Date().toDateString()}. When analyzing content, use this date as your anchor for chronological verification.
        Your job is to rigorously analyze the input text for factual accuracy, cognitive balance (bias/blind spots), and logical integrity.
        
        Input: "${text.substring(0, 1000)}"
        
        Task: Perform a deep scan and return the results in a structured JSON format.
        
        Output JSON Structure:
        {
          "isSafe": boolean, // true if mostly verified/logic is sound, false if major issues found
          "issue": "String", // Short summary line (e.g. "Logical Fallacies Detected")
          "fix": "String", // Short action (e.g. "Verify sources manually")
          "confidence": "String", // e.g. "95%"
          "structuredAnalysis": {
             "factual": {
                "status": "Verified | Unverified Claim | Misleading | N/A",
                "issue": "Specific detail (e.g. '95% success rate' has no source) or 'None'"
             },
             "balance": {
                "status": "Balanced | Skewed | Echo Chamber | Nuanced",
                "check": "Identifies Bias (Confirmation, Survivorship) and Blind Spots."
             },
             "logic": {
                "status": "Sound | Fallacy Detected",
                "type": "Name of Fallacy (e.g. Survivorship Bias) or 'Solid' or 'Reframing Strategy'",
                "explanation": "Brief explanation of the logic gap or strength"
             }
          }
        }
    `;

    try {
      // HACKATHON NOTE: Using Gemini 3.1 Pro with Thinking Budget for deeper logical reasoning
      const result = await getAI().models.generateContent({
          model: getModel('LogicGuard'),
          contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`,
          config: { 
              responseMimeType: 'application/json',
              thinkingConfig: { thinkingBudget: 2048 } 
          }
      });
      
      const responseText = result.text || "{}";
      const parsed = safeJsonParse(responseText, "analyzeFallacy");

      // Validate Structure - If JSON parse succeeded and has structure, return it
      if (parsed.structuredAnalysis) {
          return parsed;
      }

      // --- FALLBACK PARSER FOR TEXT RESPONSES ---
      // Fixes the issue where Gemini returns formatted text instead of JSON
      console.warn("Falling back to Regex Parser for Critique");
      
      const extractSection = (regex: RegExp) => {
          const match = responseText.match(regex);
          return match ? match[1].trim() : "";
      };

      // Extract sections based on the "1. 🧪 FACTUAL ACCURACY" format often seen
      const factualStatus = extractSection(/FACTUAL ACCURACY[\s\S]*?Status:\s*(.*?)(?:\n|$)/i) || "Unknown";
      const factualIssue = extractSection(/FACTUAL ACCURACY[\s\S]*?(?:Note|Issue|Reason):\s*(.*?)(?:\n|$)/i) || "See analysis";
      
      const balanceStatus = extractSection(/COGNITIVE BALANCE[\s\S]*?Status:\s*(.*?)(?:\n|$)/i) || "Unknown";
      const balanceCheck = extractSection(/COGNITIVE BALANCE[\s\S]*?(?:Bias|Analysis|Check):\s*(.*?)(?:\n|$)/i) || "See analysis";
      
      const logicStatus = extractSection(/LOGICAL INTEGRITY[\s\S]*?Status:\s*(.*?)(?:\n|$)/i) || "Unknown";
      const logicType = extractSection(/LOGICAL INTEGRITY[\s\S]*?(?:Type|Verdict):\s*(.*?)(?:\n|$)/i) || "Analysis";
      const logicExpl = extractSection(/LOGICAL INTEGRITY[\s\S]*?(?:Verdict|Analysis|Explanation):\s*(.*?)(?:\n|$)/i) || "See analysis";

      // Heuristic for Safety: If any section mentions Fallacy, Skewed, or Misleading
      const isSafe = !responseText.toLowerCase().includes('fallacy detected') && 
                     !responseText.toLowerCase().includes('misleading') && 
                     !responseText.toLowerCase().includes('skewed') &&
                     !responseText.toLowerCase().includes('high risk');

      return {
          isSafe: isSafe,
          issue: isSafe ? "Logic Sound" : "Potential Issues Detected",
          fix: isSafe ? "None" : "Review highlighted sections",
          confidence: "Low (Parsed)",
          structuredAnalysis: {
              factual: { status: factualStatus, issue: factualIssue },
              balance: { status: balanceStatus, check: balanceCheck },
              logic: { status: logicStatus, type: logicType, explanation: logicExpl }
          }
      };

    } catch (e) {
      return { 
          issue: "Analysis Failed", 
          fix: "Manual check required.", 
          confidence: "0%", 
          isSafe: true,
          structuredAnalysis: {
              factual: { status: "Unknown", issue: "Analysis failed" },
              balance: { status: "Unknown", check: "Analysis failed" },
              logic: { status: "Unknown", type: "None", explanation: "Analysis failed" }
          }
      };
    }
};

export const transcribeHandwriting = async (base64Data: string, mimeType: string): Promise<string[]> => {
    const prompt = `
    ANALOG SIGNAL DETECTED.
    CRITICAL TASK: VERBATIM TRANSCRIPTION.
    You MUST extract the EXACT text written in the image.
    - IGNORE PREVIOUS CONTEXT.
    - Do not summarize.
    - Do not paraphrase.
    - Do not correct grammar.
    - Capture every single word visible.
    - If handwriting is illegible, write [ILLEGIBLE].
    `;

    try {
        const response = await callWithRetry<GenerateContentResponse>(() => getAI().models.generateContent({
            model: 'gemini-2.0-flash', 
            contents: {
                parts: [
                    { inlineData: { mimeType, data: base64Data } },
                    { text: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.` }
                ]
            }
        }));
        const text = response.text || "";
        return text.split('\n').filter(s => s.trim() !== '');
    } catch (e) {
        console.error("Transcription failed", e);
        return ["Error scanning image. Please try again."];
    }
};

export const analyzeMemoryRetention = async (library: Note[], onProgress?: (thinking: string) => void): Promise<RetentionSummary | null> => {
    if (!library || library.length === 0) return null;

    // 1. Create a definitive index of notes to prevent hallucinations
    const noteIndex = library.map(n => ({
        id: n.id,
        title: n.title, 
        created: new Date(n.createdAt).toISOString().split('T')[0]
    }));

    // 2. Map existing quiz history
    const quizHistory = library.flatMap(note => (note.quizAttempts || []).map(att => ({
        topic: note.title,
        noteId: note.id,
        score: att.score,
        total: att.totalQuestions,
        accuracy_pct: Math.round((att.score / (att.totalQuestions || 1)) * 100),
        date: new Date(att.timestamp).toISOString().split('T')[0]
    }))).slice(-30); 

    const prompt = `Cognitive Health Check:
    
    LIBRARY_INDEX (Valid Note IDs): 
    ${JSON.stringify(noteIndex)}

    QUIZ_HISTORY: 
    ${JSON.stringify(quizHistory)}

    TASK: 
    1. Predict forgetting curves for items in LIBRARY_INDEX.
    2. Calculate brain_score (0-100).
    3. Identify high-risk topics.

    CRITICAL RULES:
    - Output EXACTLY ONE prediction per noteId found in LIBRARY_INDEX.
    - DO NOT generate duplicate entries for the same noteId.
    - DO NOT hallucinate noteIds that are not in LIBRARY_INDEX.
    - USE SIMPLE, PLAIN ENGLISH. Do not use technical jargon like "encoding failure" or "impulsivity".
    - Instead say: "You haven't practiced this lately" or "You rushed through the last quiz".
    - If no quiz history exists for a note, estimate risk based on 'created' date (older = higher risk).

    OUTPUT JSON STRUCTURE:
    { 
      "predictions": [
        { "noteId": "...", "topic": "...", "risk_level": "high", "reason": "Short, clear reason...", "forgetting_probability": 0.8, "why_factors": ["Simple reason 1", "Simple reason 2"], "recommended_action": "Actionable advice", "days_since_reviewed": 5 }
      ], 
      "summary": { "brain_score": 85, ... } 
    }`;

    try {
        const responseStream = await callWithRetry(() => getAI().models.generateContentStream({
            model: getModel('General'), // Use pro for better reasoning and thinking
            contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`,
            config: { responseMimeType: "application/json" }
        }));
        
        let fullText = "";
        let fullThinking = "";
        
        for await (const chunk of responseStream) {
            const c = chunk as any;
            const textPart = c.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || "";
            const thoughtPart = c.candidates?.[0]?.content?.parts?.find((p: any) => p.thought)?.thought || "";
            
            if (thoughtPart) {
                fullThinking += thoughtPart;
                if (onProgress) onProgress(fullThinking);
            }
            if (textPart) {
                fullText += textPart;
                if (!thoughtPart && onProgress && fullText.includes('"thinking"')) {
                    const match = fullText.match(/"thinking"\s*:\s*"([^"]+)"/);
                    if (match && match[1]) {
                        onProgress(match[1]);
                    }
                }
            }
        }
        
        const data = safeJsonParse(fullText || "{}", "analyzeMemoryRetention") as RetentionSummary;

        if (data && data.predictions) {
            const seenIds = new Set();
            data.predictions = data.predictions.filter(p => {
                if (!p.noteId || seenIds.has(p.noteId)) return false;
                seenIds.add(p.noteId);
                return true;
            });
            const validIds = new Set(library.map(n => n.id));
            data.predictions = data.predictions.filter(p => validIds.has(p.noteId));
        }

        return data;
    } catch (e) { return null; }
};

export const detectPlatform = (url: string): Platform => {
  if (!url) return Platform.GENERIC;
  if (url === 'File Upload' || url.startsWith('File Upload')) return Platform.FILE;
  if (url.startsWith('data:')) return Platform.FILE;
  const lower = url.toLowerCase();
  
  // Specific Hardcoded Platforms
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return Platform.YOUTUBE;
  if (lower.includes('tiktok.com')) return Platform.TIKTOK;
  if (lower.includes('twitter.com') || lower.includes('x.com')) return Platform.TWITTER;
  if (lower.includes('instagram.com')) return Platform.INSTAGRAM;
  if (lower.includes('douyin.com')) return Platform.DOUYIN;
  if (lower.includes('xiaohongshu.com') || lower.includes('xhslink.com')) return Platform.XIAOHONGSHU;
  if (lower.includes('bilibili.com')) return Platform.BILIBILI;
  if (lower.includes('zhihu.com')) return Platform.ZHIHU;
  if (lower.includes('mp.weixin.qq.com')) return Platform.WECHAT;

  // Generic URL -> Extract Domain Name
  try {
      const urlObj = new URL(url);
      let hostname = urlObj.hostname.replace('www.', '');
      // Example: abcnews.go.com -> ['abcnews', 'go', 'com'] -> 'abcnews'
      const parts = hostname.split('.');
      if (parts.length > 0) {
          const domain = parts[0];
          // Simple Capitalization: abcnews -> Abcnews
          if (domain.length > 0) {
              return (domain.charAt(0).toUpperCase() + domain.slice(1)) as Platform;
          }
      }
  } catch (e) {
      // Ignore URL parsing errors and fall back
  }

  return Platform.GENERIC;
};

export const regenerateQuiz = async (summary: string[]): Promise<QuizQuestion[]> => {
    if (!summary || summary.length === 0) return [];
    
    // Fallback quiz generation if the main model fails
    const prompt = `Generate 3 challenging multiple choice questions based on this summary.
    SUMMARY: ${JSON.stringify(summary)}
    Format: JSON Array of objects: { "question": "...", "options": ["A", "B", "C", "D"], "correctAnswerIndex": number }`;
    
    try {
        const response: GenerateContentResponse = await callWithRetry(() => getAI().models.generateContent({
            model: getModel('General'),
            contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`,
            config: { responseMimeType: "application/json" }
        }));
        const data = safeJsonParse(response.text || "[]", "regenerateQuiz");
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
};

export const processUrlContent = async (
  url: string,
  options: ProcessingOptions,
  onProgress?: (thinking: string) => void
): Promise<Partial<InboxItem>> => {
    const isFile = !!options.files && options.files.length > 0;
    const platform = detectPlatform(url);
    let parts: any[] = [];
    
    let isImageMode = false;
    let isDocMode = false;

    if (isFile && options.files) {
        options.files.forEach(f => {
            // 1. Text-based files: Decode and send as text
            if (f.mimeType.startsWith('text/') || 
                f.mimeType === 'application/json' || 
                f.mimeType === 'application/xml' ||
                f.mimeType === 'text/markdown' ||
                f.mimeType === 'text/csv') {
                try {
                    const textContent = atob(f.data.split(',')[1]);
                    parts.push({ text: `\n\n--- File Attachment: ${f.name || 'Untitled'} ---\n${textContent}\n--- End File ---\n` });
                } catch (e) {
                    console.warn(`Failed to decode text file ${f.name}`);
                }
            }
            // 2. Supported Binary files: Send as inlineData
            else if (
                f.mimeType.startsWith('image/') || 
                f.mimeType.startsWith('video/') || 
                f.mimeType.startsWith('audio/') || 
                f.mimeType === 'application/pdf'
            ) {
                parts.push({ inlineData: { mimeType: f.mimeType, data: f.data.split(',')[1] } });
                
                if (f.mimeType.startsWith('image/')) isImageMode = true;
                if (f.mimeType === 'application/pdf') isDocMode = true;
            }
            // 3. Unsupported files (e.g., DOCX, PPTX): Skip with warning to avoid API error
            else {
                console.warn(`Skipping unsupported MIME type: ${f.mimeType}`);
                parts.push({ text: `\n[System Warning: The file "${f.name}" with type ${f.mimeType} was skipped because it is not a supported format for direct analysis. Supported formats: PDF, Images, Audio, Video, Plain Text.]\n` });
            }
        });
    }

    const quizDiff = options.quizDifficulty || 'Medium';
    let promptIntro = "";
    
    if (isImageMode && !isDocMode) {
        // --- 1. IMAGE UPLOAD LOGIC (STRICT VERBATIM TRANSCRIPTION) ---
        promptIntro = `
        ANALOG SIGNAL DETECTED. You are functioning as an AI Vision & OCR Engine.
        
        CRITICAL TASK: VERBATIM TRANSCRIPTION.
        You MUST extract the EXACT text written in the image.
        - IGNORE PREVIOUS CONTEXT.
        - Do not summarize.
        - Do not paraphrase.
        - Do not correct grammar.
        - Capture every single word visible.
        - If handwriting is illegible, write [ILLEGIBLE].
        - If the image contains text, your PRIMARY job is to output that text EXACTLY as is.
        
        OUTPUT FORMATTING:
        - The FIRST element of the 'summary' array MUST be string starting with "Transcription: " followed by the exact text.
        - The SECOND element can be "Context: [Inferred context]".
        - The THIRD element can be "Insight: [Analysis]".
        `;
    } else if (isDocMode) {
        // --- 2. DOCUMENT UPLOAD LOGIC (Heavy Data -> Extraction) ---
        promptIntro = `
        HEAVY DATA SIGNAL DETECTED (PDF/Doc). You are an Expert Document Analyst.
        
        TASKS:
        1. SUMMARY: Distill the document into a core summary with 3-5 high-impact bullet points.
        2. CONCEPTS: Extract proper nouns and key technical concepts (Keywords).
        3. QUIZ: Generate a challenging quiz based on specific details in the document.
        
        OUTPUT FORMATTING:
        - In the 'title': Use the document filename or header title.
        - In the 'summary' array: Strictly high-signal bullet points.
        `;
    } else if (platform === Platform.FILE || isFile) {
        promptIntro = `Analyze the attached files comprehensively. Extract the core insights directly from the file content.`;
    } else if (platform === Platform.YOUTUBE) {
        let transcriptText = "";
        try {
            const response = await fetch(`https://r.jina.ai/${url}`);
            if (response.ok) {
                transcriptText = await response.text();
            } else {
                throw new Error("Jina fetch failed");
            }
        } catch (e) {
            console.warn("Failed to fetch YouTube content via Jina, trying youtube-transcript", e);
            try {
                const transcript = await YoutubeTranscript.fetchTranscript(url);
                transcriptText = transcript.map(t => t.text).join(' ');
            } catch (err) {
                console.warn("Failed to fetch YouTube transcript", err);
            }
        }
        
        if (transcriptText) {
            transcriptText = transcriptText.substring(0, 30000);
        }

        promptIntro = `
        ACCESS AND ANALYZE THIS YOUTUBE VIDEO: ${url}
        
        ${transcriptText ? `Here is the transcript or content of the video:\n"""\n${transcriptText}\n"""\n\nPlease analyze this content.` : `
        CRITICAL INSTRUCTION: 
        1. You MUST analyze the content of this YouTube video.
        2. Extract the actual key points, summary, and details from the video's transcript or content.
        `}
        `;
    } else {
        let fetchedContent = "";
        try {
            const response = await fetch(`https://r.jina.ai/${url}`);
            if (response.ok) {
                fetchedContent = await response.text();
                // Limit length to avoid token limits
                fetchedContent = fetchedContent.substring(0, 30000);
            }
        } catch (e) {
            console.warn("Failed to fetch URL content via Jina", e);
        }

        // STRONG GROUNDING INSTRUCTION FOR URLs
        promptIntro = `
        ACCESS AND ANALYZE THIS URL: ${url}
        
        ${fetchedContent ? `Here is the scraped text content from the URL:\n"""\n${fetchedContent}\n"""\n\nPlease analyze this content.` : `
        CRITICAL INSTRUCTION: 
        1. You MUST use the 'urlContext' tool to visit the URL and read its actual content.
        2. DO NOT guess, infer, or hallucinate content based on the URL text alone.
        3. If you successfully access the page, extract the actual key points, summary, and details.
        4. If you ABSOLUTELY cannot access the page content after multiple attempts with the tool, use the URL itself as the title and provide a summary of what the URL likely contains based on its structure, but prefix the summary with "[Note: Content was not directly accessible, summarized from metadata/URL]".
        `}
        `;
    }
    
    parts.push({ 
        text: `${promptIntro}
        
        After analyzing the source content, create a structured knowledge extraction.
        Generate a ${quizDiff} difficulty quiz based ONLY on the source material.
        
        CRITICAL FORMAT REQUIREMENT: You MUST generate a "generatedQuiz" array.
        
        OUTPUT JSON:
        {
          "title": "Clear, Descriptive Title",
          "platform": "${platform}",
          "summary": ["Transcription: ...", "Context: ...", "Insight: ..."], 
          "generatedQuiz": [
            { "question": "...", "options": ["A", "B", "C", "D"], "correctAnswerIndex": 0 }
          ],
          "tags": ["#Topic1", "#Topic2"]
        }
        
        Respond entirely in ${options.targetLanguage || 'English'}.`
    });

    try {
        // Determine if we need Search Grounding
        const useGrounding = !(isFile || platform === Platform.FILE || platform === Platform.YOUTUBE);
        
        const responseStream = await callWithRetry(() => getAI().models.generateContentStream({
            model: getModel('General'),
            contents: { parts },
            config: {
                // Ensure tools are active for URL mode
                tools: useGrounding ? [{ urlContext: {} }] : [],
                // FIX: Do not enforce JSON MIME type when using Search Grounding to avoid conflicts
                // If using grounding, we rely on the prompt to get JSON. If local file, we enforce it.
                responseMimeType: useGrounding ? undefined : 'application/json',
            }
        }));
        
        let fullText = "";
        let fullThinking = "";
        
        for await (const chunk of responseStream) {
            const c = chunk as any;
            const textPart = c.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || "";
            const thoughtPart = c.candidates?.[0]?.content?.parts?.find((p: any) => p.thought)?.thought || "";
            
            if (thoughtPart) {
                fullThinking += thoughtPart;
                if (onProgress) onProgress(fullThinking);
            }
            if (textPart) {
                fullText += textPart;
                // Try to extract "thinking" from partial JSON if thoughtPart is not available
                if (!thoughtPart && onProgress && fullText.includes('"thinking"')) {
                    const match = fullText.match(/"thinking"\s*:\s*"([^"]+)"/);
                    if (match && match[1]) {
                        onProgress(match[1]);
                    }
                }
            }
        }
        
        const data = safeJsonParse(fullText || "{}", "processUrlContent");
        
        let generatedQuiz = data.generatedQuiz || [];
        const summary = data.summary || [];
        const title = data.title || url;

        // CRITICAL FALLBACK: If main pipeline missed quiz, force generate one now.
        if (generatedQuiz.length === 0 && summary.length > 0) {
            console.log("Main pipeline missed quiz, running fallback generator...");
            generatedQuiz = await regenerateQuiz(summary);
        }

        return { ...data, title, summary, tags: data.tags || [], generatedQuiz, thinking: fullThinking || "Processing semantic signals..." };
    } catch (e: any) {
        console.warn("Extraction failed, using MOCK for Demo:", e);
        // MOCK RESPONSE FOR DEMO
        return { 
            title: url || "Scraped Link Content", 
            platform: platform,
            summary: [
                "The backend extraction encountered an issue or timed out.",
                "Real-time processing would normally extract key insights here."
            ], 
            tags: ["#Error"],
            generatedQuiz: []
        };
    }
};

export const generateQuizFromUserContent = async (thoughts: string, files: string[]): Promise<QuizQuestion[]> => {
    if (!thoughts.trim() && files.length === 0) return [];
    
    const prompt = `Generate 3-5 challenging multiple choice questions based on the following user thoughts and context.
    THOUGHTS: ${thoughts}
    Format: JSON Array of objects: { "question": "...", "options": ["A", "B", "C", "D"], "correctAnswerIndex": number }`;
    
    try {
        const response = await callWithRetry(() => getAI().models.generateContent({
            model: getModel(),
            contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`,
            config: { responseMimeType: "application/json" }
        }));
        const data = safeJsonParse(response.text || "[]", "generateQuizFromUserContent");
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
};

export const processNeuralDump = async (transcript: string, contextItems?: any[], onProgress?: (thinking: string) => void): Promise<any[]> => {
    let contextStr = "";
    if (contextItems && contextItems.length > 0) {
        // Strip out previous AI images or very long content to avoid token limits, keep core text
        contextStr = contextItems.map((n, i) => 
            `SOURCE MATERIAL ${i + 1} (Title: "${n.title || 'Untitled'}"):\n"""\n${(n.content || n.summary || "").substring(0, 3000)}\n"""`
        ).join('\n\n');
    }

    const prompt = `
    You are a Content Synthesizer Engine.
    Your goal is to process the SOURCE MATERIAL according to the USER INSTRUCTION.

    RULES:
    1. Do NOT explain what you are doing.
    2. Do NOT offer meta-commentary on the instruction (e.g. "To explain this...", "Here is a summary", "Explaining to a kid involves...").
    3. STRICTLY rewrite, summarize, or analyze the SOURCE MATERIAL content.
    4. If the instruction is "Explain to a kid", you must explain the *topics* in the source material, not the *concept* of explaining.
    5. If no SOURCE MATERIAL is provided, treat USER INSTRUCTION as a generative prompt (e.g. "Create a story").
    6. ONLY populate 'imagePrompt' if the user EXPLICITLY asks for a picture or visual. Otherwise, omit it. Do NOT always add a picture.

    SOURCE MATERIAL:
    """
    ${contextStr || "No Source Material. Treat User Instruction as a generative prompt."}
    """

    USER INSTRUCTION:
    "${transcript}"
    
    OUTPUT JSON FORMAT:
    [
      { 
        "title": "Clear Title", 
        "content": "The result content...", 
        "source": "neural_dump",
        "imagePrompt": "Optional: detailed prompt for image generation if requested"
      }
    ]
    `;

    try {
        const responseStream = await callWithRetry(() => getAI().models.generateContentStream({
            model: getModel('General'),
            contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`,
            config: { responseMimeType: "application/json" }
        }));
        
        let fullText = "";
        let fullThinking = "";
        
        for await (const chunk of responseStream) {
            const c = chunk as any;
            const textPart = c.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || "";
            const thoughtPart = c.candidates?.[0]?.content?.parts?.find((p: any) => p.thought)?.thought || "";
            
            if (thoughtPart) {
                fullThinking += thoughtPart;
                if (onProgress) onProgress(fullThinking);
            }
            if (textPart) {
                fullText += textPart;
                if (!thoughtPart && onProgress && fullText.includes('"thinking"')) {
                    const match = fullText.match(/"thinking"\s*:\s*"([^"]+)"/);
                    if (match && match[1]) {
                        onProgress(match[1]);
                    }
                }
            }
        }
        
        const data = safeJsonParse(fullText || "[]", "processNeuralDump") as any[];
        return data.map(item => ({...item, thinking: fullThinking}));
    } catch (e: any) { 
        console.error("Neural Dump Error:", e.message); 
        return []; 
    }
};

// --- CHAT WITH Ko (Agentic + Context Aware) ---
export const chatWithKo = async (
    query: string, 
    socraticMode: boolean = false,
    persona: string = "Research Assistant",
    contextContent: string = "",
    activeFileContext?: { mimeType: string, data: string } | null,
    onProgress?: (text: string, thinking: string) => void
) => {
    
    const contextPrompt = contextContent 
        ? `\n--- ACTIVE CONTEXT (Source of Truth) ---\n${contextContent}\n--- END CONTEXT ---\n\nINSTRUCTION: You must base your answer primarily on the ACTIVE CONTEXT above. If the context contains indexed paragraphs (e.g. [1], [2]), please cite them in your response by adding the index number at the end of the relevant sentence (e.g. "The sky is blue [1].").`
        : "";

    const socraticInstruction = socraticMode 
        ? `\nSOCRATIC MODE: ON. Do NOT give direct answers. Instead, ask guiding questions to help the user derive the answer from the context. Be encouraging but firm in making them think.`
        : `\nSOCRATIC MODE: OFF. Give direct, clear, and helpful answers.`;

    const strictContextRule = activeFileContext 
        ? "The user has attached a file (Image/PDF). You must prioritize analyzing this file content to answer the query. You can use the text context as background info, but the file is the primary source."
        : "You must base your answer primarily on the ACTIVE CONTEXT above.";

    const systemPrompt = `
    IDENTITY: You are ko, a specialized AI Knowledge Agent acting as a ${persona}.
    
    ${contextPrompt}
    
    ${socraticInstruction}
    
    GENERAL RULES:
    1. Be concise and insightful.
    2. If acting as a specific persona (e.g. Marketing Consultant), use appropriate terminology and perspective.
    3. If indexed context is provided, USE CITATIONS [x] heavily to ground your claims.
    4. ${strictContextRule}
    5. Respond entirely in ${getSystemLanguage()}.
    `;

    try {
        // Construct the parts for the user message
        const parts: any[] = [
            { text: systemPrompt + "\n\nUser Query: " + query }
        ];

        // If there's an active file (Image/PDF), attach it for Multimodal Analysis
        if (activeFileContext) {
            const isSupported = activeFileContext.mimeType.startsWith('image/') || 
                                activeFileContext.mimeType.startsWith('video/') || 
                                activeFileContext.mimeType.startsWith('audio/') || 
                                activeFileContext.mimeType === 'application/pdf';
            
            if (isSupported) {
                parts.push({ 
                    inlineData: { 
                        mimeType: activeFileContext.mimeType, 
                        data: activeFileContext.data 
                    } 
                });
                parts.push({ text: "\n[System: The user has attached the file displayed above. Answer the query based on this file.]" });
            } else {
                parts.push({ text: `\n[System Warning: The user has attached a file of type ${activeFileContext.mimeType}, but it is not supported for direct multimodal analysis. Please rely on the extracted text context provided above.]\n` });
            }
        }

        const stream = await getAI().models.generateContentStream({
            model: getModel(socraticMode ? 'LogicGuard' : 'General'),
            contents: [
                { role: 'user', parts: parts }
            ]
        });
        
        let fullText = "";
        let fullThinking = "";
        
        for await (const chunk of stream) {
            const c = chunk as any;
            const textPart = c.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || "";
            const thoughtPart = c.candidates?.[0]?.content?.parts?.find((p: any) => p.thought)?.thought || "";
            
            if (thoughtPart) {
                fullThinking += thoughtPart;
            }
            if (textPart) {
                fullText += textPart;
            }
            if (onProgress) {
                onProgress(fullText, fullThinking);
            }
        }
        
        return fullText || "I couldn't process that.";
    } catch (e) {
        console.error("Chat Error", e);
        return "Connection interrupted.";
    }
};

export const runArchitect = async (nodes: CanvasNode[]): Promise<{ clusters: { id: string, title: string, nodeIds: string[] }[] }> => {
    if (nodes.length < 2) return { clusters: [] };

    const nodeData = nodes.map(n => ({ id: n.id, title: n.title, content: n.content?.substring(0, 500) }));
    const prompt = `Analyze these knowledge nodes and group them into 2-4 logical clusters based on semantic similarity.
    NODES: ${JSON.stringify(nodeData)}
    
    Output JSON:
    { "clusters": [ { "id": "cluster-1", "title": "Cluster Name", "nodeIds": ["node-id-1", "node-id-2"] } ] }`;

    try {
        const response = await callWithRetry(() => getAI().models.generateContent({
            model: getModel(),
            contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`,
            config: { responseMimeType: "application/json" }
        }));
        const data = safeJsonParse(response.text || "{}", "runArchitect");
        return data.clusters ? data : { clusters: [] };
    } catch (e) { return { clusters: [] }; }
};

export const detectFallacies = async (text: string): Promise<string[]> => {
    if (!text.trim()) return [];
    const prompt = `Identify any logical fallacies in the following text. Return a simple list of fallacy names.
    TEXT: ${text}
    Format: JSON Array of strings.`;
    
    try {
        const response = await callWithRetry(() => getAI().models.generateContent({
            model: getModel(),
            contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`,
            config: { responseMimeType: "application/json" }
        }));
        const data = safeJsonParse(response.text || "[]", "detectFallacies");
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
};

export const checkContradictions = async (nodeA: CanvasNode, nodeB: CanvasNode): Promise<string | null> => {
    const prompt = `Compare these two knowledge nodes and identify if they contradict each other.
    NODE A: ${nodeA.title} - ${nodeA.content}
    NODE B: ${nodeB.title} - ${nodeB.content}
    
    If they contradict, explain why in one sentence. If not, return null.
    Format: JSON { "contradiction": "explanation" | null }`;

    try {
        const response = await callWithRetry(() => getAI().models.generateContent({
            model: getModel(),
            contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`,
            config: { responseMimeType: "application/json" }
        }));
        const data = safeJsonParse(response.text || "{}", "checkContradictions");
        return data.contradiction || null;
    } catch (e) { return null; }
};

export const findSparkConnections = async (nodes: CanvasNode[]): Promise<CanvasEdge[]> => {
    if (nodes.length < 2) return [];
    const nodeData = nodes.map(n => ({ id: n.id, title: n.title, content: n.content?.substring(0, 300) }));
    const prompt = `Identify 2-5 interesting semantic connections between these nodes.
    NODES: ${JSON.stringify(nodeData)}
    
    Output JSON:
    [ { "id": "edge-id", "source": "node-id-1", "target": "node-id-2", "type": "neural" } ]`;

    try {
        const response = await callWithRetry(() => getAI().models.generateContent({
            model: getModel(),
            contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`,
            config: { responseMimeType: "application/json" }
        }));
        const data = safeJsonParse(response.text || "[]", "findSparkConnections");
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
};

export const synthesizeNodes = async (items: any[], mode: string): Promise<{title: string, content: string, steps: string[], imageUrl?: string}> => {
    const context = items.map(i => `ITEM: ${i.title}\n${i.content || i.summary?.join(' ')}`).join('\n\n');
    const prompt = `Synthesize the following items into a new, cohesive knowledge asset. 
    MODE: ${mode}
    CONTEXT: ${context}
    
    Output JSON:
    { "title": "Synthesized Title", "content": "The synthesized content...", "steps": ["Step 1", "Step 2"], "imageUrl": "Optional DALL-E style prompt for a visual" }`;

    try {
        const response = await callWithRetry(() => getAI().models.generateContent({
            model: getModel(),
            contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`,
            config: { responseMimeType: "application/json" }
        }));
        const data = safeJsonParse(response.text || "{}", "synthesizeNodes");
        return {
            title: data.title || "Synthesized Asset",
            content: data.content || "Synthesis output...",
            steps: data.steps || [],
            imageUrl: data.imageUrl || ""
        };
    } catch (e) { 
        return { title: "Synthesized Asset", content: "Synthesis output...", steps: [], imageUrl: "" };
    }
};

export const summarizeSources = async (sources: any[]): Promise<string> => {
    const context = sources.map((s, i) => `SOURCE ${i+1} (${s.title}):\n${s.content || s.summary?.join(' ')}`).join('\n\n');
    const prompt = `Provide a comprehensive executive summary of these sources.
    SOURCES: ${context}`;
    
    try {
        const response = await callWithRetry(() => getAI().models.generateContent({
            model: getModel(),
            contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`
        }));
        return response.text || "Summary unavailable.";
    } catch (e) { return "Summary failed."; }
};

export const extractKeywordsForGrouping = async (nodes: CanvasNode[]): Promise<{ nodeId: string, keywords: string[] }[]> => {
    if (nodes.length === 0) return [];
    const context = nodes.map(n => ({ nodeId: n.id, title: n.title, content: n.content?.substring(0, 500) }));
    const prompt = `Analyze these nodes and group them into a maximum of 5 broad themes.
    For each node, provide the single most relevant theme name as a keyword.
    Return a JSON array of objects with 'nodeId' and 'keywords' (where keywords is an array containing exactly one theme name).
    NODES: ${JSON.stringify(context)}
    Output format: [{"nodeId": "...", "keywords": ["Theme Name"]}]`;
    
    try {
        const response = await callWithRetry(() => getAI().models.generateContent({
            model: getModel(),
            contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`,
            config: { responseMimeType: "application/json" }
        }));
        const parsed = safeJsonParse(response.text || "[]", "extractKeywordsForGrouping");
        
        const extractKeywords = (p: any): string[] => {
            if (Array.isArray(p.keywords)) return p.keywords;
            if (typeof p.keywords === 'string') return [p.keywords];
            if (Array.isArray(p.theme)) return p.theme;
            if (typeof p.theme === 'string') return [p.theme];
            if (typeof p.keyword === 'string') return [p.keyword];
            return [];
        };

        if (Array.isArray(parsed)) {
            return parsed.map(p => ({ nodeId: p.nodeId || p.id, keywords: extractKeywords(p) })).filter(p => p.nodeId);
        } else if (parsed && typeof parsed === 'object') {
            // Handle case where Gemini returns an object with themes as keys and node IDs as values
            const isThemeToNodesMap = Object.values(parsed).every(v => Array.isArray(v) && (v.length === 0 || typeof v[0] === 'string'));
            if (isThemeToNodesMap && Object.keys(parsed).length > 0) {
                const result: { nodeId: string, keywords: string[] }[] = [];
                Object.entries(parsed).forEach(([themeName, nodeIds]) => {
                    if (Array.isArray(nodeIds)) {
                        nodeIds.forEach(nId => {
                            if (typeof nId === 'string') {
                                result.push({ nodeId: nId, keywords: [themeName] });
                            }
                        });
                    }
                });
                if (result.length > 0) return result;
            }

            // Handle case where Gemini returns an object with a themes array
            const possibleArray = Object.values(parsed).find(v => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object');
            if (possibleArray) {
                const arr = possibleArray as any[];
                // Check if it's an array of { theme: string, nodes: string[] }
                if (arr.length > 0 && arr[0].nodes && Array.isArray(arr[0].nodes)) {
                    const result: { nodeId: string, keywords: string[] }[] = [];
                    arr.forEach(t => {
                        const themeName = t.theme || t.name || t.title || "Uncategorized";
                        t.nodes.forEach((nId: string) => {
                            result.push({ nodeId: nId, keywords: [themeName] });
                        });
                    });
                    return result;
                }
                return arr.map(p => ({ nodeId: p.nodeId || p.id, keywords: extractKeywords(p) })).filter(p => p.nodeId);
            }
        }
        return [];
    } catch (e) { return []; }
};

export const runNightShift = async (nodes: CanvasNode[]): Promise<string> => {
    if (nodes.length === 0) return "No nodes to process.";
    const context = nodes.map(n => n.title).join(', ');
    const prompt = `You are performing a 'Night Shift' maintenance on a knowledge base.
    Review these topics: ${context}
    Provide one high-level insight or connection that emerges from this collection.`;
    
    try {
        const response = await callWithRetry(() => getAI().models.generateContent({
            model: getModel(),
            contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`
        }));
        return response.text || "Night shift complete.";
    } catch (e) { return "Night shift failed."; }
};

export const analyzeBoardContext = async (items: any[]) => { 
    if (items.length === 0) return "Board is empty.";
    const context = items.map(i => i.title).join(', ');
    const prompt = `Analyze the current state of this knowledge board.
    TOPICS: ${context}
    Provide a brief (2 sentence) overview of the main themes present.`;
    
    try {
        const response = await callWithRetry(() => getAI().models.generateContent({
            model: getModel(),
            contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`
        }));
        return response.text || "Analysis complete.";
    } catch (e) { return "Analysis failed."; }
};

export const generateCourseOutline = async (noteNodes: any[]) => { 
    if (noteNodes.length === 0) return null;
    const context = noteNodes.map(n => n.title).join(', ');
    const prompt = `Create a 4-week learning course outline based on these topics: ${context}.
    Format: JSON { "title": "Course Name", "weeks": [ { "week": 1, "topic": "...", "description": "..." } ] }`;
    
    try {
        const response = await callWithRetry(() => getAI().models.generateContent({
            model: getModel(),
            contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`,
            config: { responseMimeType: "application/json" }
        }));
        return safeJsonParse(response.text || "{}", "generateCourseOutline");
    } catch (e) { return null; }
};

export const generateActionPlan = async (insight: string) => { 
    const prompt = `Generate a 3-step action plan based on this insight: ${insight}.
    Format: JSON { "title": "Action Plan", "steps": ["...", "...", "..."] }`;
    
    try {
        const response = await callWithRetry(() => getAI().models.generateContent({
            model: getModel(),
            contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`,
            config: { responseMimeType: "application/json" }
        }));
        const data = safeJsonParse(response.text || "{}", "generateActionPlan");
        return { title: data.title || "Plan", content: data.steps?.join('\n') || "..." };
    } catch (e) { return { title: "Plan", content: "..." }; }
};

export const generateSkillTree = async (noteNodes: any[], mode: string) => { 
    if (noteNodes.length === 0) return [];
    const context = noteNodes.map(n => n.title).join(', ');
    const prompt = `Generate a skill tree (prerequisites and advanced topics) based on these notes: ${context}.
    MODE: ${mode}
    Format: JSON Array of objects: { "skill": "...", "prerequisites": ["..."] }`;
    
    try {
        const response = await callWithRetry(() => getAI().models.generateContent({
            model: getModel(),
            contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`,
            config: { responseMimeType: "application/json" }
        }));
        const data = safeJsonParse(response.text || "[]", "generateSkillTree");
        return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
};

export const runAgentCheck = async (library: Note[]) => { 
    if (library.length === 0) return null;
    const context = library.map(n => n.title).slice(0, 10).join(', ');
    const prompt = `As an AI agent, review these library items: ${context}.
    Identify one proactive recommendation for the user.
    Format: JSON { "recommendation": "...", "reason": "..." }`;
    
    try {
        const response = await callWithRetry(() => getAI().models.generateContent({
            model: getModel(),
            contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`,
            config: { responseMimeType: "application/json" }
        }));
        return safeJsonParse(response.text || "{}", "runAgentCheck");
    } catch (e) { return null; }
};

export const checkPostCaptureTriggers = async (item: InboxItem, library: Note[]) => { 
    const prompt = `Review this new item: ${item.title} against the existing library: ${library.map(n => n.title).slice(0, 5).join(', ')}.
    Is there a strong connection or conflict?
    Format: JSON { "trigger": "connection" | "conflict" | null, "reason": "..." }`;
    
    try {
        const response = await callWithRetry(() => getAI().models.generateContent({
            model: getModel(),
            contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`,
            config: { responseMimeType: "application/json" }
        }));
        return safeJsonParse(response.text || "{}", "checkPostCaptureTriggers");
    } catch (e) { return null; }
};

export const generateThreeCCanvas = async (targets: Note[]) => { 
    const context = targets.map(n => n.title).join(', ');
    const prompt = `Generate a 3C (Concept, Conflict, Conclusion) canvas based on: ${context}.
    Format: JSON { "title": "3C Analysis", "concept": "...", "conflict": "...", "conclusion": "..." }`;
    
    try {
        const response = await callWithRetry(() => getAI().models.generateContent({
            model: getModel(),
            contents: prompt + `\n\nRespond entirely in ${getSystemLanguage()}.`,
            config: { responseMimeType: "application/json" }
        }));
        const data = safeJsonParse(response.text || "{}", "generateThreeCCanvas");
        return { 
            id: `canvas-${Date.now()}`, 
            title: data.title || '3C Analysis', 
            state: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } } 
        };
    } catch (e) { return { id: '', title: '', state: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } } }; }
};
