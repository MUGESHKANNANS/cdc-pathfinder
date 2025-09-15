import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: (string | undefined | false | null)[]) {
  return inputs.filter(Boolean).join(' ');
}

// Export a DOM node (Recharts SVG container) as PNG
export async function downloadNodeAsPng(node: HTMLElement, filename: string) {
  const svg = node.querySelector('svg');
  if (!svg) return;
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  const loaded: Promise<void> = new Promise((resolve) => {
    img.onload = () => resolve();
  });
  img.src = svgUrl;
  await loaded;

  const canvas = document.createElement('canvas');
  const bbox = svg.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(bbox.width));
  canvas.height = Math.max(1, Math.floor(bbox.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--background') || '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    URL.revokeObjectURL(svgUrl);
  }, 'image/png');
}
