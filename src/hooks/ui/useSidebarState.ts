import { useState, useEffect, useCallback, useRef } from 'react';

interface SidebarState {
  leftOpen: boolean;
  rightOpen: boolean;
  leftWidth: number;
  rightWidth: number;
}

const STORAGE_KEY = 'sidebar-state';
const DEFAULT_LEFT_WIDTH = 300;
const DEFAULT_RIGHT_WIDTH = 300; // w-75 = 300px
const MIN_WIDTH = 150;
const MAX_WIDTH = 400;

function loadState(): SidebarState {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        leftOpen: isMobile ? false : (parsed.leftOpen ?? true),
        rightOpen: isMobile ? false : (parsed.rightOpen ?? false),
        leftWidth: parsed.leftWidth ?? DEFAULT_LEFT_WIDTH,
        rightWidth: parsed.rightWidth ?? DEFAULT_RIGHT_WIDTH,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return {
    leftOpen: !isMobile,
    rightOpen: false,
    leftWidth: DEFAULT_LEFT_WIDTH,
    rightWidth: DEFAULT_RIGHT_WIDTH,
  };
}

function saveState(state: SidebarState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

export function useSidebarState() {
  const [state, setState] = useState<SidebarState>(loadState);
  const [resizing, setResizing] = useState<'left' | 'right' | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Save to localStorage whenever state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  const toggleLeft = useCallback(() => {
    setState((prev) => ({ ...prev, leftOpen: !prev.leftOpen }));
  }, []);

  const toggleRight = useCallback(() => {
    setState((prev) => ({ ...prev, rightOpen: !prev.rightOpen }));
  }, []);

  const setLeftWidth = useCallback((width: number) => {
    setState((prev) => ({
      ...prev,
      leftWidth: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width)),
    }));
  }, []);

  const setRightWidth = useCallback((width: number) => {
    setState((prev) => ({
      ...prev,
      rightWidth: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width)),
    }));
  }, []);

  const startResizeLeft = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setResizing('left');
    startX.current = e.clientX;
    startWidth.current = state.leftWidth;
  }, [state.leftWidth]);

  const startResizeRight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setResizing('right');
    startX.current = e.clientX;
    startWidth.current = state.rightWidth;
  }, [state.rightWidth]);

  // Handle mouse move and mouse up for resizing
  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (resizing === 'left') {
        const delta = e.clientX - startX.current;
        setLeftWidth(startWidth.current + delta);
      } else if (resizing === 'right') {
        const delta = startX.current - e.clientX;
        setRightWidth(startWidth.current + delta);
      }
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, setLeftWidth, setRightWidth]);

  return {
    leftOpen: state.leftOpen,
    rightOpen: state.rightOpen,
    leftWidth: state.leftWidth,
    rightWidth: state.rightWidth,
    toggleLeft,
    toggleRight,
    startResizeLeft,
    startResizeRight,
    isResizing: resizing !== null,
  };
}
