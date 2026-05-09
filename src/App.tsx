/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import { Loader2, Sparkles, CalendarSync, Copy, Check, ArrowLeft, Image as ImageIcon, Upload } from 'lucide-react';
import { motion } from 'framer-motion';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const getSystemInstruction = (language: string, creatorType: string) => `You are a high-end content strategist for a creator whose persona/niche is: "${creatorType}". 
You create highly engaging ${language} content tailored to their target audience.
Their style is personal, excited, story-based, and simple. They explain things like a friend telling another friend something crazy they discovered at 2 AM. 
Use words like yaar, bhai, dekho, suno naturally. Mix ${language} with English terms relevant to their niche. 
Use daily-life examples and relatable local scenarios.
Do not sound formal, robotic, or corporate. Focus on making it desi, useful, emotional, and story-based. Every idea should help the audience learn, earn, or understand the future before others.

When generating scripts for content pieces, you MUST be hyper-engaging, conversational, and use the 'desi' style heavily. You should sound exactly like a high-energy local creator speaking to their audience directly ("suno yaar", "bhai dekho", etc.). Avoid standard generic explanations.

Output EXACTLY valid JSON matching the schema requested. No markdown blocks around JSON, just raw JSON.
For 'thumbnail_concept', ALWAYS provide highly descriptive, professional, cinematic visual prompts (use keywords like: dramatic lighting, high contrast, 8k resolution, photorealistic, cinematic composition). If text is to be placed in the image, clearly specify the exact text in quotes and instruct to ensure perfect spelling.`;

const getPrompt = (topic: string, creatorType: string) => `Your daily job is to create a highly-researched content brief for the creator (Persona: "${creatorType}"). 
Before creating the brief, you MUST use Google Search to gather the most viral and trending information appropriate for this creator type.

CRITICAL RULE FOR SOURCES: There are no strict limitations on which websites or platforms you use to gather information, BUT whatever sources you collect information from MUST be highly reputed, top-tier, high-profile, and world-renowned authorities in the target niche.

Sources to explore include but are not limited to:
1. Top-tier, highly reputed major news companies, blogs, and industry-leading publishers relevant to "${creatorType}".
2. Elite newsletters/sources appropriate for the niche.
3. Viral content from YouTube, Facebook, Instagram, TikTok, Twitter/X, and LinkedIn.
4. Extremely high-profile creators and thought leaders in the "${creatorType}" space. Analyze their latest posts for the best hooks, topics, and engaging patterns.

${topic.trim() ? `Focus entirely on the hottest viral angles specifically related to the creator's current sub-topic: "${topic}". Collect information from the most high-profile and reputed sources relevant to "${topic}". Create the entire brief around this sub-topic based on what is actually trending right now across these top-tier platforms, keeping it engaging, relatable, and native to the creator's style.` : `Find today's hottest topics based on what is currently going viral on high-profile social media, top-tier newsletters, and highly reputed news platforms relevant to "${creatorType}".`}

