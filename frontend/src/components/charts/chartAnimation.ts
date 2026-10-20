import { createContext } from 'react';

// False while a chart is captured into an image for a PDF (lib/chartCapture.ts): an animated
// Recharts chart would be snapshotted mid-animation (bars still growing, value labels not yet
// drawn), so captures turn animation off and the chart is complete on its first paint.
export const ChartAnimationContext = createContext(true);
