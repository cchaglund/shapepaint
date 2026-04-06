import type { CSSProperties } from 'react';
import type { ShapeType } from '../../types';
import { getShapeSVGData } from '../../utils/shapes';

interface SVGShapeProps {
  type: ShapeType;
  size: number;
  x: number;
  y: number;
  rotation: number;
  flipX?: boolean;
  flipY?: boolean;
  color: string;
  style?: CSSProperties;
  dataShapeId?: string;
}

/**
 * Renders a single SVG shape element (ellipse/rect/polygon/path)
 * with position, rotation, and flip transforms applied via a <g> wrapper.
 */
export function SVGShape({
  type,
  size,
  x,
  y,
  rotation,
  flipX,
  flipY,
  color,
  style,
  dataShapeId,
}: SVGShapeProps) {
  const { element, props, viewBox, dimensions } = getShapeSVGData(type, size);

  // dimensions = intended render size; viewBox = path coordinate space
  // When they differ (fixed Figma exports), a nested <svg> handles the scaling
  const renderW = dimensions?.width ?? viewBox.width;
  const renderH = dimensions?.height ?? viewBox.height;
  const centerX = renderW / 2;
  const centerY = renderH / 2;
  const scaleX = flipX ? -1 : 1;
  const scaleY = flipY ? -1 : 1;

  const transform = `translate(${x}, ${y}) translate(${centerX}, ${centerY}) scale(${scaleX}, ${scaleY}) translate(${-centerX}, ${-centerY}) rotate(${rotation}, ${centerX}, ${centerY})`;

  // Tiny stroke matching fill closes hairline anti-aliasing gaps on iOS Safari
  const fillProps = { fill: color, stroke: color, strokeWidth: 0.5, style };

  const shapeElement = (
    <>
      {element === 'ellipse' && <ellipse {...props} {...fillProps} />}
      {element === 'rect' && <rect {...props} {...fillProps} />}
      {element === 'polygon' && <polygon {...props} {...fillProps} />}
      {element === 'path' && <path {...props} {...fillProps} />}
    </>
  );

  return (
    <g transform={transform} data-shape-id={dataShapeId}>
      {dimensions ? (
        <svg
          x={0} y={0}
          width={renderW} height={renderH}
          viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
          overflow="visible"
        >
          {shapeElement}
        </svg>
      ) : (
        shapeElement
      )}
    </g>
  );
}
