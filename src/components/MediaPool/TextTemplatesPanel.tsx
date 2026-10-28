import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Film,
  Music,
  Split,
  Sparkles,
  Plus,
  Search,
  Check,
} from 'lucide-react';
import { Type, Subtitles } from '@/components/Icons';
import { useTimelineStore } from '../../store/timelineStore';
import { TextClipStyle } from '../../types/ipc';

export interface TitleTemplate {
  id: string;
  name: string;
  category: 'Titles' | 'Lower Thirds' | 'Captions' | 'Social';
  description: string;
  defaultText: string;
  duration: number;
  style: Partial<TextClipStyle>;
}

export const TITLE_TEMPLATES: TitleTemplate[] = [
  {
    id: 'default_title',
    name: 'Default Title',
    category: 'Titles',
    description: 'Clean bold title centered on screen',
    defaultText: 'Add Your Title Here',
    duration: 3.5,
    style: {
      fontFamily: 'Inter',
      fontSize: 44,
      fontWeight: 'bold',
      fontColor: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 2,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backgroundPadding: 10,
      positionX: 0,
      positionY: 0,
      alignment: 'center',
    },
  },
  {
    id: 'youtube_lower_third',
    name: 'YouTube Lower-Third',
    category: 'Lower Thirds',
    description: 'High-contrast punchy lower third for vlogs & YouTube',
    defaultText: 'FEATURED SPEAKER // TOPIC',
    duration: 4.0,
    style: {
      fontFamily: 'Montserrat',
      fontSize: 38,
      fontWeight: 'bold',
      fontColor: '#FACC15',
      strokeColor: '#000000',
      strokeWidth: 3.5,
      backgroundColor: 'rgba(13, 14, 17, 0.88)',
      backgroundPadding: 12,
      positionX: 0,
      positionY: 65,
      alignment: 'lower_third',
    },
  },
  {
    id: 'cinematic_subtitle',
    name: 'Cinematic Subtitle',
    category: 'Captions',
    description: 'Letterbox style dialog subtitle with soft background',
    defaultText: 'Cinematic dialogue speech subtitle',
    duration: 3.0,
    style: {
      fontFamily: 'Arial',
      fontSize: 32,
      fontWeight: 'bold',
      fontColor: '#F0F3F8',
      strokeColor: 'rgba(0, 0, 0, 0.9)',
      strokeWidth: 2,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      backgroundPadding: 6,
      positionX: 0,
      positionY: 55,
      alignment: 'bottom_center',
    },
  },
  {
    id: 'karaoke_neon',
    name: 'Karaoke Neon Punch',
    category: 'Social',
    description: 'Electric cyan punch with vibrant outlines for shorts & reels',
    defaultText: 'GLOWING POP TEXT',
    duration: 2.5,
    style: {
      fontFamily: 'Impact',
      fontSize: 50,
      fontWeight: '900',
      fontColor: '#00F0FF',
      strokeColor: '#000000',
      strokeWidth: 4,
      backgroundColor: 'rgba(10, 15, 25, 0.8)',
      backgroundPadding: 10,
      positionX: 0,
      positionY: 0,
      alignment: 'center',
    },
  },
  {
    id: 'clean_minimalist',
    name: 'Clean Minimalist',
    category: 'Titles',
    description: 'Modern understated headline typography',
    defaultText: 'Chapter 01: The Beginning',
    duration: 3.0,
    style: {
      fontFamily: 'Inter',
      fontSize: 36,
      fontWeight: '500',
      fontColor: '#FFFFFF',
      strokeColor: 'transparent',
      strokeWidth: 0,
      backgroundColor: 'rgba(20, 22, 27, 0.75)',
      backgroundPadding: 8,
      positionX: 0,
      positionY: 0,
      alignment: 'center',
    },
  },
  {
    id: 'social_handle',
    name: 'Social Media Callout',
    category: 'Social',
    description: 'Call to action banner for handles and channels',
    defaultText: '@yourhandle • Subscribe',
    duration: 4.0,
    style: {
      fontFamily: 'Montserrat',
      fontSize: 34,
      fontWeight: 'bold',
      fontColor: '#C084FC',
      strokeColor: '#000000',
      strokeWidth: 2,
      backgroundColor: 'rgba(28, 16, 48, 0.85)',
      backgroundPadding: 10,
      positionX: 0,
      positionY: 60,
      alignment: 'lower_third',
    },
  },
  {
    id: 'breaking_news',
    name: 'Breaking News Ticker',
    category: 'Lower Thirds',
    description: 'Broadcast headline lower third with alert bar styling',
    defaultText: 'BREAKING: Major Headline Announcement',
    duration: 5.0,
    style: {
      fontFamily: 'Arial',
      fontSize: 36,
      fontWeight: 'bold',
      fontColor: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 2.5,
      backgroundColor: 'rgba(185, 28, 28, 0.9)',
      backgroundPadding: 12,
      positionX: 0,
      positionY: 65,
      alignment: 'lower_third',
    },
  },
  {
    id: 'big_impact',
    name: 'Big Impact Headline',
    category: 'Titles',
    description: 'Massive heavy typography for high-energy transitions',
    defaultText: 'DON’T MISS THIS',
    duration: 2.0,
    style: {
      fontFamily: 'Impact',
      fontSize: 64,
      fontWeight: '900',
      fontColor: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 5,
      backgroundColor: 'transparent',
      backgroundPadding: 0,
      positionX: 0,
      positionY: 0,
      alignment: 'center',
    },
  },
];

