import type { Shape, ShapeGroup } from '../../types';
import { CANVAS_SIZE } from '../../types/canvas';
import { SVGShape } from './SVGShape';
import { getVisibleShapes } from '../../utils/visibility';

interface SubmissionThumbnailProps {
  shapes: Shape[];
  groups?: ShapeGroup[];
  backgroundColor?: string | null;
  size?: number;
  fill?: boolean;
}

export function SubmissionThumbnail({
  shapes,
  groups = [],
  backgroundColor,
  size = 100,
  fill = false,
}: SubmissionThumbnailProps) {
  const sortedShapes = [...getVisibleShapes(shapes, groups)].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <svg
      data-testid="submission-thumbnail"
      width={fill ? '100%' : size}
      height={fill ? '100%' : size}
      viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
      className={fill ? '' : 'rounded-(--radius-sm)'}
      style={fill ? { display: 'block', width: '100%', height: 'auto' } : undefined}
    >
      <rect x={0} y={0} width={CANVAS_SIZE} height={CANVAS_SIZE} fill={backgroundColor ?? '#ffffff'} />
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
