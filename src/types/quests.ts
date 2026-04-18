export interface EpicQuestStage {
  index: number;
  title: string;
  description: string;
  requiredTasks: number;
  completedTasks: number;
  taskCategory: string[];
  reward: {
    crystals: number;
    xp: number;
    item?: string;
    skill?: string;
  };
  accumulatedXP: number;
  accumulatedCrystals: number;
  completed?: boolean;
}

export interface EpicQuest {
  id: string;
  title: string;
  description: string;
  category: "warrior" | "mage" | "explorer" | "artisan" | "guardian" | "mixed";
  totalStages: number;
  currentStage: number;
  isActive: boolean;
  isPaused: boolean;
  createdAt: string;
  deadline?: string;
  stages: EpicQuestStage[];
  savePoint: {
    lastActiveDate: string;
    totalProgress: number;
  };
}

export interface WeeklyChallengeItem {
  id: string;
  title: string;
  description: string;
  type: "fixed" | "random";
  requirement: {
    count?: number;
    category?: string;
    difficulty?: "easy" | "medium" | "hard";
    totalHours?: number;
  };
  progress: number;
  target: number;
  completed: boolean;
  reward: {
    crystals: number;
    type: "small" | "medium" | "large";
  };
}

export interface WeeklyChallenge {
  weekId: string;
  weekNumber: number;
  theme: string;
  startDate: string;
  endDate: string;
  challenges: WeeklyChallengeItem[];
  completedSlots: number[];
  claimedRewards: string[];
  isCurrent: boolean;
}

export interface MonthlyMilestone {
  monthId: string;
  monthName: string;
  title: string;
  theme: "growth" | "challenge" | "rest" | "social";
  milestones: {
    weekIndex: number;
    title: string;
    description: string;
    requirements: {
      taskCount?: number;
      taskCategory?: string;
      totalHours?: number;
      specificAchievement?: string;
    };
    progress: number;
    target: number;
    completed: boolean;
    reward: {
      title: string;
      type: "title" | "equipment" | "skill" | "stat";
      value: string;
    };
  }[];
  currentWeek: number;
  totalProgress: number;
}
