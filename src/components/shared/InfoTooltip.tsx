import { useEffect, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import cn from "classnames";
import type { Placement } from '@floating-ui/react';
import {
  useFloating,
  useHover,
  useInteractions,
  offset,
  flip,
  shift,
  FloatingPortal,
} from '@floating-ui/react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  capitalize?: boolean;
  placement?: Placement;
  delay?: number;
  disabled?: boolean;
  gap?: number;
  /** @deprecated Use `content` instead */
  text?: string;
}

export function Tooltip({ content, text, children, capitalize, placement: placementProp = 'top', delay, disabled, gap: gapProp = 8 }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const resolvedContent = content ?? text;

  const { refs, floatingStyles, context } = useFloating({
    open: disabled ? false : isOpen,
    onOpenChange: disabled ? undefined : setIsOpen,
    middleware: [offset(gapProp), flip(), shift()],
    placement: placementProp,
  });

  const hover = useHover(context, { delay: delay ? { open: delay } : undefined });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover]);

  // Ensure tooltip closes when `disabled` flips to true (e.g. a button becomes
  // disabled after a click) — a disabled button won't fire mouseleave, so the
  // internal hover state can remain stuck open otherwise.
  useEffect(() => {
    if (disabled && isOpen) setIsOpen(false);
  }, [disabled, isOpen]);

  // These are callback refs from floating-ui, safe to use during render
  const setReference = refs.setReference;
  const setFloating = refs.setFloating;

  return (
    <>
      <div
        // eslint-disable-next-line react-hooks/refs -- callback ref from floating-ui
        ref={setReference}
        {...getReferenceProps()}
        className="inline-flex h-full"
      >
        {children}
      </div>
      {isOpen && !disabled && (
        <FloatingPortal>
          <div
            // eslint-disable-next-line react-hooks/refs -- callback ref from floating-ui
            ref={setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className={cn(
              "max-w-xs px-2.5 py-1.5 text-xs text-(--color-bg-primary) bg-(--color-text-primary) rounded-(--radius-md) z-50",
              { "capitalize": capitalize }
            )}
          >
            {resolvedContent}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

export function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip content={text}>
      <span
        className="align-middle inline-flex items-center justify-center w-4 h-4 cursor-help text-(--color-text-tertiary) hover:text-(--color-accent) transition-colors"
        aria-label="More information"
      >
        <Info size={16} strokeWidth={1.5} />
      </span>
    </Tooltip>
  );
}
