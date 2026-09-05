// On-screen preview iframe dimensions (96dpi) matching a print @page's size
// + orientation, so what's shown actually looks like what will print.
const DIMENSIONS = {
  A4: { portrait: [794, 1123], landscape: [1123, 794] },
  A5: { portrait: [559, 794], landscape: [794, 559] },
};

export const previewIframeStyle = (pageSize = 'A4', orientation = 'portrait') => {
  const [width, minHeight] = (DIMENSIONS[pageSize] || DIMENSIONS.A4)[orientation === 'landscape' ? 'landscape' : 'portrait'];
  return { width: `${width}px`, minHeight: `${minHeight}px`, border: 'none' };
};