export const TextTemplatesPanel: React.FC = () => {
  const {
    setActiveTab,
    addTextClip,
    setIsAutoCaptionModalOpen,
  } = useTimelineStore(
    useShallow((state) => ({
      setActiveTab: state.setActiveTab,
      addTextClip: state.addTextClip,
      setIsAutoCaptionModalOpen: state.setIsAutoCaptionModalOpen,
    }))
  );

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [addedId, setAddedId] = useState<string | null>(null);

  const categories = ['All', 'Titles', 'Lower Thirds', 'Captions', 'Social'] as const;

  const filteredTemplates = TITLE_TEMPLATES.filter((tpl) => {
    const matchesCategory = selectedCategory === 'All' || tpl.category === selectedCategory;
    const matchesSearch =
      tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.defaultText.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddTemplate = (tpl: TitleTemplate) => {
    addTextClip(undefined, tpl.defaultText, undefined, tpl.duration, tpl.style);
    setAddedId(tpl.id);
    setTimeout(() => setAddedId(null), 1200);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#14161B] border-r border-[#222630] select-none">
      {/* Header & Sub-Bar */}
      <div className="p-3 bg-[#101217] border-b border-[#222630] space-y-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[#A855F7]/15 text-[#C084FC] border border-[#A855F7]/30">
              <Type size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#F0F3F8]">Text & Title Templates</h2>
              <p className="text-[10px] text-[#64748B]">Click or drag to place titles on your timeline</p>
            </div>
          </div>

          <button
            onClick={() => setIsAutoCaptionModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#A855F7]/20 hover:bg-[#A855F7]/30 text-[#C084FC] border border-[#A855F7]/40 text-[11px] font-bold cursor-pointer transition-all shadow-xs"
            title="Auto Captions: Generate local Whisper AI speech-to-text subtitles"
          >
            <Subtitles size={12} />
            <span>AI Captions</span>
          </button>
        </div>

        {/* Search & Category Filter Pills */}
        <div className="space-y-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#525D73]" />
            <input
              type="text"
              placeholder="Search title styles, presets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#14161B] border border-[#222630] rounded-md pl-7 pr-3 py-1 text-xs text-[#F0F3F8] placeholder-[#525D73] focus:outline-none focus:border-[#C084FC] transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#C084FC] text-black font-bold'
                    : 'bg-[#181B22] text-[#8A92A6] hover:text-[#F0F3F8] hover:bg-[#222630]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Templates Grid */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {/* Whisper AI Feature Banner */}
        <div className="p-3 rounded-lg bg-gradient-to-r from-[#1C162E] via-[#161724] to-[#12141A] border border-[#A855F7]/30 flex items-center justify-between gap-3 shadow-md">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#F0F3F8]">
              <Sparkles size={12} className="text-[#C084FC]" />
              <span>Whisper Speech-to-Text</span>
            </div>
            <p className="text-[10px] text-[#8A92A6] leading-tight">
              Automatically transcribe audio dialogue into synchronized subtitle blocks with local AI.
            </p>
          </div>
          <button
            onClick={() => setIsAutoCaptionModalOpen(true)}
            className="px-2.5 py-1.5 rounded bg-[#A855F7] hover:bg-[#9333EA] text-white text-[11px] font-bold cursor-pointer transition-colors shrink-0 shadow-[0_0_12px_rgba(168,85,247,0.4)]"
          >
            Generate
          </button>
        </div>

        {/* Templates Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filteredTemplates.map((tpl) => {
            const isJustAdded = addedId === tpl.id;
            return (
              <div
                key={tpl.id}
                className="group relative p-2.5 rounded-lg bg-[#0D0E11] hover:bg-[#161820] border border-[#222630] hover:border-[#A855F7]/50 transition-all flex flex-col justify-between gap-2 shadow-xs"
              >
                {/* Visual Preview Box */}
                <div
                  className="h-16 rounded bg-[#14161B] border border-[#1E222D] flex items-center justify-center p-2 text-center overflow-hidden relative"
                >
                  <span
                    style={{
                      fontFamily: tpl.style.fontFamily || 'Inter',
                      fontSize: '12px',
                      fontWeight: tpl.style.fontWeight || 'bold',
                      color: tpl.style.fontColor || '#FFFFFF',
                      WebkitTextStroke:
                        tpl.style.strokeWidth && tpl.style.strokeWidth > 0
                          ? `1px ${tpl.style.strokeColor || '#000000'}`
                          : undefined,
                      backgroundColor: tpl.style.backgroundColor || 'transparent',
                      padding: tpl.style.backgroundPadding ? '2px 6px' : undefined,
                      borderRadius: '3px',
                    }}
                    className="truncate max-w-full inline-block"
                  >
                    {tpl.defaultText}
                  </span>
                </div>

                {/* Info & Add Button */}
                <div className="flex items-center justify-between gap-1 pt-1">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[#F0F3F8] truncate group-hover:text-[#C084FC] transition-colors">
                      {tpl.name}
                    </div>
                    <div className="text-[10px] text-[#64748B] truncate">
                      {tpl.description}
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddTemplate(tpl)}
                    className={`p-1.5 rounded-md flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                      isJustAdded
                        ? 'bg-[#10B981] text-white shadow-[0_0_8px_#10B981]'
                        : 'bg-[#1E222D] hover:bg-[#A855F7] text-[#8A92A6] hover:text-white border border-[#2A2E3B] hover:border-[#A855F7]'
                    }`}
                    title="Add this title at current playhead"
                  >
                    {isJustAdded ? <Check size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={3} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-8 text-[#64748B] space-y-1">
            <Type size={24} className="mx-auto opacity-30 text-[#C084FC]" />
            <div className="text-xs text-[#8A92A6]">No templates match "{searchQuery}"</div>
            <div className="text-[10px] text-[#525D73]">Try another keyword or category filter</div>
          </div>
        )}
      </div>
    </div>
  );
};
