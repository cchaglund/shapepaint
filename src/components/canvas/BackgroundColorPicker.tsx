export function ColorSwatch({
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

export function BackgroundColorPicker({
  colors,
  selectedIndex,
  onSelect,
}: {
  colors: string[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {colors.map((color, i) => (
        <ColorSwatch
          key={`bg-${i}`}
          color={color}
          selected={selectedIndex === i}
          onClick={() => onSelect(i)}
          small
        />
      ))}
    </div>
  );
}
