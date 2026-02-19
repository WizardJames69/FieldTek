export interface DemoScriptItem {
  sceneId: number;
  startTime: number; // milliseconds from start
  duration: number; // milliseconds
  transcript: string;
  audioUrl?: string; // Will be populated with base64 data URL after generation
}

export const demoScript: DemoScriptItem[] = [
  {
    sceneId: 0,
    startTime: 0,
    duration: 12000,
    transcript: "Welcome to FieldTek! Here's a service request coming through your branded portal. Our AI automatically classifies it as high priority, capturing customer details and equipment history instantly. Your team gets notified immediately."
  },
  {
    sceneId: 1,
    startTime: 12000,
    duration: 11000,
    transcript: "Smart scheduling made simple. See all technicians in real-time with their locations and skills. Drag and drop to assign the perfect tech. FieldTek optimizes routes automatically, saving 15-20% on fuel costs."
  },
  {
    sceneId: 2,
    startTime: 23000,
    duration: 11000,
    transcript: "Your technician gets everything on mobile. One-tap navigation, complete customer history, and digital checklists. Everything syncs automatically, even offline."
  },
  {
    sceneId: 3,
    startTime: 34000,
    duration: 13000,
    transcript: "Our AI assistant helps on-site. It searches your equipment manuals and past job history to provide troubleshooting steps and parts recommendations. Like having your best tech available 24/7."
  },
  {
    sceneId: 4,
    startTime: 47000,
    duration: 11000,
    transcript: "Job complete! Invoice auto-generated, customer signs on device, payment processed instantly. From request to payment in one connected system."
  }
];

// Total demo duration in milliseconds
export const TOTAL_DEMO_DURATION = demoScript.reduce((total, item) => total + item.duration, 0);

// Get the script item for a given timestamp
export function getScriptItemAtTime(timeMs: number): DemoScriptItem | null {
  return demoScript.find(
    item => timeMs >= item.startTime && timeMs < item.startTime + item.duration
  ) || null;
}

// Get scene ID for a given timestamp
export function getSceneAtTime(timeMs: number): number {
  const item = getScriptItemAtTime(timeMs);
  return item ? item.sceneId : 0;
}
