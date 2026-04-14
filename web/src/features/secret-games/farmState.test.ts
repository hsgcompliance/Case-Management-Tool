import { describe, expect, it } from "vitest";
import {
  createInitialFarmState,
  getFarmPlotViews,
  harvestFarmPlot,
  plantFarmCrop,
  unlockFarmPlot,
  upgradeFarmSpeed,
  upgradeFarmYield,
} from "./farmState";

describe("farm state", () => {
  it("starts with one unlocked plot and sandbox seed gold", () => {
    const state = createInitialFarmState(1000);
    expect(state.unlockedPlots).toBe(1);
    expect(state.gold).toBe(6);
    expect(state.plots).toHaveLength(4);
  });

  it("plants and harvests a crop with persistent rewards", () => {
    const planted = plantFarmCrop({
      state: createInitialFarmState(1000),
      plotId: "plot-1",
      cropId: "carrot",
      now: 1000,
    });

    const beforeReady = getFarmPlotViews(planted, 4000);
    expect(beforeReady[0].status).toBe("growing");

    const harvested = harvestFarmPlot({
      state: planted,
      plotId: "plot-1",
      now: 10_000,
    });

    expect(harvested.gold).toBeGreaterThan(planted.gold);
    expect(getFarmPlotViews(harvested, 10_000)[0].status).toBe("empty");
  });

  it("spends gold on plot and upgrade progression", () => {
    const seeded = {
      ...createInitialFarmState(1000),
      gold: 40,
    };

    const unlocked = unlockFarmPlot(seeded, 2000);
    const spedUp = upgradeFarmSpeed(unlocked, 3000);
    const improvedYield = upgradeFarmYield(spedUp, 4000);

    expect(unlocked.unlockedPlots).toBe(2);
    expect(spedUp.speedLevel).toBe(1);
    expect(improvedYield.yieldLevel).toBe(1);
    expect(improvedYield.gold).toBeLessThan(seeded.gold);
  });
});
