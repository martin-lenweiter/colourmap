export interface SpaceState {
  attention: number; // 0-1
  tone: string[];
  alignment: number; // 0-1
  tensions: string[];
}

export interface UserState {
  health: SpaceState;
  connection: SpaceState;
  purpose: SpaceState;
  energy: number; // 0-1
  clarity: number; // 0-1
}

export interface StateDelta {
  health?: Partial<SpaceState>;
  connection?: Partial<SpaceState>;
  purpose?: Partial<SpaceState>;
  energy?: number;
  clarity?: number;
}

export type SpaceKey = 'health' | 'connection' | 'purpose';

export interface SpaceDrift {
  staleDays: number;
  isDrifting: boolean;
}

export interface DriftInfo {
  health: SpaceDrift;
  connection: SpaceDrift;
  purpose: SpaceDrift;
}

export interface Principle {
  id: string;
  spaceKey: SpaceKey;
  text: string;
  source: 'coach' | 'user';
  confirmed: boolean;
  createdAt: string;
}

export interface FocusItem {
  id: string;
  spaceKey: SpaceKey;
  text: string;
  source: 'coach' | 'user';
  status: 'proposed' | 'active' | 'completed' | 'archived';
  createdAt: string;
  completedAt: string | null;
}

export interface CompassReading {
  id: string;
  narrative: string;
  reinforcements: string[];
  tensions: string[];
  generatedAt: string;
}

export interface Practice {
  id: string;
  spaceKey: SpaceKey;
  title: string;
  suggestedBy: 'coach' | 'user';
  status: 'suggested' | 'active' | 'completed' | 'archived';
  createdAt: string;
}

export interface PatternFlag {
  id: string;
  description: string;
  confidence: number;
  spaceKey: SpaceKey | null;
  status: 'pending' | 'confirmed' | 'dismissed';
  firstObserved: string;
  lastRelevant: string;
  createdAt: string;
}

export interface PatternContext {
  sessionCount: number;
  sessions: SessionPattern[];
}

export interface SessionPattern {
  relativeDate: string;
  dominantSpace: SpaceKey;
  avgAttention: Record<SpaceKey, number>;
  avgAlignment: Record<SpaceKey, number>;
  tones: string[];
  tensions: string[];
}

export interface CoachMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SuggestedFocus {
  space: SpaceKey;
  text: string;
  title?: string;
}

export interface SuggestedPractice {
  space: SpaceKey;
  title: string;
}

export interface SuggestedPrinciple {
  space: SpaceKey;
  text: string;
}

export interface CoachResponse {
  response: string;
  stateDeltas: StateDelta;
  suggestedPractice: SuggestedPractice | null;
  suggestedFocus: SuggestedFocus | null;
  suggestedPrinciple: SuggestedPrinciple | null;
}

export interface UserDataExport {
  exportedAt: string;
  state: UserState | null;
  patternFlags: {
    description: string;
    confidence: number;
    spaceKey: string | null;
    status: string;
    firstObserved: string;
    lastRelevant: string;
  }[];
  sessions: {
    id: string;
    summary: string | null;
    createdAt: string;
    messages: {
      role: string;
      content: string;
      createdAt: string;
    }[];
  }[];
  practices: {
    spaceKey: string;
    title: string;
    status: string;
    createdAt: string;
  }[];
  principles: {
    spaceKey: string;
    text: string;
    confirmed: boolean;
    createdAt: string;
  }[];
  focusItems: {
    spaceKey: string;
    text: string;
    status: string;
    createdAt: string;
  }[];
  compassReadings: {
    narrative: string;
    reinforcements: string[];
    tensions: string[];
    generatedAt: string;
  }[];
}
