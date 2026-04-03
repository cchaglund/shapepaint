import { useState } from 'react';
import { motion } from 'motion/react';
import type { Shape } from '../../types';
import { getShapeDimensions } from '../../utils/shapes';
import { SVGShape } from '../shared/SVGShape';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface ShapeElementProps {
  shape: Shape;
  color: string;
  isSelected: boolean;
  locked?: boolean;
  animateEntrance?: boolean;
}

export function ShapeElement({
  shape,
  color,
  locked,
  animateEntrance,
}: ShapeElementProps) {
  // Latch: once we decide to animate on mount, keep animating until complete.
  // This prevents re-renders (e.g. auto-select) from unmounting motion.g mid-animation.
  const [animating, setAnimating] = useState(
    () => !!animateEntrance && !prefersReducedMotion
  );

  const svgShape = (
    <SVGShape
      type={shape.type}
      size={shape.size}
      x={shape.x}
      y={shape.y}
      rotation={shape.rotation}
      flipX={shape.flipX}
      flipY={shape.flipY}
      color={color}
      style={{ cursor: locked ? 'default' : 'move' }}
      dataShapeId={shape.id}
    />
  );

  if (!animating) return svgShape;

  // Scale from center of shape in SVG coordinates
  const dims = getShapeDimensions(shape.type, shape.size);
  const cx = shape.x + dims.width / 2;
  const cy = shape.y + dims.height / 2;

  return (
    <motion.g
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15, mass: 0.8 }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
      onAnimationComplete={() => setAnimating(false)}
    >
      {svgShape}
    </motion.g>
  );
}
