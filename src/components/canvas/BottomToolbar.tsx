import { motion } from 'motion/react';
import type { DailyChallenge } from '../../types';
import { ShapeIcon } from '../shared/ShapeIcon';
import { ColorSwatch, BackgroundColorPicker } from './BackgroundColorPicker';

function Divider() {
  return <div className="w-px h-6 bg-(--color-border-light) mx-0.5 md:mx-1 shrink-0" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="hidden md:inline text-xs leading-none font-bold uppercase tracking-wide text-(--color-text-tertiary) px-1 shrink-0">
      {children}
    </span>
  );
}

// --- Main component ---

interface BottomToolbarProps {
  challenge: DailyChallenge;
  selectedColorIndex: number;
  backgroundColorIndex: number | null;
  hasSelection: boolean;
  onAddShape: (shapeIndex: number, colorIndex: number) => void;
  onSetSelectedColor: (index: number) => void;
  onSetBackground: (index: number | null) => void;
}

export function BottomToolbar({
  challenge,
  selectedColorIndex,
  backgroundColorIndex,
  hasSelection,
  onAddShape,
  onSetSelectedColor,
  onSetBackground,
}: BottomToolbarProps) {
  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{
        y: 0,
        opacity: 1,
        transition: { type: 'spring', stiffness: 400, damping: 25 },
      }}
      className="flex items-center h-12 gap-1 md:gap-1.5 px-2 md:px-4 backdrop-blur-sm"
      style={{
        background: 'var(--color-card-bg)',
        border: 'var(--border-width, 2px) solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        marginBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Shape add buttons — one per (color, shape) combo, grouped by color */}
      <SectionLabel>Add</SectionLabel>
      <div className="flex items-center gap-1">
        {challenge.colors.map((color, colorIndex) => (
          <div key={`color-group-${colorIndex}`} className="flex items-center gap-1">
            {colorIndex > 0 && <div className="w-px h-4 bg-(--color-border-light) mx-0.5 shrink-0" />}
            {challenge.shapes.map((shape, shapeIndex) => (
              <button
                key={`${colorIndex}-${shape.type}`}
                className="tool-btn-hover w-8.5 h-8.5 flex items-center justify-center overflow-visible cursor-pointer transition-all duration-150 bg-(--color-card-bg) active:scale-90"
                onClick={() => onAddShape(shapeIndex, colorIndex)}
                title={`Add ${shape.name}`}
              >
                <ShapeIcon
                  type={shape.type}
                  size={16}
                  fill={color}
                  stroke="var(--color-border)"
                  strokeWidth={1.5}
                />
              </button>
            ))}
          </div>
        ))}
      </div>

      <Divider />

      {/* Shape color selection — recolors selected shapes (only active when a shape is selected) */}
      <SectionLabel>Change</SectionLabel>
      <div
        className="flex items-center gap-1.5 px-1.5 py-1 rounded-(--radius-md) transition-opacity duration-150"
        style={{
          background: hasSelection ? 'var(--color-selected)' : 'transparent',
          border: `var(--border-width, 2px) solid ${hasSelection ? 'var(--color-border-light)' : 'transparent'}`,
          opacity: hasSelection ? 1 : 0.35,
          pointerEvents: hasSelection ? 'auto' : 'none',
        }}
      >
        {challenge.colors.map((color, i) => (
          <ColorSwatch
            key={`color-${i}`}
            color={color}
            selected={hasSelection && selectedColorIndex === i}
            onClick={() => onSetSelectedColor(i)}
          />
        ))}
      </div>

      <Divider />

      {/* Background color selection */}
      <SectionLabel>Background</SectionLabel>
      <BackgroundColorPicker
        colors={challenge.colors}
        selectedIndex={backgroundColorIndex}
        onSelect={onSetBackground}
      />
    </motion.div>
  );
}
