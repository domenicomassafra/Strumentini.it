import type { PixelFrame } from "../../../engines/image/transform-workspace";
import type { PerspectiveCorners } from "../../../engines/image/advanced-workspace";

export function previewPixelData(canvas: HTMLCanvasElement, frame: PixelFrame): void {
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d");
  if (context === null) return;
  const data = context.createImageData(frame.width, frame.height);
  data.data.set(frame.data);
  context.putImageData(data, 0, 0);
}

export function fullPerspectiveCorners(source: PixelFrame): PerspectiveCorners {
  return {
    topLeft: { x: 0, y: 0 },
    topRight: { x: source.width - 1, y: 0 },
    bottomRight: { x: source.width - 1, y: source.height - 1 },
    bottomLeft: { x: 0, y: source.height - 1 },
  };
}

export function drawPerspectiveBoundary(canvas: HTMLCanvasElement, source: PixelFrame, corners: PerspectiveCorners): void {
  previewPixelData(canvas, source);
  const context = canvas.getContext("2d");
  if (context === null) return;
  const points = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft] as const;
  context.save();
  context.strokeStyle = "#ff2d55";
  context.fillStyle = "#ff2d55";
  context.lineWidth = Math.max(1, Math.min(source.width, source.height) / 250);
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
  context.stroke();
  const radius = Math.max(3, Math.min(source.width, source.height) / 60);
  for (const point of points) {
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}
