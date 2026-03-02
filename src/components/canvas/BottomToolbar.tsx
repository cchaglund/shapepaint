import { motion } from 'motion/react';
import type { DailyChallenge } from '../../types';
import { ShapeIcon } from '../shared/ShapeIcon';

// --- Sub-components ---

function ColorSwatch({
  color,
  selected,
  onClick,
  title,
  small,
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
  title?: string;
  small?: boolean;
}) {
  return (
    <button
      className={`cursor-pointer transition-all duration-150 shrink-0 ${
        small ? 'w-5 h-5 md:w-[22px] md:h-[22px]' : 'w-5 h-5 md:w-6 md:h-6'
      } ${selected ? 'scale-115' : 'hover:scale-105'}`}
      style={{
        backgroundColor: color,
        borderRadius: 'var(--radius-sm)',
        border: selected
          ? 'var(--border-width, 2px) solid var(--color-border)'
          : small
            ? 'var(--border-width, 2px) solid var(--color-border-light)'
            : 'var(--border-width, 2px) solid transparent',
        boxShadow: selected ? 'var(--shadow-btn)' : 'none',
      }}
      onClick={onClick}
      title={title ?? color}
    />
  );
}

function Divider() {
  return <div className="w-px h-6 bg-(--color-border-light) mx-0.5 md:mx-1 shrink-0" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="hidden md:inline text-xs font-bold uppercase tracking-wide text-(--color-text-tertiary) px-1 shrink-0">
      {children}
    </span>
  );
}

// --- Main component ---

interface BottomToolbarProps {
  challenge: DailyChallenge;
  selectedColorIndex: number;
  backgroundColorIndex: number | null;
  selectedColor: string;
  onAddShape: (shapeIndex: number) => void;
  onSetSelectedColor: (index: number) => void;
  onSetBackground: (index: number | null) => void;
}

export function BottomToolbar({
  challenge,
  selectedColorIndex,
  backgroundColorIndex,
  selectedColor,
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
      {/* Shape add buttons */}
      <SectionLabel>Add</SectionLabel>
      <div className="flex items-center gap-1">
        {challenge.shapes.map((shape, i) => (
          <button
            key={shape.type}
            className="w-[34px] h-[34px] flex items-center justify-center rounded-(--radius-sm) cursor-pointer transition-all duration-150 bg-(--color-card-bg) text-(--color-text-secondary) hover:bg-(--color-selected) hover:text-(--color-text-primary) active:scale-90"
            style={{
              border: 'var(--border-width, 2px) solid var(--color-border-light)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.boxShadow = 'var(--shadow-btn)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border-light)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onClick={() => onAddShape(i)}
            title={`Add ${shape.name}`}
          >
            <ShapeIcon
              type={shape.type}
              size={16}
              fill={selectedColor}
              stroke="var(--color-border)"
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>

      <Divider />

      {/* Shape color selection — radio-group style */}
      <SectionLabel>Color</SectionLabel>
      <div
        className="flex items-center gap-1.5 px-1.5 py-1 rounded-(--radius-md)"
        style={{
          background: 'var(--color-selected)',
          border: 'var(--border-width, 2px) solid var(--color-border-light)',
        }}
      >
        {challenge.colors.map((color, i) => (
          <ColorSwatch
            key={`color-${i}`}
            color={color}
            selected={selectedColorIndex === i}
            onClick={() => onSetSelectedColor(i)}
          />
        ))}
      </div>

      <Divider />

      {/* Background color selection */}
      <SectionLabel>Background</SectionLabel>
      {challenge.colors.map((color, i) => (
        <ColorSwatch
          key={`bg-${i}`}
          color={color}
          selected={backgroundColorIndex === i}
          onClick={() => onSetBackground(i)}
          small
        />
      ))}
      <ColorSwatch
        color="#FFFDF7"
        selected={backgroundColorIndex === null}
        onClick={() => onSetBackground(null)}
        title="Default (cream)"
        small
      />
    </motion.div>
  );
}
