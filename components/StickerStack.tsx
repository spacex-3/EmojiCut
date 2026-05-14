import React, { useState, useRef, useEffect } from 'react';
import { StickerSegment } from '../types';
import { Download, X } from 'lucide-react';

interface StickerStackProps {
    stickers: StickerSegment[];
    visible: boolean;
    stickerSize?: number;
}

const StickerStack: React.FC<StickerStackProps> = ({ stickers, visible, stickerSize = 128 }) => {
    if (!visible || stickers.length === 0) return null;

    return (
        <div className="absolute bottom-0 left-0 right-0 top-0 pointer-events-none z-10 flex items-center justify-center">
            {/* This container aligns with the printer's output in 2D space naturally 
           because the printer is centered. The 'stack' will appear to spill out.
           We need to offset it to match the visual output slot of the isometric printer.
        */}
            <div className="relative translate-y-40 translate-x-0 w-full h-full max-w-4xl mx-auto pointer-events-auto">
                {stickers.map((sticker, index) => (
                    <DraggableSticker
                        key={sticker.id}
                        sticker={sticker}
                        index={index}
                        total={stickers.length}
                        stickerSize={stickerSize}
                    />
                ))}
            </div>
        </div>
    );
};

interface DraggableProps {
    sticker: StickerSegment;
    index: number;
    total: number;
    stickerSize: number;
}

const DraggableSticker: React.FC<DraggableProps> = ({ sticker, index, total, stickerSize }) => {
    // Randomize initial spread slightly for that "pile" look
    const initialRotation = useRef(Math.random() * 30 - 15);
    const initialX = useRef(Math.random() * 40 - 20);
    const initialY = useRef(Math.random() * 40 - 20 + (index * 2)); // slight stacking effect

    const [position, setPosition] = useState({
        x: sticker.originalX !== undefined ? sticker.originalX : initialX.current,
        y: sticker.originalY !== undefined ? sticker.originalY : initialY.current
    });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isHovered, setIsHovered] = useState(false);

    // Sync position with props (for tiling)
    useEffect(() => {
        if (sticker.originalX !== undefined && sticker.originalY !== undefined) {
            setPosition({ x: sticker.originalX, y: sticker.originalY });
        }
    }, [sticker.originalX, sticker.originalY]);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        const link = document.createElement('a');
        link.href = sticker.dataUrl;
        link.download = `${sticker.name}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div
            className="absolute left-1/2 top-1/2 cursor-grab active:cursor-grabbing transition-shadow duration-200"
            style={{
                '--target-x': `${position.x}px`,
                '--target-y': `${position.y}px`,
                '--target-rotation': `${initialRotation.current}deg`,
                '--target-scale': `${isDragging ? 1.1 : 1}`,
                transform: `translate(var(--target-x), var(--target-y)) rotate(var(--target-rotation)) scale(var(--target-scale))`,
                zIndex: isDragging ? 100 : index, // Bring to front when dragging
                opacity: 0,
                animation: `slideOut 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`,
                animationDelay: `${index * 0.1}s` // Stagger animation
            } as React.CSSProperties}
            onMouseDown={handleMouseDown}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div
                className="relative group"
                style={{
                    /* Use a clip-path or just transparent image? The prompt asked for "no border". 
                       PNG has transparency, so just displaying it is fine. 
                       We add a subtle drop shadow to make it pop from the background. */
                    filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))'
                }}
            >
                <img
                    src={sticker.dataUrl}
                    alt={sticker.name}
                    className="object-contain pointer-events-none select-none"
                    style={{ width: stickerSize, height: stickerSize }}
                />

                {/* Hover Actions */}
                <div className={`absolute -top-8 left-1/2 -translate-x-1/2 bg-black/75 text-white px-2 py-1 rounded text-xs whitespace-nowrap transition-opacity ${isHovered || isDragging ? 'opacity-100' : 'opacity-0'}`}>
                    {sticker.name}
                    <div
                        onClick={handleDownload}
                        className="absolute -right-2 -top-2 bg-blue-500 hover:bg-blue-600 rounded-full p-1 cursor-pointer pointer-events-auto"
                    >
                        <Download size={10} />
                    </div>
                </div>
            </div>
            <style>{`
        @keyframes slideOut {
            from {
                transform: translate(0, -35vh) rotate(-6deg) scale(0.5);
                opacity: 0;
            }
            to {
                transform: translate(var(--target-x), var(--target-y)) rotate(var(--target-rotation)) scale(var(--target-scale));
                opacity: 1;
            }
        }
      `}</style>
        </div>
    );
};

export default StickerStack;