Output MUST be raw JSON exactly matching this structure:
{
  "date": "Oct 24, 2024",
  "time": "9:00 AM PKT",
  "trending_today": [
    {
      "topic": "...",
      "why_it_matters": "...",
      "audience_care": "...",
      "angle": "...",
      "source": "..."
    }
  ],
  "content_pieces": [
    {
      "id": "reel_news_1",
      "type": "Reel News",
      "topic": "...",
      "title": "Viral, click-worthy title...",
      "description": "Engaging, SEO-optimized description...",
      "tags": ["viral", "ai", "trending"],
      "hook": "...",
      "script": "Word-for-word, highly engaging, desi-style Roman Urdu script (use yaar, bhai, etc.)...",
      "thumbnail_concept": "Description of visuals, face expression, text overlay",
      "aspect_ratio": "9:16",
      "duration": "60-90s"
    },
    {
      "id": "reel_tool_1",
      "type": "Reel Tutorial",
      "topic": "...",
      "title": "Viral, click-worthy title...",
      "description": "Engaging description for the post...",
      "tags": ["viral", "ai", "trending"],
      "hook": "...",
      "script": "Word-for-word, rapid-fire, conversational desi-style Roman Urdu...",
      "thumbnail_concept": "Description of visuals...",
      "aspect_ratio": "9:16",
      "duration": "60-90s"
    },
    {
      "id": "youtube_1",
      "type": "YouTube Video",
      "topic": "...",
      "title": "Viral, click-worthy title...",
      "description": "Engaging description for the post...",
      "tags": ["viral", "ai", "trending"],
      "hook": "...",
      "script": "Detailed outline with very conversational, engaging Roman Urdu dialogue...",
      "thumbnail_concept": "Wide aspect thumbnail description...",
      "aspect_ratio": "16:9",
      "duration": "10-20 min"
    },
    {
      "id": "newsletter_1",
      "type": "Newsletter",
      "topic": "...",
      "title": "Viral, click-worthy title...",
      "description": "Engaging description for the post...",
      "tags": ["viral", "ai", "trending"],
      "hook": "...",
      "script": "Conversational hook paragraph + sections, written like a friendly letter...",
      "thumbnail_concept": "Newsletter header image concept...",
      "aspect_ratio": "16:9",
      "duration": "5 min read"
    }
  ],
  "quick_wins": [
    {
      "topic": "...",
      "angle": "..."
    }
  ]
}`;

interface ContentPiece {
  id: string;
  type: string;
  topic: string;
  title?: string;
  description?: string;
  tags?: string[];
  hook?: string;
  script?: string;
  thumbnail_concept?: string;
  aspect_ratio?: "9:16" | "16:9" | "1:1";
  duration?: string;
}

interface DailyBrief {
  date: string;
  time: string;
  trending_today: {
    topic: string;
    why_it_matters: string;
    audience_care: string;
    angle: string;
    source: string;
  }[];
  content_pieces: ContentPiece[];
  quick_wins: { topic: string; angle: string }[];
}

function AssetGenerator({ item }: { item: ContentPiece }) {
  const [imagePrompt, setImagePrompt] = useState<string>(item.thumbnail_concept || '');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploadedBase64, setUploadedBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = (event.target?.result as string).split(',')[1];
      setUploadedBase64(base64String);
    };
    reader.readAsDataURL(file);
  };

  const executeGeneration = async () => {
    if (!imagePrompt.trim()) return;
    setIsGeneratingImage(true);
    setImageError(null);
    try {
      const baseStyle = "Extremely high-quality, professional, and classic YouTube/social media thumbnail style. The person MUST look exactly like a real natural photographic human matching the uploaded photo perfectly (NO cartoons, NO 3D rendering, NO artificial/robotic AI look). Natural yet high-retention aesthetic, sharp focus, 8k resolution. ";
      const stylePrefix = item.aspect_ratio === '9:16'
        ? baseStyle + "Vertical Reel cover video still. Clean and professional lighting, cinematic composition, high-quality natural colors, visually striking but realistic. "
        : item.aspect_ratio === '16:9'
        ? baseStyle + "Classic high-end YouTube thumbnail style. Clean background, professional studio lighting on the subject, well-balanced vibrant colors, very clean and polished composition without being overly edited. "
        : baseStyle + "Professional high-quality social media design. Clean modern aesthetic, premium photography look. ";
        
      const enhancedPrompt = "Subject/Face: MUST be a 100% natural, photorealistic human identical to the uploaded photo. Typography: ANY text requested MUST be clean, bold, highly legible, professional, and spelled EXACTLY as written. Style: " + stylePrefix + imagePrompt;

      const parts: any[] = [{ text: enhancedPrompt }];
      if (uploadedBase64) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: uploadedBase64
          }
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: item.aspect_ratio || "16:9"
          }
        }
      });

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            setGeneratedImages(prev => [`data:image/jpeg;base64,${part.inlineData.data}`, ...prev]);
            break;
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      
      // Fallback: If image conditioning fails, just generate from text.
      if (uploadedBase64 && err.message?.toLowerCase().includes("invalid")) {
        console.warn("Retrying without image reference due to model constraints");
        try {
          const fallbackResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: enhancedPrompt + (uploadedBase64 ? " (Include a person matching the general vibe of the topic)" : "") }] },
            config: {
              imageConfig: { aspectRatio: item.aspect_ratio || "16:9" }
            }
          });
          if (fallbackResponse.candidates?.[0]?.content?.parts) {
            for (const part of fallbackResponse.candidates[0].content.parts) {
              if (part.inlineData) {
                setGeneratedImages(prev => [`data:image/jpeg;base64,${part.inlineData.data}`, ...prev]);
                break;
              }
            }
          }
          } catch (fbErr: any) {
          let errorMessage = fbErr.message || "Failed to generate image.";
          if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota")) {
            errorMessage = "API Quota Exceeded. Please try again later.";
          }
          setImageError(errorMessage);
        }
      } else {
        let errorMessage = err.message || "Failed to generate image.";
        if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota")) {
          errorMessage = "API Quota Exceeded. Please try again later.";
        }
        setImageError(errorMessage);
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="bg-black/20 rounded-xl border border-white/5 p-5 mt-4">
      <h3 className="text-[11px] font-black uppercase tracking-wider text-orange-400 mb-4 flex items-center gap-2">
        <ImageIcon className="w-4 h-4" /> Generate Visuals 
        <span className="text-gray-500 font-mono tracking-widest ml-auto">{item.aspect_ratio}</span>
      </h3>
      
      <div className="flex flex-col gap-4">
        {/* Upload User Picture */}
        <div className="flex items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-xl">
           <div className="w-12 h-12 rounded-full overflow-hidden bg-black flex-shrink-0 border border-white/20">
             {uploadedBase64 ? (
               <img src={`data:image/jpeg;base64,${uploadedBase64}`} className="w-full h-full object-cover" alt="Uploaded" />
             ) : (
               <div className="w-full h-full flex items-center justify-center text-gray-500"><Upload className="w-5 h-5" /></div>
             )}
           </div>
           <div className="flex-1">
             <p className="text-xs font-black uppercase text-white tracking-wider mb-1">Upload Your Photo</p>
             <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">For personalized thumbnail composition</p>
           </div>
           <input 
             type="file" 
             accept="image/jpeg, image/png" 
             ref={fileInputRef} 
             onChange={handleFileUpload} 
             className="hidden" 
           />
           <button 
             onClick={() => fileInputRef.current?.click()}
             className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors"
           >
             {uploadedBase64 ? 'Change' : 'Select'}
           </button>
        </div>

        {/* Prompt Input & Generate */}
        <div className="flex flex-col gap-2">
          <textarea 
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono resize-y min-h-[80px]"
            placeholder="Thumbnail description..."
          />
          <button
            onClick={executeGeneration}
            disabled={isGeneratingImage || !imagePrompt.trim()}
            className="w-full px-6 py-3 bg-gradient-to-br from-orange-600 to-red-600 text-white rounded-xl font-black uppercase text-xs tracking-wider border border-white/10 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate {item.type} Asset
          </button>
        </div>

        {imageError && (
          <div className="text-red-500 text-[10px] font-mono uppercase tracking-wider bg-red-500/10 p-3 rounded-lg border border-red-500/20">
            {imageError}
          </div>
        )}

        {generatedImages.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            {generatedImages.map((src, i) => (
               <div key={i} className="relative rounded-xl overflow-hidden border border-white/10 bg-black group shadow-lg">
                  <div className="w-full" style={{ paddingBottom: item.aspect_ratio === '9:16' ? '177.77%' : item.aspect_ratio === '1:1' ? '100%' : '56.25%' }}></div>
                  <img src={src} alt="Generated Asset" className="absolute top-0 left-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                    <a 
                      href={src} 
                      download={`${item.type.replace(/\s+/g, '_').toLowerCase()}_asset_${i+1}.jpg`}
                      className="text-[10px] bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-black uppercase tracking-widest backdrop-blur-sm transition-colors text-white border border-white/30"
                    >
                      Download
                    </a>
                  </div>
               </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [language, setLanguage] = useState<string>('Urdu/Roman Urdu');
  const [creatorType, setCreatorType] = useState<string>('Tech & AI Educator');
  const [niche, setNiche] = useState<string>('');

  const handleBack = () => {
    setBrief(null);
    setError(null);
  };

  const generateBrief = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: getPrompt(niche, creatorType),
        config: {
          tools: [{ googleSearch: {} }],
          systemInstruction: getSystemInstruction(language, creatorType),
          temperature: 0.7,
          responseMimeType: "application/json",
        }
      });
      
      const jsonText = response.text || "{}";
      const cleaned = jsonText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
      const parsed = JSON.parse(cleaned) as DailyBrief;
      setBrief(parsed);
    } catch (err: any) {
      console.error(err);
      let errorMessage = err.message || "An error occurred while generating the brief.";
      if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("quota")) {
        errorMessage = "API Quota Exceeded. Please try again later, or use a different API key if applicable.";
      } else if (errorMessage.startsWith("{")) {
        try {
          const parsed = JSON.parse(errorMessage);
          if (parsed.error?.message) {
            errorMessage = parsed.error.message;
          }
        } catch (e) {
          // ignore parse error
        }
      }
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1014] text-white font-sans selection:bg-orange-500/30 selection:text-orange-200 flex flex-col">
      {/* Header Section */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 pt-6 px-6 max-w-5xl mx-auto w-full">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-orange-500 uppercase">
            PRIME <span className="text-white">BRIEF</span>
          </h1>
          <p className="text-xs text-gray-400 font-mono tracking-widest uppercase mt-1">
            AI Content Engine • Desi Mode {brief && `• ${brief.date}`}
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full hidden sm:block">
            <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">● Engine: Ready</span>
          </div>
          {brief ? (
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black uppercase text-xs tracking-wider border border-white/10 transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </button>
          ) : (
            <button
              onClick={generateBrief}
              disabled={isGenerating}
              className="px-4 py-2 bg-gradient-to-br from-orange-600 to-red-600 text-white rounded-xl font-black uppercase text-xs tracking-wider border border-white/10 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Drafting...
                </>
              ) : (
                <>
                  <CalendarSync className="w-4 h-4" />
                  Generate Now
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-6">
        {!brief && !isGenerating && !error && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 w-full auto-rows-min mt-4">
            <div className="md:col-span-12 bg-[#1A1C23] border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[400px]">
              <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-6 text-orange-500">
                <Sparkles className="w-8 h-8" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black uppercase text-white mb-3 tracking-wider">Ready for today's plan?</h2>
              <p className="text-xs sm:text-sm font-semibold text-gray-400 max-w-md mx-auto mb-6 leading-relaxed uppercase tracking-widest">
                Scrape major news sites, YouTube, Instagram & platforms to generate a highly viral content brief perfectly matched to your niche.
              </p>
              
              <div className="flex flex-col gap-4 w-full max-w-md mb-8 text-left">
                 <div>
                   <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2 block">Content Language & Style</label>
                   <select 
                     value={language}
                     onChange={(e) => setLanguage(e.target.value)}
                     className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all font-mono"
                   >
                     <option value="Urdu/Roman Urdu">Urdu / Roman Urdu</option>
                     <option value="Bengali">Bengali</option>
                     <option value="Hindi/Roman Hindi">Hindi / Roman Hindi</option>
                     <option value="English">English</option>
                   </select>
                 </div>
                 
                 <div>
                   <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2 block">Your Channel/Persona Type</label>
                   <input 
                     type="text" 
                     value={creatorType}
                     onChange={(e) => setCreatorType(e.target.value)}
                     placeholder="E.g., Tech Reviewer, Fitness Coach, Finance Guru"
                     className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-all font-mono"
                   />
                 </div>
                 
                 <div>
                   <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2 block">Specific Topic (Optional)</label>
                   <input 
                     type="text" 
                     value={niche}
                     onChange={(e) => setNiche(e.target.value)}
                     placeholder="E.g., Top 5 Productivity Tools"
                     className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-all font-mono"
                   />
                 </div>
              </div>

              <button
                onClick={generateBrief}
                className="inline-flex items-center gap-2 bg-gradient-to-br from-orange-600 to-red-600 text-white px-6 py-3 rounded-xl font-black uppercase tracking-wider text-sm border border-white/10 transition-all hover:opacity-90 active:scale-95 shadow-lg shadow-orange-500/20"
              >
                <CalendarSync className="w-5 h-5" />
                Generate Brief Now
              </button>
            </div>
            
            <div className="md:col-span-4 bg-[#1A1C23] border border-white/10 rounded-2xl p-5 flex flex-col hidden sm:flex">
              <h2 className="text-[10px] font-black uppercase text-gray-400 mb-2 tracking-wider">Task List</h2>
              <ul className="text-[11px] font-bold space-y-2 text-gray-300">
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-orange-500" /> Analyze Competitors</li>
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-orange-500" /> Fetch Real-time News</li>
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-orange-500" /> Draft Reel Scripts</li>
              </ul>
            </div>
            
            <div className="md:col-span-8 bg-gradient-to-br from-orange-600 to-red-600 rounded-2xl p-5 hidden sm:block relative overflow-hidden">
               <div className="absolute -right-4 -bottom-4 opacity-10">
                 <Sparkles className="w-32 h-32" />
               </div>
               <h2 className="text-[10px] font-black uppercase text-white/80 mb-1 tracking-wider">System Status</h2>
               <p className="text-xl font-black text-white leading-tight uppercase">Waiting for command.</p>
            </div>
          </div>
        )}

        {isGenerating && (
          <div className="my-auto flex flex-col items-center justify-center text-gray-400 min-h-[400px]">
            <Loader2 className="w-12 h-12 animate-spin text-orange-500 mb-4" />
            <p className="text-sm font-black uppercase tracking-widest text-white">Analyzing Top Trends...</p>
            <p className="text-[10px] mt-2 font-mono uppercase tracking-widest opacity-75">Fetching & formatting data for {creatorType}</p>
          </div>
        )}

        {error && (
          <div className="mt-8 bg-black/40 border border-red-500/30 rounded-xl p-5 text-red-400">
            <h3 className="text-xs font-black uppercase tracking-wider mb-2 text-red-500">Error Generating Brief</h3>
            <p className="text-sm font-mono">{error}</p>
          </div>
        )}

        {brief && !isGenerating && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full mb-12 mt-4 space-y-6"
          >
            {/* Trending Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="col-span-full md:col-span-1 bg-[#1A1C23] p-6 rounded-2xl border border-white/10 flex flex-col justify-center">
                 <h2 className="text-2xl font-black uppercase text-orange-500 tracking-wider">Trending<br/>Today 🔥</h2>
              </div>
              {brief.trending_today.map((trend, i) => (
                <div key={i} className="md:col-span-2 bg-black/40 p-5 rounded-2xl border border-white/5 flex flex-col justify-center">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-lg font-black text-white uppercase">{trend.topic}</p>
                    <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase bg-white/5 px-2 py-1 rounded">Source: {trend.source}</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{trend.why_it_matters}</p>
                  <div className="mt-auto pt-3 border-t border-white/5">
                    <p className="text-[11px] text-orange-300 font-bold uppercase tracking-wider">Angle: {trend.angle}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Content Pieces */}
            {brief.content_pieces.map((piece, index) => (
              <div key={index} className="bg-[#1A1C23] rounded-2xl shadow-lg border border-white/10 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                  <div className="flex items-center gap-3">
                    <span className="bg-orange-500 text-black text-[10px] font-black uppercase px-2 py-1 rounded tracking-widest">
                      {piece.type}
                    </span>
                    <h3 className="text-sm font-black uppercase text-white tracking-wider flex items-center gap-2">
                      {piece.topic}
                    </h3>
                  </div>
                  {piece.duration && (
                     <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">{piece.duration}</span>
                  )}
                </div>
                
                <div className="p-6 sm:p-8 flex flex-col gap-6">
                   {piece.title && (
                     <div>
                       <p className="text-[10px] font-black uppercase text-orange-500 mb-1 tracking-wider">Viral Title</p>
                       <p className="text-lg font-black text-white">{piece.title}</p>
                     </div>
                   )}
                   {piece.description && (
                     <div>
                       <p className="text-[10px] font-black uppercase text-gray-400 mb-1 tracking-wider">Viral Description</p>
                       <p className="text-xs text-gray-300 font-mono leading-relaxed">{piece.description}</p>
                     </div>
                   )}
                   {piece.tags && piece.tags.length > 0 && (
                     <div>
                       <p className="text-[10px] font-black uppercase text-gray-400 mb-2 tracking-wider">Viral Tags</p>
                       <div className="flex flex-wrap gap-2">
                         {piece.tags.map(tag => (
                           <span key={tag} className="text-[10px] bg-white/5 border border-white/10 px-2 py-1 rounded text-orange-200 uppercase tracking-widest">{tag.startsWith('#') ? tag : `#${tag}`}</span>
                         ))}
                       </div>
                     </div>
                   )}
                   {piece.hook && (
                     <div>
                       <p className="text-[10px] font-black uppercase text-orange-500 mb-1 tracking-wider">Hook Strategy</p>
                       <p className="text-sm font-bold italic text-white">"{piece.hook}"</p>
                     </div>
                   )}
                   
                   {piece.script && (
                     <div>
                       <p className="text-[10px] font-black uppercase text-gray-400 mb-2 tracking-wider">Script / Outline</p>
                       <div className="bg-black/30 rounded-xl p-4 border border-white/5 text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                         {piece.script}
                       </div>
                     </div>
                   )}

                   {/* Thumbnail Generator Inline */}
                   {piece.thumbnail_concept && (
                     <AssetGenerator item={piece} />
                   )}
                </div>
              </div>
            ))}
            
            {/* Quick Wins */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
               <div className="md:col-span-3">
                  <h3 className="text-sm font-black uppercase tracking-wider text-gray-400 mb-2">Quick Wins ⚡</h3>
               </div>
               {brief.quick_wins.map((win, i) => (
                 <div key={i} className="bg-gradient-to-br from-orange-600/20 to-red-600/20 border border-orange-500/20 p-5 rounded-2xl">
                    <p className="text-sm font-black uppercase text-white mb-2">{win.topic}</p>
                    <p className="text-[11px] text-orange-200 tracking-wider uppercase font-bold leading-relaxed">{win.angle}</p>
                 </div>
               ))}
            </div>

          </motion.div>
        )}
      </main>
    </div>
  );
}


