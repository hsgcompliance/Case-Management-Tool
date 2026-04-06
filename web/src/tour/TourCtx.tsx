// src/features/tutorial/TourCtx.tsx
import * as React from "react";
const TourCtx = React.createContext<string | undefined>(undefined);

export const TourProvider = React.forwardRef<HTMLDivElement, { tourKey?: string; children: React.ReactNode }>(
  function TourProvider({ tourKey, children }, ref) {
    return (
      <div ref={ref}>
        <TourCtx.Provider value={tourKey}>{children}</TourCtx.Provider>
      </div>
    );
  }
);

export function useTourKey() { return React.useContext(TourCtx); }