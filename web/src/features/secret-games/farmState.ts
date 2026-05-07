export const FARM_PLOT_COUNT = 4;

export const FARM_CROP_DEFINITIONS = {
  carrot: {
    label: "Carrot",
    growthMs: 5_000,
    rewardGold: 3,
  },
  corn: {
    label: "Corn",
    growthMs: 12_000,
    rewardGold: 5,
  },
  pumpkin: {
    label: "Pumpkin",
    growthMs: 20_000,
    rewardGold: 8,
  },
} as const;

export type FarmCropId = keyof typeof FARM_CROP_DEFINITIONS;

export type FarmPlotState = {
  id: string;
  plantedCrop: FarmCropId | null;
  plantedAt: number | null;
};

export type FarmState = {
  gold: number;
  unlockedPlots: number;
  speedLevel: number;
  yieldLevel: number;
  plots: FarmPlotState[];
  lastUpdatedAt: number;
};

export type FarmPlotStatus = "locked" | "empty" | "growing" | "ready";

export type FarmPlotView = FarmPlotState & {
  status: FarmPlotStatus;
  readyAt: number | null;
  progress: number;
  rewardGold: number;
};

export function createInitialFarmState(now: number): FarmState {
  return {
    gold: 10,
    unlockedPlots: 2,
    speedLevel: 0,
    yieldLevel: 0,
    plots: Array.from({ length: FARM_PLOT_COUNT }, (_, index) => ({
      id: `plot-${index + 1}`,
      plantedCrop: null,
      plantedAt: null,
    })),
    lastUpdatedAt: now,
  };
}

export function getFarmUnlockCost(unlockedPlots: number): number {
  return 8 + unlockedPlots * 4;
}

export function getFarmSpeedUpgradeCost(speedLevel: number): number {
  return 10 + speedLevel * 6;
}

export function getFarmYieldUpgradeCost(yieldLevel: number): number {
  return 12 + yieldLevel * 6;
}

export function getFarmCropGrowthMs(cropId: FarmCropId, speedLevel: number): number {
  const base = FARM_CROP_DEFINITIONS[cropId].growthMs;
  return Math.max(3_000, Math.round(base / (1 + speedLevel * 0.35)));
}

export function getFarmCropReward(cropId: FarmCropId, yieldLevel: number): number {
  return FARM_CROP_DEFINITIONS[cropId].rewardGold + yieldLevel * 2;
}

export function getFarmPlotViews(state: FarmState, now: number): FarmPlotView[] {
  return state.plots.map((plot, index) => {
    if (index >= state.unlockedPlots) {
      return {
        ...plot,
        status: "locked",
        readyAt: null,
        progress: 0,
        rewardGold: 0,
      };
    }

    if (!plot.plantedCrop || !plot.plantedAt) {
      return {
        ...plot,
        status: "empty",
        readyAt: null,
        progress: 0,
        rewardGold: 0,
      };
    }

    const growthMs = getFarmCropGrowthMs(plot.plantedCrop, state.speedLevel);
    const readyAt = plot.plantedAt + growthMs;
    const rewardGold = getFarmCropReward(plot.plantedCrop, state.yieldLevel);
    const progress = Math.max(0, Math.min(1, (now - plot.plantedAt) / growthMs));

    return {
      ...plot,
      status: now >= readyAt ? "ready" : "growing",
      readyAt,
      progress,
      rewardGold,
    };
  });
}

export function plantFarmCrop(args: {
  state: FarmState;
  plotId: string;
  cropId: FarmCropId;
  now: number;
}): FarmState {
  const plotIndex = args.state.plots.findIndex((plot) => plot.id === args.plotId);
  if (plotIndex < 0 || plotIndex >= args.state.unlockedPlots) return args.state;

  const plot = args.state.plots[plotIndex];
  if (plot.plantedCrop) return args.state;

  return {
    ...args.state,
    lastUpdatedAt: args.now,
    plots: args.state.plots.map((candidate) =>
      candidate.id === args.plotId
        ? {
            ...candidate,
            plantedCrop: args.cropId,
            plantedAt: args.now,
          }
        : candidate,
    ),
  };
}

export function harvestFarmPlot(args: {
  state: FarmState;
  plotId: string;
  now: number;
}): FarmState {
  const plot = args.state.plots.find((candidate) => candidate.id === args.plotId);
  if (!plot?.plantedCrop || !plot.plantedAt) return args.state;

  const readyAt = plot.plantedAt + getFarmCropGrowthMs(plot.plantedCrop, args.state.speedLevel);
  if (args.now < readyAt) return args.state;

  return {
    ...args.state,
    gold: args.state.gold + getFarmCropReward(plot.plantedCrop, args.state.yieldLevel),
    lastUpdatedAt: args.now,
    plots: args.state.plots.map((candidate) =>
      candidate.id === args.plotId
        ? {
            ...candidate,
            plantedCrop: null,
            plantedAt: null,
          }
        : candidate,
    ),
  };
}

export function unlockFarmPlot(state: FarmState, now: number): FarmState {
  if (state.unlockedPlots >= FARM_PLOT_COUNT) return state;
  const cost = getFarmUnlockCost(state.unlockedPlots);
  if (state.gold < cost) return state;

  return {
    ...state,
    gold: state.gold - cost,
    unlockedPlots: state.unlockedPlots + 1,
    lastUpdatedAt: now,
  };
}

export function upgradeFarmSpeed(state: FarmState, now: number): FarmState {
  const cost = getFarmSpeedUpgradeCost(state.speedLevel);
  if (state.gold < cost) return state;

  return {
    ...state,
    gold: state.gold - cost,
    speedLevel: state.speedLevel + 1,
    lastUpdatedAt: now,
  };
}

export function upgradeFarmYield(state: FarmState, now: number): FarmState {
  const cost = getFarmYieldUpgradeCost(state.yieldLevel);
  if (state.gold < cost) return state;

  return {
    ...state,
    gold: state.gold - cost,
    yieldLevel: state.yieldLevel + 1,
    lastUpdatedAt: now,
  };
}
