import type { RefObject } from 'react';
import type { Shape, ShapeGroup } from '../../types';
import { CANVAS_SIZE } from '../../types/canvas';
import { SVGShape } from '../shared/SVGShape';
import { getVisibleShapes } from '../../utils/visibility';

interface SubmissionCanvasProps {
  shapes: Shape[];
  groups?: ShapeGroup[];
  backgroundColor?: string | null;
  svgRef: RefObject<SVGSVGElement | null>;
}

export function SubmissionCanvas({
  shapes,
  groups = [],
  backgroundColor,
  svgRef,
}: SubmissionCanvasProps) {
  const sortedShapes = [...getVisibleShapes(shapes, groups)].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <svg
      ref={svgRef}
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
      className="max-w-full h-auto"
    >
      <rect
        x={0}
        y={0}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        fill={backgroundColor ?? '#ffffff'}
      />
      {sortedShapes.map((shape) => (
        <SVGShape
          key={shape.id}
          type={shape.type}
          size={shape.size}
          x={shape.x}
          y={shape.y}
          rotation={shape.rotation}
          flipX={shape.flipX}
          flipY={shape.flipY}
          color={shape.color ?? '#000000'}
        />
      ))}
    </svg>
  );
}
