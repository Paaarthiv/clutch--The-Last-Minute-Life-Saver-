export interface Task {
  id: string;
  title: string;
  estimated_minutes: number;
  deadline?: string;
  importance: number; // 1-5
  status: "idle" | "done" | "dropped" | "archived";
  createdAt: number;
  parentId?: string;
}

export interface PrioritizedTask extends Task {
  reason: string;
  category: "NOW" | "NEXT" | "LATER";
}

export interface ScheduledBlock {
  taskId: string;
  title: string;
  startTime: string; // "09:00"
  endTime: string;   // "10:00"
}

export interface GoalSubtask {
  title: string;
  estimated_minutes: number;
  order: number;
}

export interface AgentAction {
  id: string;
  timestamp: number;
  description: string;
}

export interface ReplanState {
  message: string;
  keep: string[];
  move: string[];
  drop: string[];
}
