// src/trainer/chart.ts
export function linePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return '';
  // Both ends, not one point: a <polyline> with a single point paints nothing, so after
  // the very first session the chart was an empty box under its heading.
  if (values.length === 1) return `0,${height / 2} ${width},${height / 2}`;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  return values
    .map((v, i) => `${Math.round(i * stepX)},${Math.round(height - ((v - min) / span) * height)}`)
    .join(' ');
}
