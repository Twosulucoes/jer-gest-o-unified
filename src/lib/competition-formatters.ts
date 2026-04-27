
export function formatTimeMs(ms: number, format: 'mm:ss.cc' | 'ss.cc' | 'hh:mm:ss' = 'mm:ss.cc'): string {
  if (ms === null || ms === undefined || isNaN(ms)) return '';
  
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const centiseconds = Math.floor((ms % 1000) / 10);

  const pad = (num: number) => num.toString().padStart(2, '0');

  if (format === 'hh:mm:ss') {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  
  if (format === 'ss.cc') {
    const totalSecs = (ms / 1000).toFixed(2);
    return totalSecs;
  }

  // default mm:ss.cc
  return `${pad(minutes)}:${pad(seconds)}.${pad(centiseconds)}`;
}

export function parseTimeFormatted(value: string): number | null {
  if (!value) return null;
  
  // Handle mm:ss.cc or hh:mm:ss
  const parts = value.split(/[:.]/);
  
  if (parts.length === 3) {
    // mm:ss.cc
    const m = parseInt(parts[0]) || 0;
    const s = parseInt(parts[1]) || 0;
    const c = parseInt(parts[2]) || 0;
    return (m * 60 * 1000) + (s * 1000) + (c * 10);
  }
  
  if (parts.length === 4) {
    // hh:mm:ss.cc (unlikely but possible)
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    const s = parseInt(parts[2]) || 0;
    const c = parseInt(parts[3]) || 0;
    return (h * 3600 * 1000) + (m * 60 * 1000) + (s * 1000) + (c * 10);
  }
  
  // Try simple float (seconds)
  const floatVal = parseFloat(value.replace(',', '.'));
  if (!isNaN(floatVal)) {
    return Math.round(floatVal * 1000);
  }

  return null;
}

export function formatDistanceCm(cm: number): string {
  if (cm === null || cm === undefined || isNaN(cm)) return '';
  const m = Math.floor(cm / 100);
  const remCm = cm % 100;
  return `${m},${remCm.toString().padStart(2, '0')}`;
}

export function parseDistanceFormatted(value: string): number | null {
  if (!value) return null;
  const floatVal = parseFloat(value.replace(',', '.'));
  if (isNaN(floatVal)) return null;
  return Math.round(floatVal * 100);
}
