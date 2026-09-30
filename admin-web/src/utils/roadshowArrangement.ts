export interface PositionedArrangementEntry {
  id: number;
  position_no: number;
  locked: boolean;
}

export interface SectionedArrangementEntry extends PositionedArrangementEntry {
  section: 'regular' | 'halftime';
}

export function updateArrangementDraft<T>(
  current: T[] | null,
  fallback: T[],
  updater: (entries: T[]) => T[],
) {
  return updater(current ?? fallback);
}

export function moveOrSwapFixedPosition<T extends SectionedArrangementEntry>(
  entries: T[],
  sourceId: number,
  targetSection: T['section'],
  targetPosition: number,
) {
  const source = entries.find((entry) => entry.id === sourceId);
  if (!source || source.locked) return { entries, action: 'blocked' as const };
  const target = entries.find((entry) =>
    entry.section === targetSection && entry.position_no === targetPosition,
  );
  if (target?.id === source.id) return { entries, action: 'noop' as const };
  if (target?.locked) return { entries, action: 'blocked' as const };

  const sourceSection = source.section;
  const sourcePosition = source.position_no;
  return {
    entries: entries.map((entry) => {
      if (entry.id === source.id) {
        return { ...entry, section: targetSection, position_no: targetPosition };
      }
      if (target && entry.id === target.id) {
        return { ...entry, section: sourceSection, position_no: sourcePosition };
      }
      return entry;
    }) as T[],
    action: target ? 'swapped' as const : 'moved' as const,
  };
}

export function calculateProjectedCapacity<T extends PositionedArrangementEntry>(
  entries: T[],
  reserveCount: number,
) {
  return Math.max(
    entries.length + Math.max(0, reserveCount),
    0,
    ...entries.map((entry) => entry.position_no),
  );
}

export function calculateRoadshowPositionMinuteOffset(
  section: 'regular' | 'halftime',
  positionNo: number,
  regularTimelineGroupCount: number,
  slotMinutes: number,
  halftimeDelayMinutes: number,
) {
  return section === 'regular'
    ? (positionNo - 1) * slotMinutes
    : regularTimelineGroupCount * slotMinutes
      + halftimeDelayMinutes
      + (positionNo - 1) * slotMinutes;
}

export function sortByPosition<T extends PositionedArrangementEntry>(items: T[]) {
  return [...items].sort((left, right) => left.position_no - right.position_no || left.id - right.id);
}

export function reflowSection<T extends PositionedArrangementEntry>(
  sectionEntries: T[],
  capacity: number,
  unlockedOrder?: number[],
) {
  const locked = sectionEntries.filter((entry) => entry.locked);
  const lockedPositions = new Set(locked.map((entry) => entry.position_no));
  const availablePositions = Array.from({ length: capacity }, (_, index) => index + 1)
    .filter((positionNo) => !lockedPositions.has(positionNo));
  const unlockedMap = new Map(
    sectionEntries.filter((entry) => !entry.locked).map((entry) => [entry.id, entry]),
  );
  const order = unlockedOrder
    ? unlockedOrder.map((id) => unlockedMap.get(id)).filter(Boolean) as T[]
    : sortByPosition([...unlockedMap.values()]);
  const positioned = order.map((entry, index) => ({
    ...entry,
    position_no: availablePositions[index],
  }));
  return sortByPosition([...locked, ...positioned]) as T[];
}

export function placeAtPosition<T extends PositionedArrangementEntry>(
  sectionEntries: T[],
  entryId: number,
  requestedPosition: number,
  capacity: number,
) {
  const source = sectionEntries.find((entry) => entry.id === entryId);
  if (!source || source.locked) {
    return { entries: sortByPosition(sectionEntries), actualPosition: null };
  }

  const lockedPositions = new Set(
    sectionEntries.filter((entry) => entry.locked).map((entry) => entry.position_no),
  );
  const availablePositions = Array.from({ length: capacity }, (_, index) => index + 1)
    .filter((positionNo) => !lockedPositions.has(positionNo));
  const clamped = Math.max(1, Math.min(capacity, Math.round(requestedPosition)));
  const actualPosition = availablePositions.find((positionNo) => positionNo >= clamped)
    ?? availablePositions[availablePositions.length - 1];
  const targetIndex = availablePositions.indexOf(actualPosition);
  const unlockedIds = sortByPosition(sectionEntries)
    .filter((entry) => !entry.locked && entry.id !== entryId)
    .map((entry) => entry.id);
  unlockedIds.splice(targetIndex, 0, entryId);
  return {
    entries: reflowSection(sectionEntries, capacity, unlockedIds),
    actualPosition,
  };
}
