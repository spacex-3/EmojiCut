import React, { useRef, useState } from 'react';
import '../shojo.css';
import { Sparkles, Heart, Star, CloudUpload, Power, Scissors, Wand2, Image as ImageIcon, PenLine } from 'lucide-react';
import { StickerStyle, STICKER_STYLES, generateStickerSheet, buildStickerPrompt } from '../services/geminiService';
import { validateGeneratedImageDataUrl } from '../services/generatedImageGuard.mjs';

interface CutePrinterProps {
    status: 'idle' | 'uploading' | 'generating' | 'processing' | 'complete' | 'error';
    progress?: number;
    message?: string;
    onGenerated: (imageDataUrl: string) => void;
    onDirectUpload: (file: File) => void;
}

const CutePrinter2D: React.FC<CutePrinterProps> = ({ status, progress, message, onGenerated, onDirectUpload }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [customStyle, setCustomStyle] = useState('');
    const [selectedStyleId, setSelectedStyleId] = useState('line_cute');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Prompt Generator State
    const [showPromptModal, setShowPromptModal] = useState(false);
    const [generatedPrompt, setGeneratedPrompt] = useState('');

    const selectedStyle = STICKER_STYLES.find(s => s.id === selectedStyleId) || STICKER_STYLES[0];

    const handlePanelClick = () => {
        if (status === 'idle' || status === 'complete') {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                setReferenceImage(event.target?.result as string);
                setError(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!referenceImage) return;

        setIsGenerating(true);
        setError(null);

        try {
            const generatedImageUrl = await generateStickerSheet(
                referenceImage,
                selectedStyle,
                customStyle || undefined
            );
            await validateGeneratedImageDataUrl(generatedImageUrl);
            onGenerated(generatedImageUrl);
        } catch (err) {
            console.error('Generation failed:', err);
            setError(err instanceof Error ? err.message : '生成失败，请重试');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleReset = () => {
        setReferenceImage(null);
        setCustomStyle('');
        setError(null);
    };

    const currentStatus = isGenerating ? 'generating' : status;

    return (
        <div className={`cute-machine cute-machine-expanded ${currentStatus === 'generating' || currentStatus === 'processing' ? 'processing' : ''}`}>

            {/* Decorative Floating Icons */}
            <div className="deco deco-star" style={{ top: -20, left: -20 }}><Star fill="currentColor" /></div>
            <div className="deco deco-heart" style={{ top: 20, right: -30 }}><Heart fill="currentColor" /></div>
            <div className="deco deco-star" style={{ bottom: -10, left: -10, fontSize: '18px' }}><Star fill="currentColor" /></div>

            {/* Printer Brand / Header */}
            <div className="w-full flex justify-center items-center gap-2 mb-2 opacity-80">
                <div className="w-2 h-2 rounded-full bg-pink-400"></div>
                <div className="text-pink-400 font-bold tracking-widest text-xs">EMOJICUT BY KS</div>
                <div className="w-2 h-2 rounded-full bg-pink-400"></div>
            </div>

            {/* Screen Area - Upload or Preview */}
            <div className="machine-screen machine-screen-tall" onClick={!referenceImage ? handlePanelClick : undefined}>
                {!referenceImage ? (
                    <>
                        <CloudUpload size={36} className="text-cyan-600 mb-2 opacity-60" />
                        <div className="screen-text">上传角色图片<br /><span style={{ fontSize: '0.8rem', opacity: 0.7 }}>点击选择文件</span></div>
                    </>
                ) : (
                    <div className="relative w-full h-full">
                        <img src={referenceImage} alt="Reference" className="w-full h-full object-contain rounded-2xl" />
                        <button
                            onClick={(e) => { e.stopPropagation(); handleReset(); }}
                            className="absolute top-2 right-2 w-6 h-6 bg-red-400 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-500"
                        >
                            ✕
                        </button>
                    </div>
                )}
            </div>

            {/* Style Input Section - ALWAYS VISIBLE */}
            {!isGenerating && currentStatus !== 'processing' && (
                <div className="w-full mt-3 px-2">
                    <textarea
                        className="printer-style-input"
                        placeholder={`输入画面风格，如：赛博朋克霓虹灯、水彩风...
也可以直接在下面按钮选择一种风格，并直接点击生成贴纸即可`}
                        value={customStyle}
                        onChange={(e) => setCustomStyle(e.target.value)}
                        rows={2}
                    />

                    {/* Quick Style Chips */}
                    <div className="flex flex-wrap gap-1 mt-2">
                        {STICKER_STYLES.map(style => (
                            <button
                                key={style.id}
                                className={`style-chip ${selectedStyleId === style.id ? 'selected' : ''}`}
                                onClick={() => setSelectedStyleId(style.id)}
                            >
                                {style.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Processing State */}
            {(isGenerating || currentStatus === 'processing') && (
                <div className="w-full mt-3 flex flex-col items-center">
                    <Sparkles size={24} className="text-pink-400 animate-spin mb-2" />
                    <div className="screen-text text-sm mb-1">{message || (isGenerating ? 'AI 生成中...' : 'Processing...')}</div>
                    {isGenerating && (
                        <div className="text-[11px] text-pink-400 font-semibold mb-2">预计 1 分钟左右</div>
                    )}
                    <div className="w-full max-w-[160px] h-3 bg-white rounded-full border-2 border-pink-200 overflow-hidden">
                        <div
                            className="h-full bg-pink-300 transition-all duration-300"
                            style={{ width: `${progress || (isGenerating ? 50 : 0)}%`, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.5) 5px, rgba(255,255,255,0.5) 10px)' }}
                        ></div>
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="w-full mt-2 px-2">
                    <div className="text-red-400 text-xs text-center bg-red-50 rounded-lg py-2 px-3">
                        {error}
                    </div>
                </div>
            )}

            {/* Physical Controls - Unified Style */}
            <div className="flex items-center justify-around w-full px-2 mt-4">

                {/* 1. Power Button (Reset/Status) */}
                <div
                    className="flex flex-col items-center gap-1 group cursor-pointer"
                    title="重置 / 电源"
                    onClick={() => {
                        if (referenceImage) handleReset();
                    }}
                >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-b-4 active:border-b-0 active:translate-y-1 transition-all ${isGenerating ? 'bg-green-100 border-green-200 text-green-500' : 'bg-red-50 border-red-100 text-red-300 group-hover:text-red-400'}`}>
                        <Power size={18} />
                    </div>
                    <div className="text-[9px] uppercase font-bold text-red-200 tracking-wider">重置</div>
                </div>

                {/* 2. Generate Prompt Button */}
                <div
                    className="flex flex-col items-center gap-1 group cursor-pointer"
                    onClick={() => {
                        const prompt = buildStickerPrompt(selectedStyle, customStyle);
                        setShowPromptModal(true);
                        setGeneratedPrompt(prompt);
                    }}
                >
                    <div className="w-10 h-10 rounded-full bg-violet-50 border-b-4 border-violet-100 flex items-center justify-center text-violet-300 group-hover:text-violet-400 active:border-b-0 active:translate-y-1 transition-all">
                        <PenLine size={18} />
                    </div>
                    <div className="text-[9px] uppercase font-bold text-violet-200 tracking-wider">生成提示词</div>
                </div>

                {/* 3. Generate Sticker Button (Unified Style) */}
                <div
                    className={`flex flex-col items-center gap-1 group cursor-pointer ${(!referenceImage || isGenerating) ? 'opacity-50' : ''}`}
                    onClick={() => {
                        if (referenceImage && !isGenerating) handleGenerate();
                    }}
                >
                    <div className="w-12 h-12 rounded-full bg-pink-400 border-b-4 border-pink-600 flex items-center justify-center text-white shadow-lg group-hover:bg-pink-500 active:border-b-0 active:translate-y-1 transition-all">
                        {isGenerating ? <Sparkles size={24} className="animate-spin" /> : <Wand2 size={24} />}
                    </div>
                    <div className="text-[9px] uppercase font-bold text-pink-300 tracking-wider">生成贴纸</div>
                </div>

                {/* 4. Upload Sheet Button */}
                <div
                    className="flex flex-col items-center gap-1 group cursor-pointer"
                    onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) onDirectUpload(file);
                        };
                        input.click();
                    }}
                >
                    <div className="w-10 h-10 rounded-full bg-blue-50 border-b-4 border-blue-100 flex items-center justify-center text-blue-300 group-hover:text-blue-400 active:border-b-0 active:translate-y-1 transition-all">
                        <Scissors size={18} />
                    </div>
                    <div className="text-[9px] uppercase font-bold text-blue-200 tracking-wider">上传切割</div>
                </div>
            </div>

            {/* Output Slot */}
            <div className="output-slot-2d"></div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
            />

            {/* Prompt Modal Overlay */}
            {showPromptModal && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm rounded-[60px]">
                    <div className="bg-white p-6 rounded-2xl w-[90%] shadow-xl border-2 border-violet-200">
                        <h3 className="text-sm font-bold text-gray-700 mb-2">生成提示词 (Prompt)</h3>
                        <textarea
                            className="w-full h-32 text-xs p-2 border border-gray-200 rounded-lg mb-4 resize-none focus:outline-none focus:border-violet-400"
                            value={generatedPrompt}
                            readOnly
                        />
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setShowPromptModal(false)}
                                className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                关闭
                            </button>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(generatedPrompt);
                                    // Optional: simple feedback
                                    alert("已复制到剪贴板");
                                }}
                                className="px-3 py-1.5 text-xs bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors"
                            >
                                复制
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CutePrinter2D;
