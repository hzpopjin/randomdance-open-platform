export interface RoadshowPositionCapacity {
  approvedRegistrationCount: number;
  reserveCount: number;
  regularCount: number;
  halftimeCount: number;
}

export function calculateRoadshowPositionCapacity(
  approvedRegistrationCount: number,
): RoadshowPositionCapacity {
  const groups = Number.isFinite(approvedRegistrationCount)
    ? Math.max(0, Math.floor(approvedRegistrationCount))
    : 0;
  const reserveCount = groups <= 20 ? 3 : Math.ceil(groups * 0.15);
  return {
    approvedRegistrationCount: groups,
    reserveCount,
    regularCount: groups + reserveCount,
    halftimeCount: reserveCount,
  };
}

export function addMinutes(value: string | Date, minutes: number): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + minutes * 60_000);
}
