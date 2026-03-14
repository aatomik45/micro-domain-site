import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, AlertTriangle, HelpCircle, Link2, Copy, RotateCcw, Check, Info, Loader2, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from "lucide-react";
import { saveDomain, loadDomainByKey, type DomainRecord } from "@/lib/api";

/* ── Types ─────────────────────────────────────────────────── */

type RoadNetwork = "none" | "unpaved" | "paved";

interface FormData {
  domainName: string;
  rulerName: string;
  rulerSkill: string;
  magistrateName: string;
  magistrateSkill: string;
  roadNetwork: RoadNetwork;
}

type FertilityDice = "" | "D4" | "D6" | "D8" | "D10" | "D12";

interface LandArea {
  id: number;
  area: string;
  size: string;
  settlement: string;
  linkedSettlement: string;
  constructionComplete: boolean;
  constructionNote: string;
  population: string;
  fertilityDice: FertilityDice;
  income: string;
  samurais: string;
  ashigurus: string;
  highlanders: string;
  other: string;
  /** Group ID for multi-area settlements. All rows in the same group share this ID. */
  groupId?: string;
  /** Whether this row is the primary (first) row of a grouped settlement. */
  isGroupPrimary?: boolean;
  /** IDs of linked Tenant Village rows (used by Agricultural Villa). */
  linkedVillageIds?: number[];
  /** If true, this is a Custom Land Area with fully editable fields. */
  isCustom?: boolean;
}

/* ── Settlement Configuration ──────────────────────────────── */

interface SettlementConfig {
  population: string;
  samurais: string;
  ashigurus: string;
  highlanders: string;
  minFertility: FertilityDice | null; // null = no requirement
  incomeByDice: Record<string, string>;
  /** Number of areas required (default 1). */
  requiredAreas?: number;
  /** If true, income is fixed regardless of dice. */
  fixedIncome?: boolean;
  /** If true, settlement requires a road network (unpaved or paved). */
  requiresRoadNetwork?: boolean;
  /** Number of linked Tenant Villages required. */
  requiredLinkedVillages?: number;
  /** If set, only these exact dice values are allowed (overrides minFertility for validation). */
  allowedDice?: FertilityDice[];
  /** If set, these settlement types are eligible for linking (instead of only "Tenant Village"). */
  eligibleLinkedSettlements?: string[];
}

const SETTLEMENT_CONFIGS: Record<string, SettlementConfig> = {
  "Tenant Village": {
    population: "250",
    samurais: "1",
    ashigurus: "2",
    highlanders: "0",
    minFertility: "D6",
    incomeByDice: {
      D6: "35 GD",
      D8: "45 GD",
      D10: "55 GD",
      D12: "75 GD",
    },
  },
  "Military Village": {
    population: "250",
    samurais: "3",
    ashigurus: "5",
    highlanders: "0",
    minFertility: "D6",
    incomeByDice: {
      D6: "0 GD",
      D8: "0 GD",
      D10: "0 GD",
      D12: "0 GD",
    },
  },
  "Production Village": {
    population: "250",
    samurais: "1",
    ashigurus: "2",
    highlanders: "0",
    minFertility: "D4",
    incomeByDice: {
      D4: "60 GD",
      D6: "60 GD",
      D8: "60 GD",
      D10: "60 GD",
      D12: "60 GD",
    },
  },
  "Mountain Tauric Permaculture Village": {
    population: "250",
    samurais: "0",
    ashigurus: "0",
    highlanders: "20",
    minFertility: null, // no fertility requirement
    fixedIncome: true,
    requiredAreas: 4,
    incomeByDice: {
      "": "50 GD",
      D4: "50 GD",
      D6: "50 GD",
      D8: "50 GD",
      D10: "50 GD",
      D12: "50 GD",
    },
  },
  "Agricultural Villa": {
    population: "0",
    samurais: "0",
    ashigurus: "0",
    highlanders: "0",
    minFertility: "D6",
    incomeByDice: {
      D6: "55 GD",
      D8: "80 GD",
      D10: "100 GD",
      D12: "115 GD",
    },
    /** Requires road network and 2 linked Tenant Villages (handled via custom validation). */
    requiresRoadNetwork: true,
    requiredLinkedVillages: 2,
  },
  "Vineyard": {
    population: "0",
    samurais: "0",
    ashigurus: "0",
    highlanders: "0",
    minFertility: "D6",
    incomeByDice: {
      D6: "175 GD",
      D8: "275 GD",
      D10: "375 GD",
      D12: "410 GD",
    },
    requiresRoadNetwork: true,
    requiredLinkedVillages: 2,
  },
  "Tobacco Plantation": {
    population: "0",
    samurais: "0",
    ashigurus: "0",
    highlanders: "0",
    minFertility: "D10",
    fixedIncome: true,
    incomeByDice: {
      D10: "1500 GD",
      D12: "1500 GD",
    },
    requiresRoadNetwork: true,
    requiredLinkedVillages: 2,
  },
  "Horse Breeding Villa": {
    population: "0",
    samurais: "0",
    ashigurus: "0",
    highlanders: "0",
    minFertility: "D6",
    fixedIncome: true,
    requiredAreas: 4,
    incomeByDice: {
      D6: "400 GD",
      D8: "400 GD",
      D10: "400 GD",
      D12: "400 GD",
    },
    requiredLinkedVillages: 1,
  },
  "Olive Plantation": {
    population: "0",
    samurais: "0",
    ashigurus: "0",
    highlanders: "0",
    minFertility: "D6",
    allowedDice: ["D6", "D8"],
    incomeByDice: {
      D6: "250 GD",
      D8: "350 GD",
    },
    requiresRoadNetwork: true,
    requiredLinkedVillages: 2,
  },
  "Cotton Plantation": {
    population: "0",
    samurais: "0",
    ashigurus: "0",
    highlanders: "0",
    minFertility: "D8",
    allowedDice: ["D8", "D10"],
    fixedIncome: true,
    incomeByDice: {
      D8: "440 GD",
      D10: "440 GD",
    },
    requiresRoadNetwork: true,
    requiredLinkedVillages: 4,
  },
  "Tauric Ibex-Ranch (D4)": {
    population: "0",
    samurais: "0",
    ashigurus: "0",
    highlanders: "0",
    minFertility: "D4",
    allowedDice: ["D4"],
    fixedIncome: true,
    requiredAreas: 8,
    incomeByDice: {
      D4: "200 GD",
    },
    requiredLinkedVillages: 1,
    eligibleLinkedSettlements: ["Tenant Village", "Mountain Tauric Permaculture Village"],
  },
  "Tauric Ibex-Ranch (D6+)": {
    population: "0",
    samurais: "0",
    ashigurus: "0",
    highlanders: "0",
    minFertility: "D6",
    fixedIncome: true,
    incomeByDice: {
      D6: "200 GD",
      D8: "200 GD",
      D10: "200 GD",
      D12: "200 GD",
    },
    requiredLinkedVillages: 1,
    eligibleLinkedSettlements: ["Tenant Village", "Mountain Tauric Permaculture Village"],
  },
};

const DICE_RANK: Record<string, number> = {
  D4: 4,
  D6: 6,
  D8: 8,
  D10: 10,
  D12: 12,
};

/** Check if the selected dice meets the settlement's minimum requirement. */
function isFertilityMet(
  settlement: string,
  dice: FertilityDice
): boolean {
  const config = SETTLEMENT_CONFIGS[settlement];
  if (!config || !config.minFertility) return true;
  if (dice === "") return false; // no dice selected = not met
  // If allowedDice is set, only those exact values are valid
  if (config.allowedDice) {
    return config.allowedDice.includes(dice);
  }
  const minRank = DICE_RANK[config.minFertility] ?? 0;
  const currentRank = DICE_RANK[dice] ?? 0;
  return currentRank >= minRank;
}

/** Determine if a settlement row is in an invalid state (fertility-based). */
function isSettlementRowInvalid(
  settlement: string,
  dice: FertilityDice
): boolean {
  const config = SETTLEMENT_CONFIGS[settlement];
  if (!config) return false; // no settlement = no validation
  // Multi-area settlements: each row needs dice selected AND must meet minimum fertility
  if (config.requiredAreas && config.requiredAreas > 1) {
    if (dice === "") return true;
    // If the settlement has a minimum fertility requirement, check it per-row
    if (config.minFertility) {
      return !isFertilityMet(settlement, dice);
    }
    return false;
  }
  return !isFertilityMet(settlement, dice);
}

/** Get the appropriate tooltip for the fertility dice error. */
function getFertilityTooltip(
  settlement: string,
  dice: FertilityDice
): string | undefined {
  const config = SETTLEMENT_CONFIGS[settlement];
  if (!config) return undefined;
  // Multi-area settlements: show tooltip if dice is missing or below minimum
  if (config.requiredAreas && config.requiredAreas > 1) {
    if (dice === "") return "Please select a Fertility Dice value.";
    if (!isFertilityMet(settlement, dice)) {
      if (config.allowedDice) {
        return `${settlement} requires Fertility Dice ${config.allowedDice.join(" or ")} on all ${config.requiredAreas} Areas.`;
      }
      if (config.minFertility) {
        return `${settlement} requires Fertility Dice ${config.minFertility} or higher on all ${config.requiredAreas} Areas.`;
      }
    }
    return undefined;
  }
  if (dice === "") return "Please select a Fertility Dice value.";
  if (!isFertilityMet(settlement, dice)) {
    if (config.allowedDice) {
      return `${settlement} requires Fertility Dice ${config.allowedDice.join(" or ")}.`;
    }
    return `${settlement} requires Fertility Dice ${config.minFertility ?? "D6"} or higher.`;
  }
  return undefined;
}

function getIncome(settlement: string, dice: FertilityDice): string {
  const config = SETTLEMENT_CONFIGS[settlement];
  if (!config) return "-";
  if (config.fixedIncome) {
    // For fixed-income settlements that also have a minFertility, check dice validity
    if (config.minFertility) {
      if (dice === "") return "-";
      if (!isFertilityMet(settlement, dice)) return "-";
    }
    return config.incomeByDice[""] ?? config.incomeByDice[dice] ?? "50 GD";
  }
  if (dice === "") return "-";
  if (!isFertilityMet(settlement, dice)) return "-";
  return config.incomeByDice[dice] ?? "-";
}

function getPopulation(settlement: string, _dice: FertilityDice): string {
  const config = SETTLEMENT_CONFIGS[settlement];
  if (!config) return "-";
  // For multi-area settlements, population is always the config value (validation handled at display level)
  return config.population;
}

function getMilitary(settlement: string, _dice: FertilityDice): {
  samurais: string;
  ashigurus: string;
  highlanders: string;
  other: string;
} {
  const config = SETTLEMENT_CONFIGS[settlement];
  if (!config) return { samurais: "-", ashigurus: "-", highlanders: "-", other: "-" };
  return {
    samurais: config.samurais,
    ashigurus: config.ashigurus,
    highlanders: config.highlanders,
    other: "-",
  };
}

function isRowFree(row: LandArea): boolean {
  return row.settlement === "-" && !row.groupId && !row.isCustom;
}

/** Generate a unique group ID. */
function generateGroupId(): string {
  return "grp_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ── Shared Components ─────────────────────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[13px] font-semibold text-[#D4A574] tracking-[0.06em] uppercase mb-1.5">
      {children}
    </h2>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-[#8A95A0] mb-1">
      {children}
    </span>
  );
}

function FieldLabelWithInfo({
  children,
  tooltip,
}: {
  children: React.ReactNode;
  tooltip: string;
}) {
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#8A95A0] mb-1">
      {children}
      <span className="group/info relative shrink-0 cursor-default">
        <Info className="w-3 h-3 text-[#6B7580]" />
        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-30 hidden group-hover/info:flex">
          <span className="relative whitespace-nowrap rounded bg-[#3A4250] border border-[#4A5568] px-2.5 py-1 text-[11px] normal-case tracking-normal font-normal text-[#F0EDE8] shadow-lg">
            {tooltip}
            <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-[#4A5568]" />
          </span>
        </span>
      </span>
    </span>
  );
}

/* ── Confirmation Modal ────────────────────────────────────── */

function ConfirmDeleteModal({
  areaName,
  onConfirm,
  onCancel,
}: {
  areaName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative bg-[#262D35] border border-[#4A5568] rounded-md shadow-2xl px-6 py-5 max-w-[340px] w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
        <p className="text-[13px] text-[#F0EDE8] leading-relaxed">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-[#D4A574]">{areaName}</span>?
        </p>
        <div className="flex items-center gap-2 mt-4">
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-8 text-[12px] font-medium rounded-sm bg-[#3A4250] text-[#A8B0B8] hover:bg-[#4A5568] hover:text-[#F0EDE8] transition-colors border border-[#4A5568]"
          >
            Yes, delete
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-8 text-[12px] font-medium rounded-sm bg-[#8B3838] text-[#F0EDE8] hover:bg-[#A04848] transition-colors"
          >
            No, do not delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Fertility Dice Selector ───────────────────────────────── */

const DICE_OPTIONS: FertilityDice[] = ["D4", "D6", "D8", "D10", "D12"];

function FertilitySelector({
  value,
  onSelect,
}: {
  value: FertilityDice;
  onSelect: (d: FertilityDice) => void;
  hasWarning?: boolean;
  warningTooltip?: string;
}) {
  return (
    <div className="flex items-center gap-0.5 flex-nowrap">
      {DICE_OPTIONS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onSelect(value === d ? "" : d)}
          className={`px-1.5 py-0.5 text-[10px] rounded-sm border transition-colors leading-tight shrink-0 ${
            value === d
              ? "bg-[#D4A574] text-[#141820] border-[#D4A574] font-semibold"
              : "bg-transparent text-[#8A95A0] border-[#4A5568] hover:border-[#6B7580] hover:text-[#B8C0C8]"
          }`}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

/* ── Construction Ready Cell ───────────────────────────────── */

function ConstructionReadyCell({
  complete,
  note,
  onToggle,
  onNoteChange,
}: {
  complete: boolean;
  note: string;
  onToggle: (checked: boolean) => void;
  onNoteChange: (v: string) => void;
}) {
  return (
    <div className="flex items-start gap-1.5" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
      <Checkbox
        checked={complete}
        onCheckedChange={(checked) => onToggle(!!checked)}
        className="h-3.5 w-3.5 shrink-0 border-[#5A6577] data-[state=checked]:bg-[#D4A574] data-[state=checked]:border-[#D4A574] data-[state=checked]:text-[#141820] rounded-sm mt-px"
      />
      {complete ? (
        <span className="text-[11px] text-[#D4A574] font-medium" style={{ whiteSpace: "normal", overflowWrap: "break-word" }}>
          Complete
        </span>
      ) : (
        <input
          type="text"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="note..."
          className="w-full min-w-0 bg-transparent border-0 text-[11px] text-[#F0EDE8] placeholder:text-[#505A64] h-auto p-0 focus:ring-0 outline-none"
        />
      )}
    </div>
  );
}

/* ── Settlement Display Names ──────────────────────────────── */

/** Compute sequential numbered display names per settlement type. */
function getSettlementDisplayNames(areas: LandArea[]): Map<number, string> {
  const counters: Record<string, number> = {};
  const result = new Map<number, string>();
  // Track which groupIds we've already counted
  const countedGroups = new Set<string>();
  for (const row of areas) {
    if (row.settlement === "-") {
      result.set(row.id, "-");
    } else if (row.groupId && !row.isGroupPrimary) {
      // Secondary grouped row — use the same display name as the primary
      // We'll set this in a second pass
      result.set(row.id, row.settlement);
    } else {
      // Primary row or non-grouped row
      const groupKey = row.groupId || `single_${row.id}`;
      if (!countedGroups.has(groupKey)) {
        countedGroups.add(groupKey);
        counters[row.settlement] = (counters[row.settlement] ?? 0) + 1;
      }
      result.set(row.id, `${row.settlement} ${counters[row.settlement]}`);
    }
  }
  // Second pass: assign display names for secondary grouped rows
  for (const row of areas) {
    if (row.groupId && !row.isGroupPrimary) {
      const primary = areas.find((r) => r.groupId === row.groupId && r.isGroupPrimary);
      if (primary) {
        result.set(row.id, result.get(primary.id) ?? row.settlement);
      }
    }
  }
  return result;
}

/* ── Group Analysis Helpers ────────────────────────────────── */

interface GroupInfo {
  groupId: string;
  primaryId: number;
  memberIds: number[];
  settlement: string;
  /** Whether the primary row has an area-count validation error. */
  isInvalid: boolean;
}

/** Build a map of groupId -> GroupInfo from the areas array. */
function buildGroupMap(areas: LandArea[]): Map<string, GroupInfo> {
  const map = new Map<string, GroupInfo>();
  for (const row of areas) {
    if (!row.groupId) continue;
    let info = map.get(row.groupId);
    if (!info) {
      info = {
        groupId: row.groupId,
        primaryId: row.id,
        memberIds: [],
        settlement: row.settlement,
        isInvalid: false,
      };
      map.set(row.groupId, info);
    }
    info.memberIds.push(row.id);
    if (row.isGroupPrimary) {
      info.primaryId = row.id;
      info.settlement = row.settlement;
    }
  }
  return map;
}

/** For a given row in a group, determine its position (0-based) within the group. */
function getGroupRowPosition(areas: LandArea[], row: LandArea): { position: number; total: number } {
  if (!row.groupId) return { position: 0, total: 1 };
  const groupRows = areas.filter((r) => r.groupId === row.groupId);
  const position = groupRows.findIndex((r) => r.id === row.id);
  return { position: position >= 0 ? position : 0, total: groupRows.length };
}

/* ── Land Areas Table ──────────────────────────────────────── */

const SETTLEMENT_OPTIONS = ["-", "Tenant Village", "Military Village", "Production Village", "Mountain Tauric Permaculture Village", "Agricultural Villa", "Horse Breeding Villa", "Olive Plantation", "Cotton Plantation", "Tobacco Plantation", "Vineyard", "Tauric Ibex-Ranch (D4)", "Tauric Ibex-Ranch (D6+)"];
const LINKED_SETTLEMENT_OPTIONS = ["-"];

/** Settlements that use linked-village validation (Agricultural Villa, Vineyard, etc.). */
const LINKED_VILLAGE_SETTLEMENTS = new Set(["Agricultural Villa", "Vineyard", "Tobacco Plantation", "Horse Breeding Villa", "Olive Plantation", "Cotton Plantation", "Tauric Ibex-Ranch (D4)", "Tauric Ibex-Ranch (D6+)"]);

/** Check if a settlement type uses linked-village validation. */
function isLinkedVillageSettlement(settlement: string): boolean {
  return LINKED_VILLAGE_SETTLEMENTS.has(settlement);
}

/** Compute linked-village settlement validation state for a row (Agricultural Villa, Vineyard, Horse Breeding Villa).
 *  For grouped (multi-area) settlements, pass the PRIMARY row so linkedVillageIds are available.
 *  The fertility dice check is skipped for grouped settlements since each row validates dice independently.
 */
function getLinkedVillageValidation(
  row: LandArea,
  areas: LandArea[],
  roadNetwork: RoadNetwork,
): { isInvalid: boolean; tooltip: string | undefined } {
  if (!isLinkedVillageSettlement(row.settlement)) return { isInvalid: false, tooltip: undefined };

  const config = SETTLEMENT_CONFIGS[row.settlement];
  const requiredVillages = config?.requiredLinkedVillages ?? 2;
  const name = row.settlement;
  const isGroupedSettlement = !!(config?.requiredAreas && config.requiredAreas > 1);

  // 1. Check linked settlements exist (priority 1)
  const eligibleTypes = config?.eligibleLinkedSettlements ?? ["Tenant Village"];
  const linkedIds = row.linkedVillageIds ?? [];
  const validLinked = linkedIds.filter((vid) => {
    const v = areas.find((r) => r.id === vid);
    return v && eligibleTypes.includes(v.settlement);
  });
  const eligibleLabel = eligibleTypes.length > 1
    ? eligibleTypes.join(" or ")
    : `Tenant ${requiredVillages === 1 ? "Village" : "Villages"}`;
  if (validLinked.length < requiredVillages) {
    return { isInvalid: true, tooltip: `${name} requires ${requiredVillages} complete ${eligibleLabel}.` };
  }

  // 1b. Check linked settlements are construction-complete (priority 1b)
  const completeLinked = validLinked.filter((vid) => {
    const v = areas.find((r) => r.id === vid);
    return v && v.constructionComplete;
  });
  if (completeLinked.length < requiredVillages) {
    return { isInvalid: true, tooltip: `${name} requires ${requiredVillages} complete ${eligibleLabel}.` };
  }

  // 2. Check road network (priority 2) — only for settlements that require it
  if (config?.requiresRoadNetwork && roadNetwork === "none") {
    return { isInvalid: true, tooltip: `${name} requires a road network.` };
  }

  // 3. Check fertility dice (priority 3) — skip for grouped settlements (each row validates dice independently)
  if (!isGroupedSettlement) {
    if (row.fertilityDice === "") {
      return { isInvalid: true, tooltip: "Please select a Fertility Dice value." };
    }
    if (!isFertilityMet(row.settlement, row.fertilityDice)) {
      if (config?.allowedDice) {
        return { isInvalid: true, tooltip: `${name} requires Fertility Dice ${config.allowedDice.join(" or ")}.` };
      }
      const minFert = config?.minFertility;
      return { isInvalid: true, tooltip: `${name} requires Fertility Dice ${minFert ?? "D6"} or higher.` };
    }
  }

  return { isInvalid: false, tooltip: undefined };
}

/** Get Tenant Village IDs that are already linked to any linked-village settlement (excluding a given row). */
function getLinkedTenantVillageIds(areas: LandArea[], excludeRowId?: number): Set<number> {
  const linked = new Set<number>();
  for (const row of areas) {
    if (isLinkedVillageSettlement(row.settlement) && row.id !== excludeRowId && row.linkedVillageIds) {
      for (const vid of row.linkedVillageIds) {
        linked.add(vid);
      }
    }
  }
  return linked;
}

/** Get eligible settlements for linking to a linked-village settlement row. */
function getEligibleTenantVillages(
  areas: LandArea[],
  villaRowId: number,
  currentLinkedIds: number[],
  slotIndex: number,
  eligibleTypes?: string[],
): LandArea[] {
  const allowedTypes = eligibleTypes ?? ["Tenant Village"];
  const alreadyLinkedByOthers = getLinkedTenantVillageIds(areas, villaRowId);
  // Collect IDs selected in other slots (not the current one)
  const otherSlotIds = new Set(
    currentLinkedIds.filter((vid, idx) => idx !== slotIndex && vid > 0)
  );

  return areas.filter((r) => {
    if (!allowedTypes.includes(r.settlement)) return false;
    // For grouped settlements, only show the primary row as linkable
    if (r.groupId && !r.isGroupPrimary) return false;
    if (alreadyLinkedByOthers.has(r.id)) return false;
    // Can't select same village in multiple slots
    if (otherSlotIds.has(r.id)) return false;
    // Must have Constr. Ready completed
    if (!r.constructionComplete) return false;
    return true;
  });
}

/** Get the linked-village settlement (Agricultural Villa or Vineyard) that has linked this Tenant Village, if any. */
function getLinkedParentSettlement(areas: LandArea[], tenantVillageId: number): LandArea | undefined {
  return areas.find(
    (r) => isLinkedVillageSettlement(r.settlement) && r.linkedVillageIds?.includes(tenantVillageId)
  );
}

function LandAreasTable({
  areas,
  onUpdate,
  onAdd,
  onAddCustom,
  onRequestDelete,
  onMoveRow,
  multiAreaInvalidRows,
  roadNetwork,
}: {
  areas: LandArea[];
  onUpdate: (id: number, patch: Partial<LandArea>) => void;
  onAdd: () => void;
  onAddCustom: () => void;
  onRequestDelete: (id: number) => void;
  onMoveRow: (id: number, direction: "up" | "down") => void;
  /** Set of row IDs that have multi-area validation errors. */
  multiAreaInvalidRows: Set<number>;
  /** Current road network setting for Agricultural Villa validation. */
  roadNetwork: RoadNetwork;
}) {
  const cellBase = "px-2 py-1.5 border-r border-[#3A424D]";
  const cellLast = "px-2 py-1.5";
  const headerCell = `${cellBase} text-[10px] font-medium uppercase tracking-[0.08em] text-[#8A95A0] bg-[#242A32] whitespace-nowrap text-left`;
  const headerCellLast = `${cellLast} text-[10px] font-medium uppercase tracking-[0.08em] text-[#8A95A0] bg-[#242A32] whitespace-nowrap text-left`;

  const groupMap = buildGroupMap(areas);

  /**
   * Determine which rows are deletable.
   * Rule: at least one Area row must always remain after deletion.
   * For grouped settlements, deleting the group removes ALL its member rows.
   */
  const deletableRowIds = useMemo(() => {
    const totalRows = areas.length;
    const deletable = new Set<number>();

    for (const row of areas) {
      // Secondary grouped rows don't have their own delete control
      if (row.groupId && !row.isGroupPrimary) continue;

      // Calculate how many rows would remain after deleting this row/group
      let rowsRemoved = 1;
      if (row.groupId && row.isGroupPrimary) {
        const info = groupMap.get(row.groupId);
        rowsRemoved = info ? info.memberIds.length : 1;
      }

      if (totalRows - rowsRemoved >= 1) {
        deletable.add(row.id);
      }
    }

    return deletable;
  }, [areas, groupMap]);

  const showDeleteColumn = deletableRowIds.size > 0;

  return (
    <div>
      <div className="border border-[#3A424D] rounded-sm overflow-x-auto">
        <table className="w-full border-collapse table-auto [&_td]:align-top [&_th]:align-bottom">
          <thead>
            {/* Group header row for Military */}
            <tr className="border-b border-[#3A424D]">
              <th className="bg-[#242A32] w-[36px] min-w-[36px]" />
              <th colSpan={8} className="bg-[#242A32]" />
              <th
                colSpan={4}
                className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#8A95A0] bg-[#242A32] text-center py-1 border-l border-[#3A424D]"
              >
                Military
              </th>
              {showDeleteColumn && <th className="bg-[#242A32]" />}
            </tr>
            {/* Main header row */}
            <tr className="border-b border-[#4A5568]">
              <th className={`${headerCell} w-[36px] min-w-[36px]`} />
              <th className={`${headerCell} w-[96px] min-w-[96px] max-w-[96px]`}>Area</th>
              <th className={`${headerCell} w-[72px] min-w-[72px] max-w-[72px]`}>Size (km²)</th>
              <th className={`${headerCell} min-w-[130px]`}>Settlement</th>
              <th className={`${headerCell} min-w-[100px]`}>Linked Settl.</th>
              <th className={`${headerCell} w-[100px] min-w-[100px] max-w-[100px]`}>Constr. Ready</th>
              <th className={`${headerCell} w-[52px] min-w-[52px] max-w-[52px]`}>Pop.</th>
              <th className={`${headerCell} w-[165px] min-w-[165px] max-w-[165px]`}>Fertility Dice</th>
              <th className={`${headerCell} w-[76px] min-w-[76px] max-w-[76px]`}>Income</th>
              <th
                className={`${headerCell} w-[72px] min-w-[72px] max-w-[72px] border-l border-[#4A5568]`}
              >
                Samurais
              </th>
              <th className={`${headerCell} w-[78px] min-w-[78px] max-w-[78px]`}>Ashigurus</th>
              <th className={`${headerCell} w-[92px] min-w-[92px] max-w-[92px]`}>Highlanders</th>
              <th
                className={`${showDeleteColumn ? headerCell : headerCellLast} w-[53px] min-w-[53px] max-w-[53px]`}
              >
                Other
              </th>
              {showDeleteColumn && (
                <th className={`${headerCellLast} min-w-[34px] w-[34px]`} />
              )}
            </tr>
          </thead>
          <tbody>
            {(() => {
              const displayNames = getSettlementDisplayNames(areas);
              // Render rows in their natural order (no forced grouping)
              const orderedAreas = areas;

              return orderedAreas.map((row, rowIndex) => {

              // Determine if this row can move up/down
              // For grouped rows, only the primary can trigger moves, and the whole group moves together
              const isGroupedSecondary = !!row.groupId && !row.isGroupPrimary;
              const canMoveUp = !isGroupedSecondary && rowIndex > 0;
              const canMoveDown = !isGroupedSecondary && rowIndex < orderedAreas.length - 1;

              // For grouped secondary rows, check if the next row after this is also in the same group
              // (to avoid showing move buttons on secondary rows)

              const moveCell = (
                <td className={`${cellBase} w-[36px] min-w-[36px]`}>
                  {!isGroupedSecondary ? (
                    <div className="flex flex-col items-center gap-0">
                      <button
                        type="button"
                        onClick={() => onMoveRow(row.id, "up")}
                        disabled={!canMoveUp}
                        className={`p-0 leading-none ${canMoveUp ? "text-[#8A95A0] hover:text-[#D4A574] cursor-pointer" : "text-[#3A424D] cursor-default"} transition-colors`}
                        title="Move up"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveRow(row.id, "down")}
                        disabled={!canMoveDown}
                        className={`p-0 leading-none ${canMoveDown ? "text-[#8A95A0] hover:text-[#D4A574] cursor-pointer" : "text-[#3A424D] cursor-default"} transition-colors`}
                        title="Move down"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  ) : null}
                </td>
              );

              /* ── Custom Area Row ── */
              if (row.isCustom) {
                const canDelete = deletableRowIds.has(row.id);
                return (
                  <tr
                    key={row.id}
                    className="border-b border-[#333B46] last:border-b-0 hover:bg-[#303840] transition-colors"
                  >
                    {moveCell}
                    {/* Area name (read-only, "Custom Area") */}
                    <td className={`${cellBase} w-[96px] min-w-[96px] max-w-[96px]`}>
                      <span className="text-[12px] text-[#F0EDE8]">{row.area}</span>
                    </td>
                    {/* Size (editable numeric) */}
                    <td className={`${cellBase} w-[72px] min-w-[72px] max-w-[72px]`}>
                      <input
                        type="number"
                        value={row.size}
                        onChange={(e) => onUpdate(row.id, { size: e.target.value })}
                        placeholder="4"
                        className="w-full bg-transparent border-0 text-[12px] text-[#F0EDE8] placeholder:text-[#505A64] h-auto p-0 focus:ring-0 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </td>
                    {/* Settlement (free text) */}
                    <td className={cellBase} style={{ overflow: "visible", wordBreak: "break-word" }}>
                      <textarea
                        value={row.settlement === "-" ? "" : row.settlement}
                        onChange={(e) => onUpdate(row.id, { settlement: e.target.value || "-" })}
                        placeholder="Enter settlement..."
                        rows={1}
                        className="w-full bg-transparent border-0 text-[12px] text-[#F0EDE8] placeholder:text-[#505A64] h-auto p-0 focus:ring-0 outline-none resize-none overflow-hidden leading-tight"
                        style={{ minHeight: "1.4em" }}
                        onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
                        ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                      />
                    </td>
                    {/* Linked Settl. (free text) */}
                    <td className={cellBase} style={{ overflow: "visible", wordBreak: "break-word" }}>
                      <textarea
                        value={row.linkedSettlement === "-" ? "" : row.linkedSettlement}
                        onChange={(e) => onUpdate(row.id, { linkedSettlement: e.target.value || "-" })}
                        placeholder="—"
                        rows={1}
                        className="w-full bg-transparent border-0 text-[12px] text-[#F0EDE8] placeholder:text-[#505A64] h-auto p-0 focus:ring-0 outline-none resize-none overflow-hidden leading-tight"
                        style={{ minHeight: "1.4em" }}
                        onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
                        ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                      />
                    </td>
                    {/* Constr. Ready (free text) */}
                    <td className={`${cellBase} w-[100px] min-w-[100px] max-w-[100px]`} style={{ overflow: "visible", wordBreak: "break-word" }}>
                      <textarea
                        value={row.constructionNote}
                        onChange={(e) => onUpdate(row.id, { constructionNote: e.target.value })}
                        placeholder="—"
                        rows={1}
                        className="w-full bg-transparent border-0 text-[12px] text-[#F0EDE8] placeholder:text-[#505A64] h-auto p-0 focus:ring-0 outline-none resize-none overflow-hidden leading-tight"
                        style={{ minHeight: "1.4em" }}
                        onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
                        ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                      />
                    </td>
                    {/* Pop. (editable numeric) */}
                    <td className={`${cellBase} w-[52px] min-w-[52px] max-w-[52px]`}>
                      <input
                        type="number"
                        value={row.population === "-" ? "" : row.population}
                        onChange={(e) => onUpdate(row.id, { population: e.target.value || "-" })}
                        placeholder="0"
                        className="w-full bg-transparent border-0 text-[12px] text-[#F0EDE8] placeholder:text-[#505A64] h-auto p-0 focus:ring-0 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </td>
                    {/* Fertility Dice (optional selector) */}
                    <td className={`${cellBase} w-[165px] min-w-[165px] max-w-[165px]`}>
                      <FertilitySelector
                        value={row.fertilityDice}
                        onSelect={(d) => onUpdate(row.id, { fertilityDice: d })}
                      />
                    </td>
                    {/* Income (editable numeric) */}
                    <td className={`${cellBase} w-[76px] min-w-[76px] max-w-[76px]`}>
                      <input
                        type="number"
                        value={row.income === "-" ? "" : row.income.replace(/\s*GD$/, "")}
                        onChange={(e) => onUpdate(row.id, { income: e.target.value || "-" })}
                        placeholder="0"
                        className="w-full bg-transparent border-0 text-[12px] text-[#F0EDE8] placeholder:text-[#505A64] h-auto p-0 focus:ring-0 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </td>
                    {/* Samurais (editable numeric) */}
                    <td className={`${cellBase} w-[72px] min-w-[72px] max-w-[72px] border-l border-[#4A5568]`}>
                      <input
                        type="number"
                        value={row.samurais === "-" ? "" : row.samurais}
                        onChange={(e) => onUpdate(row.id, { samurais: e.target.value || "-" })}
                        placeholder="0"
                        className="w-full bg-transparent border-0 text-[12px] text-[#F0EDE8] placeholder:text-[#505A64] h-auto p-0 focus:ring-0 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </td>
                    {/* Ashigurus (editable numeric) */}
                    <td className={`${cellBase} w-[78px] min-w-[78px] max-w-[78px]`}>
                      <input
                        type="number"
                        value={row.ashigurus === "-" ? "" : row.ashigurus}
                        onChange={(e) => onUpdate(row.id, { ashigurus: e.target.value || "-" })}
                        placeholder="0"
                        className="w-full bg-transparent border-0 text-[12px] text-[#F0EDE8] placeholder:text-[#505A64] h-auto p-0 focus:ring-0 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </td>
                    {/* Highlanders (editable numeric) */}
                    <td className={`${cellBase} w-[92px] min-w-[92px] max-w-[92px]`}>
                      <input
                        type="number"
                        value={row.highlanders === "-" ? "" : row.highlanders}
                        onChange={(e) => onUpdate(row.id, { highlanders: e.target.value || "-" })}
                        placeholder="0"
                        className="w-full bg-transparent border-0 text-[12px] text-[#F0EDE8] placeholder:text-[#505A64] h-auto p-0 focus:ring-0 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </td>
                    {/* Other (editable numeric for custom) */}
                    <td className={`${showDeleteColumn ? cellBase : cellLast} w-[53px] min-w-[53px] max-w-[53px]`}>
                      <input
                        type="number"
                        value={row.other === "-" ? "0" : row.other}
                        onChange={(e) => onUpdate(row.id, { other: e.target.value || "0" })}
                        placeholder="0"
                        className="w-full bg-transparent border-0 text-[12px] text-[#F0EDE8] placeholder:text-[#505A64] h-auto p-0 focus:ring-0 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </td>
                    {/* Delete */}
                    {showDeleteColumn && (
                      <td className={cellLast}>
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => onRequestDelete(row.id)}
                            className="flex items-center justify-center w-full text-[#7A8490] hover:text-[#C45858] transition-colors"
                            title={`Delete ${row.area}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span />
                        )}
                      </td>
                    )}
                  </tr>
                );
              }

              /* ── Normal Area Row (existing logic) ── */
              const isMultiAreaInvalid = multiAreaInvalidRows.has(row.id);
              const isGrouped = !!row.groupId;
              const isPrimary = !!row.isGroupPrimary;
              const isSecondary = isGrouped && !isPrimary;

              const isAgriVilla = isLinkedVillageSettlement(row.settlement);
              const agriValidationRow = (isGrouped && !isPrimary)
                ? (areas.find((r) => r.groupId === row.groupId && r.isGroupPrimary) ?? row)
                : row;
              const agriValidation = getLinkedVillageValidation(agriValidationRow, areas, roadNetwork);
              const isAgriInvalid = agriValidation.isInvalid;

              const thisRowMissingDice = row.settlement !== "-" && row.fertilityDice === "";
              const isNonGroupedAgriVilla = isAgriVilla && !isGrouped;
              const fertilityTooltip = isNonGroupedAgriVilla ? undefined : getFertilityTooltip(row.settlement, row.fertilityDice);
              const hasFertilityError = isNonGroupedAgriVilla ? false : (thisRowMissingDice || (!isMultiAreaInvalid && isSettlementRowInvalid(row.settlement, row.fertilityDice)));

              let groupAllDiceValid = true;
              if (isGrouped) {
                const groupRows = areas.filter((r) => r.groupId === row.groupId);
                groupAllDiceValid = groupRows.every((r) => r.fertilityDice !== "" && isFertilityMet(r.settlement, r.fertilityDice));
              }

              const agriInvalidForThisRow = isAgriInvalid && (!isGrouped || isPrimary);
              const rowInvalid = isMultiAreaInvalid || hasFertilityError || agriInvalidForThisRow;
              const settlementDisplayName = displayNames.get(row.id) ?? row.settlement;

              const multiAreaConfig = SETTLEMENT_CONFIGS[row.settlement];
              const multiAreaTooltip = isMultiAreaInvalid && multiAreaConfig?.requiredAreas
                ? `${row.settlement} requires ${multiAreaConfig.requiredAreas} free Areas (${multiAreaConfig.requiredAreas * 4} km² total). Add more free Areas and then select the settlement again.`
                : undefined;

              const showAgriTooltipOnThisRow = isAgriInvalid && (!isGrouped || isPrimary);
              const warningTooltip = multiAreaTooltip || (showAgriTooltipOnThisRow ? agriValidation.tooltip : fertilityTooltip);

              const { total: groupTotal } = getGroupRowPosition(areas, row);

              let primaryRow = row;
              if (isGrouped && !isPrimary) {
                const found = areas.find((r) => r.groupId === row.groupId && r.isGroupPrimary);
                if (found) primaryRow = found;
              }

              const constructionReady = isGrouped ? primaryRow.constructionComplete : row.constructionComplete;
              const groupFullyValid = isGrouped ? (!isMultiAreaInvalid && groupAllDiceValid && !isAgriInvalid) : !rowInvalid;
              const valuesActive = groupFullyValid && constructionReady;
              const displayPop = valuesActive ? primaryRow.population : "-";
              const displayIncome = valuesActive ? primaryRow.income : "-";
              const displaySamurais = valuesActive ? primaryRow.samurais : "-";
              const displayAshigurus = valuesActive ? primaryRow.ashigurus : "-";
              const displayHighlanders = valuesActive ? primaryRow.highlanders : "-";

              const renderSharedColumns = !isSecondary;

              const isTenantVillage = row.settlement === "Tenant Village";
              const isMTPV = row.settlement === "Mountain Tauric Permaculture Village";
              const canBeLinkedChild = isTenantVillage || isMTPV;
              const linkedAgriVilla = canBeLinkedChild ? getLinkedParentSettlement(areas, row.id) : undefined;
              const linkedAgriVillaDisplayName = linkedAgriVilla ? (displayNames.get(linkedAgriVilla.id) ?? linkedAgriVilla.settlement) : undefined;

              return (
                <tr
                  key={row.id}
                  className={`border-b border-[#333B46] last:border-b-0 hover:bg-[#303840] transition-colors ${
                    rowInvalid ? "outline outline-1 outline-[#5A2828] -outline-offset-1" : ""
                  }`}
                >
                  {/* Move controls */}
                  {moveCell}
                  {/* Area (read-only) + warning/helper icon */}
                  <td className={`${cellBase} w-[96px] min-w-[96px] max-w-[96px]`}>
                    <div className="flex items-center gap-1.5">
                      {rowInvalid && warningTooltip ? (
                        <div className="group/warn relative shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#C45858]" />
                          <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-1.5 z-30 hidden group-hover/warn:flex">
                            <div className="relative whitespace-nowrap rounded bg-[#3D2222] border border-[#6B3030] px-2.5 py-1 text-[11px] text-[#F0D0D0] shadow-lg">
                              {warningTooltip}
                              <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-[#6B3030]" />
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {!rowInvalid && !isAgriVilla && isGrouped && (thisRowMissingDice || isSettlementRowInvalid(row.settlement, row.fertilityDice)) && fertilityTooltip ? (
                        <div className="group/warn relative shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#C45858]" />
                          <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-1.5 z-30 hidden group-hover/warn:flex">
                            <div className="relative whitespace-nowrap rounded bg-[#3D2222] border border-[#6B3030] px-2.5 py-1 text-[11px] text-[#F0D0D0] shadow-lg">
                              {fertilityTooltip}
                              <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-[#6B3030]" />
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {!rowInvalid && isGrouped && isPrimary && groupAllDiceValid && !isAgriInvalid && !constructionReady ? (
                        <div className="group/help relative shrink-0">
                          <HelpCircle className="w-3.5 h-3.5 text-[#D4A850]" />
                          <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-1.5 z-30 hidden group-hover/help:flex">
                            <div className="relative whitespace-nowrap rounded bg-[#332E1C] border border-[#4D4828] px-2.5 py-1 text-[11px] text-[#F0E8B8] shadow-lg">
                              When your settlement construction is complete, check the Constr. Ready checkbox<br />and the population, income, and military values will be added to your domain.
                              <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-[#4D4828]" />
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {!rowInvalid && row.settlement !== "-" && !row.constructionComplete && !isGrouped ? (
                        <div className="group/help relative shrink-0">
                          <HelpCircle className="w-3.5 h-3.5 text-[#D4A850]" />
                          <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-1.5 z-30 hidden group-hover/help:flex">
                            <div className="relative whitespace-nowrap rounded bg-[#332E1C] border border-[#4D4828] px-2.5 py-1 text-[11px] text-[#F0E8B8] shadow-lg">
                              When your settlement construction is complete, check the Constr. Ready checkbox<br />and the population, income, and military values will be added to your domain.
                              <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-[#4D4828]" />
                            </div>
                          </div>
                        </div>
                      ) : null}
                      <span className="text-[12px] text-[#F0EDE8]">
                        {row.area}
                      </span>
                    </div>
                  </td>
                  <td className={`${cellBase} w-[72px] min-w-[72px] max-w-[72px]`}>
                    <span className="block text-[12px] text-[#F0EDE8] text-center">
                      4
                    </span>
                  </td>
                  {renderSharedColumns ? (
                    <td
                      className={`${cellBase} ${isMultiAreaInvalid ? "bg-[#3D2222]" : ""}`}
                      rowSpan={isGrouped ? groupTotal : 1}
                      style={{ overflow: "visible", wordBreak: "break-word" }}
                    >
                      <div className="relative">
                        <span className={`block text-[12px] pointer-events-none leading-tight whitespace-normal ${isMultiAreaInvalid ? "text-[#C45858]" : "text-[#F0EDE8]"}`} style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                          {row.settlement === "Mountain Tauric Permaculture Village"
                            ? (() => {
                                const name = settlementDisplayName;
                                const match = name.match(/^(Mountain Tauric)\s+(Permaculture Village.*)$/);
                                if (match) return <>{match[1]}<br />{match[2]}</>;
                                return name;
                              })()
                            : row.settlement === "Horse Breeding Villa"
                            ? (() => {
                                const name = settlementDisplayName;
                                const match = name.match(/^(Horse Breeding)\s+(Villa.*)$/);
                                if (match) return <>{match[1]}<br />{match[2]}</>;
                                return name;
                              })()
                            : row.settlement === "Tauric Ibex-Ranch (D4)"
                            ? (() => {
                                const name = settlementDisplayName;
                                const match = name.match(/^(Tauric)\s+(Ibex-Ranch\s*\(D4\).*)$/);
                                if (match) return <>{match[1]}<br />{match[2]}</>;
                                return name;
                              })()
                            : row.settlement === "Tauric Ibex-Ranch (D6+)"
                            ? (() => {
                                const name = settlementDisplayName;
                                const match = name.match(/^(Tauric)\s+(Ibex-Ranch\s*\(D6\+\).*)$/);
                                if (match) return <>{match[1]}<br />{match[2]}</>;
                                return name;
                              })()
                            : settlementDisplayName
                          }
                        </span>
                        <select
                          value={row.settlement}
                          onChange={(e) => onUpdate(row.id, { settlement: e.target.value })}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        >
                          {SETTLEMENT_OPTIONS.map((opt) => (
                            <option key={opt} value={opt} className="bg-[#2C333C] text-[#F0EDE8]">{opt}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  ) : null}
                  {renderSharedColumns ? (
                    <td className={cellBase} rowSpan={isGrouped ? groupTotal : 1} style={{ overflow: "visible", wordBreak: "break-word" }}>
                      {isAgriVilla ? (
                        (() => {
                          const agriConfig = SETTLEMENT_CONFIGS[row.settlement];
                          const slotCount = agriConfig?.requiredLinkedVillages ?? 2;
                          const eligibleTypes = agriConfig?.eligibleLinkedSettlements;
                          return (
                            <div className="flex flex-col gap-1">
                              {Array.from({ length: slotCount }, (_, slotIdx) => {
                                const currentLinkedIds = row.linkedVillageIds ?? [];
                                const selectedId = currentLinkedIds[slotIdx] ?? 0;
                                const eligible = getEligibleTenantVillages(areas, row.id, currentLinkedIds, slotIdx, eligibleTypes);
                                const selectedRow = selectedId ? areas.find((r) => r.id === selectedId) : undefined;
                                const selectedDisplayName = selectedRow ? (displayNames.get(selectedRow.id) ?? "Tenant Village") : undefined;
                                return (
                                  <select
                                    key={slotIdx}
                                    value={selectedId || ""}
                                    onChange={(e) => {
                                      const newId = parseInt(e.target.value, 10) || 0;
                                      const newLinked = [...currentLinkedIds];
                                      while (newLinked.length < slotCount) newLinked.push(0);
                                      newLinked[slotIdx] = newId;
                                      onUpdate(row.id, { linkedVillageIds: newLinked } as Partial<LandArea>);
                                    }}
                                    className="w-full bg-transparent border-0 text-[11px] text-[#F0EDE8] h-auto p-0 outline-none cursor-pointer"
                                  >
                                    <option value="" className="bg-[#2C333C] text-[#8A95A0]">— select —</option>
                                    {selectedRow && !eligible.some((e) => e.id === selectedRow.id) && (
                                      <option key={selectedRow.id} value={selectedRow.id} className="bg-[#2C333C] text-[#F0EDE8]">{selectedDisplayName}</option>
                                    )}
                                    {eligible.map((tv) => (
                                      <option key={tv.id} value={tv.id} className="bg-[#2C333C] text-[#F0EDE8]">{displayNames.get(tv.id) ?? tv.settlement}</option>
                                    ))}
                                  </select>
                                );
                              })}
                            </div>
                          );
                        })()
                      ) : canBeLinkedChild && linkedAgriVillaDisplayName ? (
                        <span className="text-[11px] text-[#A8B0B8]" style={{ whiteSpace: "normal", overflowWrap: "break-word", wordBreak: "break-word", display: "block" }}>→ {linkedAgriVillaDisplayName}</span>
                      ) : (
                        <select
                          value={primaryRow.linkedSettlement}
                          onChange={(e) => onUpdate(primaryRow.id, { linkedSettlement: e.target.value })}
                          className="w-full bg-transparent border-0 text-[12px] text-[#F0EDE8] h-auto p-0 outline-none cursor-pointer appearance-none"
                          style={{ WebkitAppearance: "none" }}
                        >
                          {LINKED_SETTLEMENT_OPTIONS.map((opt) => (
                            <option key={opt} value={opt} className="bg-[#2C333C] text-[#F0EDE8]">{opt}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  ) : null}
                  {renderSharedColumns ? (
                    <td className={`${cellBase} w-[100px] min-w-[100px] max-w-[100px]`} rowSpan={isGrouped ? groupTotal : 1} style={{ overflow: "visible", wordBreak: "break-word" }}>
                      <ConstructionReadyCell
                        complete={primaryRow.constructionComplete}
                        note={primaryRow.constructionNote}
                        onToggle={(checked) => onUpdate(primaryRow.id, { constructionComplete: checked })}
                        onNoteChange={(v) => onUpdate(primaryRow.id, { constructionNote: v })}
                      />
                    </td>
                  ) : null}
                  {renderSharedColumns ? (
                    <td className={`${cellBase} w-[52px] min-w-[52px] max-w-[52px]`} rowSpan={isGrouped ? groupTotal : 1}>
                      <span className="block text-[12px] text-[#A8B0B8] text-center">{displayPop}</span>
                    </td>
                  ) : null}
                  <td
                    className={`${cellBase} w-[165px] min-w-[165px] max-w-[165px] ${
                      hasFertilityError || (isGrouped && (thisRowMissingDice || isSettlementRowInvalid(row.settlement, row.fertilityDice))) ||
                      (isAgriVilla && isAgriInvalid && agriValidation.tooltip?.includes("Fertility Dice"))
                        ? "bg-[#3D2222]" : ""
                    }`}
                  >
                    <FertilitySelector
                      value={row.fertilityDice}
                      onSelect={(d) => onUpdate(row.id, { fertilityDice: d })}
                      hasWarning={hasFertilityError}
                      warningTooltip={fertilityTooltip}
                    />
                  </td>
                  {renderSharedColumns ? (
                    <td className={`${cellBase} w-[76px] min-w-[76px] max-w-[76px]`} rowSpan={isGrouped ? groupTotal : 1}>
                      <span className="block text-[12px] text-[#A8B0B8] text-center">{displayIncome}</span>
                    </td>
                  ) : null}
                  {renderSharedColumns ? (
                    <td className={`${cellBase} w-[72px] min-w-[72px] max-w-[72px] border-l border-[#4A5568]`} rowSpan={isGrouped ? groupTotal : 1}>
                      <span className="block text-[12px] text-[#A8B0B8] text-center">{displaySamurais}</span>
                    </td>
                  ) : null}
                  {renderSharedColumns ? (
                    <td className={`${cellBase} w-[78px] min-w-[78px] max-w-[78px]`} rowSpan={isGrouped ? groupTotal : 1}>
                      <span className="block text-[12px] text-[#A8B0B8] text-center">{displayAshigurus}</span>
                    </td>
                  ) : null}
                  {renderSharedColumns ? (
                    <td className={`${cellBase} w-[92px] min-w-[92px] max-w-[92px]`} rowSpan={isGrouped ? groupTotal : 1}>
                      <span className="block text-[12px] text-[#A8B0B8] text-center">{displayHighlanders}</span>
                    </td>
                  ) : null}
                  {renderSharedColumns ? (
                    <td className={`${showDeleteColumn ? cellBase : cellLast} w-[53px] min-w-[53px] max-w-[53px]`} rowSpan={isGrouped ? groupTotal : 1}>
                      <span className="block text-[12px] text-[#A8B0B8] text-center">-</span>
                    </td>
                  ) : null}
                  {showDeleteColumn && (() => {
                    if (isSecondary) return null;
                    const canDelete = deletableRowIds.has(row.id);
                    if (isGrouped && isPrimary) {
                      return (
                        <td className={`${cellLast} align-middle`} rowSpan={groupTotal}>
                          {canDelete ? (
                            <button type="button" onClick={() => onRequestDelete(row.id)} className="flex items-center justify-center w-full text-[#7A8490] hover:text-[#C45858] transition-colors" title={`Delete ${settlementDisplayName}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : <span />}
                        </td>
                      );
                    }
                    return (
                      <td className={cellLast}>
                        {canDelete ? (
                          <button type="button" onClick={() => onRequestDelete(row.id)} className="flex items-center justify-center w-full text-[#7A8490] hover:text-[#C45858] transition-colors" title={`Delete ${row.area}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : <span />}
                      </td>
                    );
                  })()}
                </tr>
              );
            });
            })()}
          </tbody>
          <tfoot>
            {(() => {
              let totalSize = 0;
              let totalPop = 0;
              let totalIncome = 0;
              let totalSamurais = 0;
              let totalAshigurus = 0;
              let totalHighlanders = 0;
              let totalOther = 0;

              const countedGroups = new Set<string>();

              for (const row of areas) {
                // Custom areas: always include their values directly
                if (row.isCustom) {
                  totalSize += parseInt(row.size, 10) || 0;
                  const popNum = parseInt(row.population, 10);
                  if (!isNaN(popNum)) totalPop += popNum;
                  const incomeNum = parseFloat(row.income);
                  if (!isNaN(incomeNum)) totalIncome += incomeNum;
                  const samNum = parseInt(row.samurais, 10);
                  if (!isNaN(samNum)) totalSamurais += samNum;
                  const ashNum = parseInt(row.ashigurus, 10);
                  if (!isNaN(ashNum)) totalAshigurus += ashNum;
                  const highNum = parseInt(row.highlanders, 10);
                  if (!isNaN(highNum)) totalHighlanders += highNum;
                  const othNum = parseInt(row.other, 10);
                  if (!isNaN(othNum)) totalOther += othNum;
                  continue;
                }

                totalSize += parseInt(row.size, 10) || 0;

                if (row.groupId) {
                  if (countedGroups.has(row.groupId)) continue;
                  countedGroups.add(row.groupId);
                  const primary = areas.find((r) => r.groupId === row.groupId && r.isGroupPrimary);
                  if (!primary) continue;
                  const isInvalid = multiAreaInvalidRows.has(primary.id);
                  const groupRows = areas.filter((r) => r.groupId === row.groupId);
                  const allDiceValid = groupRows.every((r) => r.fertilityDice !== "" && isFertilityMet(r.settlement, r.fertilityDice));
                  const groupLinkedVal = getLinkedVillageValidation(primary, areas, roadNetwork);
                  if (!isInvalid && allDiceValid && !groupLinkedVal.isInvalid && primary.constructionComplete) {
                    const popNum = parseInt(primary.population, 10);
                    if (!isNaN(popNum)) totalPop += popNum;
                    const incomeNum = parseFloat(primary.income);
                    if (!isNaN(incomeNum)) totalIncome += incomeNum;
                    const samNum = parseInt(primary.samurais, 10);
                    if (!isNaN(samNum)) totalSamurais += samNum;
                    const ashNum = parseInt(primary.ashigurus, 10);
                    if (!isNaN(ashNum)) totalAshigurus += ashNum;
                    const highNum = parseInt(primary.highlanders, 10);
                    if (!isNaN(highNum)) totalHighlanders += highNum;
                  }
                  continue;
                }

                const agriVal = getLinkedVillageValidation(row, areas, roadNetwork);
                const invalid = agriVal.isInvalid || isSettlementRowInvalid(row.settlement, row.fertilityDice);
                if (!invalid && row.constructionComplete) {
                  const popNum = parseInt(row.population, 10);
                  if (!isNaN(popNum)) totalPop += popNum;
                  const incomeNum = parseFloat(row.income);
                  if (!isNaN(incomeNum)) totalIncome += incomeNum;
                  const samNum = parseInt(row.samurais, 10);
                  if (!isNaN(samNum)) totalSamurais += samNum;
                  const ashNum = parseInt(row.ashigurus, 10);
                  if (!isNaN(ashNum)) totalAshigurus += ashNum;
                  const highNum = parseInt(row.highlanders, 10);
                  if (!isNaN(highNum)) totalHighlanders += highNum;
                }
              }

              const totalMilitary = totalSamurais + totalAshigurus + totalHighlanders + totalOther;

              const footerCell = `${cellBase} text-[11px] font-semibold text-[#D4A574] bg-[#242A32] whitespace-nowrap`;
              const footerCellLast = `${cellLast} text-[11px] font-semibold text-[#D4A574] bg-[#242A32] whitespace-nowrap`;

              return (
                <>
                <tr className="border-t border-[#4A5568]">
                  <td className={`${footerCell} w-[36px] min-w-[36px]`} />
                  <td className={`${footerCell} w-[96px] min-w-[96px] max-w-[96px]`}>
                    <span className="text-[11px]">TOTAL</span>
                  </td>
                  <td className={`${footerCell} w-[72px] min-w-[72px] max-w-[72px]`}>
                    <span className="block text-center">{totalSize}</span>
                  </td>
                  <td className={footerCell} />
                  <td className={footerCell} />
                  <td className={`${footerCell} w-[100px] min-w-[100px] max-w-[100px]`} />
                  <td className={`${footerCell} w-[52px] min-w-[52px] max-w-[52px]`}>
                    <span className="block text-center">{totalPop}</span>
                  </td>
                  <td className={`${footerCell} w-[165px] min-w-[165px] max-w-[165px]`} />
                  <td className={`${footerCell} w-[76px] min-w-[76px] max-w-[76px]`}>
                    <span className="block text-center">{totalIncome} GD</span>
                  </td>
                  <td className={`${footerCell} w-[72px] min-w-[72px] max-w-[72px] border-l border-[#4A5568]`}>
                    <span className="block text-center">{totalSamurais}</span>
                  </td>
                  <td className={`${footerCell} w-[78px] min-w-[78px] max-w-[78px]`}>
                    <span className="block text-center">{totalAshigurus}</span>
                  </td>
                  <td className={`${footerCell} w-[92px] min-w-[92px] max-w-[92px]`}>
                    <span className="block text-center">{totalHighlanders}</span>
                  </td>
                  <td className={`${showDeleteColumn ? footerCell : footerCellLast} w-[53px] min-w-[53px] max-w-[53px]`}>
                    <span className="block text-center">{totalOther}</span>
                  </td>
                  {showDeleteColumn && <td className={`${footerCellLast} bg-[#242A32]`} />}
                </tr>
                <tr className="border-t border-[#3A424D]">
                  <td className={`${footerCell} w-[36px] min-w-[36px]`} />
                  <td colSpan={8} className={footerCell}>
                    <span className="text-[11px]">Total Military</span>
                  </td>
                  <td colSpan={showDeleteColumn ? 4 : 4} className={`${showDeleteColumn ? footerCell : footerCellLast} border-l border-[#4A5568]`}>
                    <span className="block text-center">{totalMilitary}</span>
                  </td>
                  {showDeleteColumn && <td className={`${footerCellLast} bg-[#242A32]`} />}
                </tr>
                </>
              );
            })()}
          </tfoot>
        </table>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onAdd}
          className="h-7 px-3 text-[11px] text-[#8A95A0] hover:text-[#D4A574] hover:bg-[#303840] transition-colors"
        >
          <Plus className="w-3 h-3 mr-1.5" />
          Add New Land Area
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onAddCustom}
          className="h-7 px-3 text-[11px] text-[#8A95A0] hover:text-[#D4A574] hover:bg-[#303840] transition-colors"
        >
          <Plus className="w-3 h-3 mr-1.5" />
          Add New Custom Area
        </Button>
      </div>
    </div>
  );
}

/* ── Income & Expenses Table ───────────────────────────────── */

interface IncomeExpenseRow {
  id: number;
  description: string;
  amount: string;
  /** If true, description is read-only and the row cannot be deleted. */
  fixedDescription?: boolean;
}

function IncomeExpenseTable({
  title,
  rows,
  onUpdate,
  onAdd,
  onDelete,
  fixedFirstRow,
}: {
  title: string;
  rows: IncomeExpenseRow[];
  onUpdate: (id: number, patch: Partial<IncomeExpenseRow>) => void;
  onAdd: () => void;
  onDelete: (id: number) => void;
  /** Optional fixed read-only first row (not part of `rows`). */
  fixedFirstRow?: { description: string; amount: number };
}) {
  const deletableRows = rows.filter((r) => !r.fixedDescription);
  const hasAnyDeletable = deletableRows.length > 0;
  const showDeleteColumn = hasAnyDeletable || (rows.length > 1 && !!fixedFirstRow) || (rows.length >= 1 && !!fixedFirstRow);
  const cellBase = "px-2 py-1.5 border-r border-[#3A424D]";
  const cellLast = "px-2 py-1.5";
  const headerCell = `${cellBase} text-[10px] font-medium uppercase tracking-[0.08em] text-[#8A95A0] bg-[#242A32] whitespace-nowrap text-left`;
  const headerCellLast = `${cellLast} text-[10px] font-medium uppercase tracking-[0.08em] text-[#8A95A0] bg-[#242A32] whitespace-nowrap text-left`;

  const fixedAmount = fixedFirstRow ? fixedFirstRow.amount : 0;
  const userTotal = rows.reduce((sum, r) => {
    const num = parseFloat(r.amount);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);
  const total = fixedAmount + userTotal;

  return (
    <div className="flex-1 min-w-0">
      <h3 className="text-[11px] font-semibold text-[#A8B0B8] uppercase tracking-[0.08em] mb-1.5">
        {title}
      </h3>
      <div className="border border-[#3A424D] rounded-sm overflow-x-auto">
        <table className="w-full border-collapse table-auto">
          <thead>
            <tr className="border-b border-[#4A5568]">
              <th className={`${headerCell} min-w-[180px]`}>Description</th>
              <th className={`${showDeleteColumn ? headerCell : headerCellLast} min-w-[80px]`}>
                Amount (GD)
              </th>
              {showDeleteColumn && (
                <th className={`${headerCellLast} min-w-[40px] w-[40px]`} />
              )}
            </tr>
          </thead>
          <tbody>
            {/* Fixed first row (read-only) */}
            {fixedFirstRow && (
              <tr className="border-b border-[#333B46] bg-[#242A32]/40">
                <td className={cellBase}>
                  <span className="text-[12px] text-[#A8B0B8]">
                    {fixedFirstRow.description}
                  </span>
                </td>
                <td className={showDeleteColumn ? cellBase : cellLast}>
                  <span className="block text-[12px] text-[#A8B0B8] text-center">
                    {fixedFirstRow.amount}
                  </span>
                </td>
                {showDeleteColumn && (
                  <td className={cellLast}>
                    {/* No delete button for fixed row */}
                    <span />
                  </td>
                )}
              </tr>
            )}
            {/* Data rows */}
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-[#333B46] last:border-b-0 transition-colors ${
                  row.fixedDescription ? "bg-[#242A32]/40" : "hover:bg-[#303840]"
                }`}
              >
                <td className={cellBase}>
                  {row.fixedDescription ? (
                    <span className="text-[12px] text-[#A8B0B8]">
                      {row.description}
                    </span>
                  ) : (
                    <input
                      type="text"
                      value={row.description}
                      onChange={(e) =>
                        onUpdate(row.id, { description: e.target.value })
                      }
                      placeholder="Enter description..."
                      className="w-full bg-transparent border-0 text-[12px] text-[#F0EDE8] placeholder:text-[#505A64] h-auto p-0 focus:ring-0 outline-none"
                    />
                  )}
                </td>
                <td className={showDeleteColumn ? cellBase : cellLast}>
                  <input
                    type="number"
                    value={row.amount}
                    onChange={(e) =>
                      onUpdate(row.id, { amount: e.target.value })
                    }
                    placeholder="0"
                    className="w-full bg-transparent border-0 text-[12px] text-[#F0EDE8] placeholder:text-[#505A64] h-auto p-0 focus:ring-0 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </td>
                {showDeleteColumn && (
                  <td className={cellLast}>
                    {row.fixedDescription ? (
                      <span />
                    ) : (
                      <button
                        type="button"
                        onClick={() => onDelete(row.id)}
                        className="flex items-center justify-center w-full text-[#7A8490] hover:text-[#C45858] transition-colors"
                        title="Delete row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#4A5568]">
              <td
                className={`${cellBase} text-[11px] font-semibold text-[#D4A574] bg-[#242A32] whitespace-nowrap`}
              >
                <span className="text-[11px]">TOTAL</span>
              </td>
              <td
                className={`${showDeleteColumn ? cellBase : cellLast} text-[11px] font-semibold text-[#D4A574] bg-[#242A32] whitespace-nowrap`}
              >
                <span className="block text-center">{total} GD</span>
              </td>
              {showDeleteColumn && (
                <td className={`${cellLast} bg-[#242A32]`} />
              )}
            </tr>
          </tfoot>
        </table>
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={onAdd}
        className="mt-2 h-7 px-3 text-[11px] text-[#8A95A0] hover:text-[#D4A574] hover:bg-[#303840] transition-colors"
      >
        <Plus className="w-3 h-3 mr-1.5" />
        Add New Row
      </Button>
    </div>
  );
}

/* ── Persistence Helpers ───────────────────────────────────── */

interface CorruptionRow {
  id: number;
  description: string;
  percent: string;
  fixedDescription?: boolean;
}

interface ProfitLossRow {
  id: number;
  description: string;
  amount: string;
  fixedDescription?: boolean;
}

interface DomainState {
  form: FormData;
  landAreas: LandArea[];
  nextIndex: number;
  nextCustomIndex?: number;
  incomeRows?: IncomeExpenseRow[];
  expenseRows?: IncomeExpenseRow[];
  corruptionRows?: CorruptionRow[];
  profitLossRows?: ProfitLossRow[];
}

/** Generate a short random domain key for URL sharing. */
function generateDomainKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";
  for (let i = 0; i < 8; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

/** Recompute all derived values for land areas after restoring state. */
function recomputeAreas(areas: LandArea[]): LandArea[] {
  return areas.map((row) => {
    // Custom areas keep their manually-entered values
    if (row.isCustom) return row;
    const s = row.settlement;
    const d = row.fertilityDice;
    return {
      ...row,
      population: getPopulation(s, d),
      income: getIncome(s, d),
      ...getMilitary(s, d),
    };
  });
}

function createIncomeExpenseRow(description = "", fixedDescription = false): IncomeExpenseRow {
  return {
    id: Date.now() + Math.floor(Math.random() * 10000),
    description,
    amount: "",
    ...(fixedDescription ? { fixedDescription: true } : {}),
  };
}

function getDefaultExpenseRows(): IncomeExpenseRow[] {
  return [
    { id: Date.now() + 1, description: "Ruler Salary / Lifestyle", amount: "", fixedDescription: true },
    { id: Date.now() + 2, description: "High Magistrate Salary", amount: "", fixedDescription: true },
    { id: Date.now() + 3, description: "", amount: "" },
  ];
}

function createCorruptionRow(description = "", fixedDescription = false): CorruptionRow {
  return {
    id: Date.now() + Math.floor(Math.random() * 10000),
    description,
    percent: "",
    ...(fixedDescription ? { fixedDescription: true } : {}),
  };
}

function getDefaultCorruptionRows(): CorruptionRow[] {
  return [
    { id: Date.now() + 10, description: "Corruption from Micro-Domain Population", percent: "0", fixedDescription: true },
    { id: Date.now() + 11, description: "Ruler Bonus", percent: "0", fixedDescription: true },
    { id: Date.now() + 12, description: "Magistrate Bonus", percent: "0", fixedDescription: true },
    { id: Date.now() + 13, description: "", percent: "" },
  ];
}

/** Map total population to corruption percentage using defined brackets. */
function getCorruptionFromPopulation(totalPop: number): number {
  if (totalPop >= 10000) return 50;
  if (totalPop >= 9000) return 45;
  if (totalPop >= 8000) return 40;
  if (totalPop >= 7000) return 35;
  if (totalPop >= 6000) return 30;
  if (totalPop >= 5000) return 25;
  if (totalPop >= 4000) return 20;
  if (totalPop >= 3000) return 15;
  if (totalPop >= 2000) return 10;
  if (totalPop >= 1000) return 5;
  return 0;
}

function createProfitLossRow(description = "", fixedDescription = false): ProfitLossRow {
  return {
    id: Date.now() + Math.floor(Math.random() * 10000),
    description,
    amount: "",
    ...(fixedDescription ? { fixedDescription: true } : {}),
  };
}

function getDefaultProfitLossRows(): ProfitLossRow[] {
  return [
    { id: Date.now() + 20, description: "", amount: "" },
  ];
}

function getDefaultState(): DomainState {
  return {
    form: {
      domainName: "",
      rulerName: "",
      rulerSkill: "",
      magistrateName: "",
      magistrateSkill: "",
      roadNetwork: "none",
    },
    landAreas: [
      {
        id: Date.now(),
        area: "Land Area",
        size: "4",
        settlement: "-",
        linkedSettlement: "-",
        constructionComplete: false,
        constructionNote: "",
        population: "-",
        fertilityDice: "",
        income: "-",
        samurais: "-",
        ashigurus: "-",
        highlanders: "-",
        other: "-",
      },
    ],
    nextIndex: 2,
    incomeRows: [createIncomeExpenseRow()],
    expenseRows: getDefaultExpenseRows(),
    corruptionRows: getDefaultCorruptionRows(),
    profitLossRows: getDefaultProfitLossRows(),
  };
}

/** Ensure restored form data has all required fields with valid defaults. */
function normalizeForm(form: Partial<FormData>): FormData {
  return {
    domainName: form.domainName ?? "",
    rulerName: form.rulerName ?? "",
    rulerSkill: form.rulerSkill ?? "",
    magistrateName: form.magistrateName ?? "",
    magistrateSkill: form.magistrateSkill ?? "",
    roadNetwork: (form.roadNetwork === "none" || form.roadNetwork === "unpaved" || form.roadNetwork === "paved")
      ? form.roadNetwork
      : "none",
  };
}

/** Ensure a restored LandArea has all required fields with safe defaults. */
function normalizeLandArea(row: Partial<LandArea> & { id: number }): LandArea {
  return {
    id: row.id,
    area: row.area ?? "Land Area",
    size: row.size ?? "4",
    settlement: row.settlement ?? "-",
    linkedSettlement: row.linkedSettlement ?? "-",
    constructionComplete: row.constructionComplete ?? false,
    constructionNote: row.constructionNote ?? "",
    population: row.population ?? "-",
    fertilityDice: (row.fertilityDice as FertilityDice) ?? "",
    income: row.income ?? "-",
    samurais: row.samurais ?? "-",
    ashigurus: row.ashigurus ?? "-",
    highlanders: row.highlanders ?? "-",
    other: row.other ?? "-",
    groupId: row.groupId,
    isGroupPrimary: row.isGroupPrimary,
    linkedVillageIds: Array.isArray(row.linkedVillageIds) ? row.linkedVillageIds : undefined,
    isCustom: row.isCustom,
  };
}

/** Parse a DomainState from a JSON string, normalizing and recomputing. */
function parseDomainState(raw: string): DomainState | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const form = parsed.form && typeof parsed.form === "object"
      ? normalizeForm(parsed.form)
      : getDefaultState().form;

    let landAreas: LandArea[];
    if (Array.isArray(parsed.landAreas) && parsed.landAreas.length > 0) {
      landAreas = parsed.landAreas.map((row: Record<string, unknown>) => {
        // Ensure each row has at least an id
        const id = typeof row.id === "number" ? row.id : Date.now() + Math.floor(Math.random() * 10000);
        return normalizeLandArea({ ...row, id } as Partial<LandArea> & { id: number });
      });
      landAreas = recomputeAreas(landAreas);
    } else {
      landAreas = getDefaultState().landAreas;
    }

    const nextIndex = typeof parsed.nextIndex === "number" ? parsed.nextIndex : landAreas.length + 1;
    const nextCustomIndex = typeof parsed.nextCustomIndex === "number"
      ? parsed.nextCustomIndex
      : (landAreas.filter((r) => r.isCustom).length + 1);

    return {
      form,
      landAreas,
      nextIndex,
      nextCustomIndex,
      incomeRows: Array.isArray(parsed.incomeRows) ? parsed.incomeRows : undefined,
      expenseRows: Array.isArray(parsed.expenseRows) ? parsed.expenseRows : undefined,
      corruptionRows: Array.isArray(parsed.corruptionRows) ? parsed.corruptionRows : undefined,
      profitLossRows: Array.isArray(parsed.profitLossRows) ? parsed.profitLossRows : undefined,
    };
  } catch (err) {
    console.warn("[parseDomainState] Failed to parse domain state:", err);
    return null;
  }
}

/* ── Confirm Reset Modal ───────────────────────────────────── */

function ConfirmResetModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-[#262D35] border border-[#4A5568] rounded-md shadow-2xl px-6 py-5 max-w-[340px] w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
        <p className="text-[13px] text-[#F0EDE8] leading-relaxed">
          Are you sure you want to reset your micro-domain? All entered information will be permanently lost and cannot be recovered.
        </p>
        <div className="flex items-center gap-2 mt-4">
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-8 text-[12px] font-medium rounded-sm bg-[#3A4250] text-[#A8B0B8] hover:bg-[#4A5568] hover:text-[#F0EDE8] transition-colors border border-[#4A5568]"
          >
            Yes, reset
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-8 text-[12px] font-medium rounded-sm bg-[#8B3838] text-[#F0EDE8] hover:bg-[#A04848] transition-colors"
          >
            No, keep it
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────── */

/** Normalize expense rows to ensure fixed rows exist (migration helper). */
function normalizeExpenseRows(restored: IncomeExpenseRow[] | undefined): IncomeExpenseRow[] {
  if (!restored || restored.length === 0) return getDefaultExpenseRows();
  const hasRuler = restored.some((r) => r.fixedDescription && r.description === "Ruler Salary / Lifestyle");
  const hasMagistrate = restored.some((r) => r.fixedDescription && r.description === "High Magistrate Salary");
  if (hasRuler && hasMagistrate) return restored;
  const fixedRows: IncomeExpenseRow[] = [];
  if (!hasRuler) fixedRows.push({ id: Date.now() + 1, description: "Ruler Salary / Lifestyle", amount: "", fixedDescription: true });
  if (!hasMagistrate) fixedRows.push({ id: Date.now() + 2, description: "High Magistrate Salary", amount: "", fixedDescription: true });
  return [...fixedRows, ...restored];
}

/** Normalize corruption rows to ensure fixed rows exist (migration helper). */
function normalizeCorruptionRows(restored: CorruptionRow[] | undefined): CorruptionRow[] {
  if (!restored || restored.length === 0) return getDefaultCorruptionRows();
  // Migrate old name to new name
  const migrated = restored.map((r) => {
    if (r.fixedDescription && r.description === "Corruption from Micro-Domain Size") {
      return { ...r, description: "Corruption from Micro-Domain Population" };
    }
    return r;
  });
  const hasPop = migrated.some((r) => r.fixedDescription && r.description === "Corruption from Micro-Domain Population");
  const hasRuler = migrated.some((r) => r.fixedDescription && r.description === "Ruler Bonus");
  const hasMagistrate = migrated.some((r) => r.fixedDescription && r.description === "Magistrate Bonus");
  if (hasPop && hasRuler && hasMagistrate) return migrated;
  const fixedRows: CorruptionRow[] = [];
  if (!hasPop) fixedRows.push({ id: Date.now() + 10, description: "Corruption from Micro-Domain Population", percent: "0", fixedDescription: true });
  if (!hasRuler) fixedRows.push({ id: Date.now() + 11, description: "Ruler Bonus", percent: "0", fixedDescription: true });
  if (!hasMagistrate) fixedRows.push({ id: Date.now() + 12, description: "Magistrate Bonus", percent: "0", fixedDescription: true });
  return [...fixedRows, ...migrated.filter((r) => !r.fixedDescription)];
}

export default function DomainManager() {
  const defaultState = useRef(getDefaultState()).current;

  const [form, setForm] = useState<FormData>(defaultState.form);
  const [landAreas, setLandAreas] = useState<LandArea[]>(defaultState.landAreas);
  const [nextIndex, setNextIndex] = useState(defaultState.nextIndex);
  const [nextCustomIndex, setNextCustomIndex] = useState(defaultState.nextCustomIndex ?? 1);

  /* Cloud persistence state */
  const [domainKey, setDomainKey] = useState<string | null>(null);
  /** The database record ID — set after first cloud save or cloud load. */
  const [cloudRecordId, setCloudRecordId] = useState<number | null>(null);

  /* Loading state for cloud fetch on page load */
  const [cloudLoading, setCloudLoading] = useState(false);
  /** If cloud load failed, show a non-blocking warning */
  const [cloudLoadError, setCloudLoadError] = useState<string | null>(null);

  /* About accordion state */
  const [aboutOpen, setAboutOpen] = useState(false);

  /* Delete confirmation state */
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    areaName: string;
  } | null>(null);

  /* Reset confirmation state */
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  /* Save link state */
  const [linkCopied, setLinkCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  /* Track rows with multi-area validation errors */
  const [multiAreaInvalidRows, setMultiAreaInvalidRows] = useState<Set<number>>(new Set());

  /* Income & Expense rows */
  const [incomeRows, setIncomeRows] = useState<IncomeExpenseRow[]>(
    defaultState.incomeRows ?? [createIncomeExpenseRow()]
  );
  const [expenseRows, setExpenseRows] = useState<IncomeExpenseRow[]>(
    defaultState.expenseRows ?? getDefaultExpenseRows()
  );

  /* Corruption & Profit/Loss rows */
  const [corruptionRows, setCorruptionRows] = useState<CorruptionRow[]>(
    defaultState.corruptionRows ?? getDefaultCorruptionRows()
  );
  const [profitLossRows, setProfitLossRows] = useState<ProfitLossRow[]>(
    defaultState.profitLossRows ?? getDefaultProfitLossRows()
  );

  /* ── Load from Atoms Cloud on mount if ?d= param present ── */
  const cloudLoadDone = useRef(false);
  useEffect(() => {
    if (cloudLoadDone.current) return;
    cloudLoadDone.current = true;

    const params = new URLSearchParams(window.location.search);
    const dKey = params.get("d");
    if (!dKey) return;

    setCloudLoading(true);
    setCloudLoadError(null);

    loadDomainByKey(dKey)
      .then((record: DomainRecord | null) => {
        if (!record) {
          console.warn("[cloud-load] No record found for key:", dKey);
          setCloudLoadError("No saved Micro-Domain found for this link. Starting with a blank domain.");
          return;
        }
        try {
          const state = parseDomainState(record.state_json);
          if (state) {
            setForm(state.form);
            setLandAreas(state.landAreas);
            setNextIndex(state.nextIndex);
            setNextCustomIndex(state.nextCustomIndex ?? (state.landAreas.filter((r) => r.isCustom).length + 1));
            setIncomeRows(state.incomeRows ?? [createIncomeExpenseRow()]);
            setExpenseRows(normalizeExpenseRows(state.expenseRows));
            setCorruptionRows(normalizeCorruptionRows(state.corruptionRows));
            setProfitLossRows(state.profitLossRows ?? getDefaultProfitLossRows());
            setDomainKey(record.domain_key);
            setCloudRecordId(record.id);
          } else {
            console.warn("[cloud-load] Failed to parse state_json for key:", dKey);
            setCloudLoadError("The saved Micro-Domain data could not be parsed. Starting with a blank domain.");
          }
        } catch (parseErr) {
          console.error("[cloud-load] Error restoring state:", parseErr);
          setCloudLoadError("Error restoring saved Micro-Domain. Starting with a blank domain.");
        }
      })
      .catch((err) => {
        console.error("[cloud-load] Failed to fetch domain:", err);
        setCloudLoadError("Could not load the saved Micro-Domain from the cloud. The server may be starting up — please try refreshing the page.");
      })
      .finally(() => setCloudLoading(false));
  }, []);

  /* Compute total income from Land Areas (mirrors the TOTAL footer logic) */
  const landAreasTotalIncome = useMemo(() => {
    let totalIncome = 0;
    const countedGroups = new Set<string>();

    for (const row of landAreas) {
      // Custom areas: always include their income
      if (row.isCustom) {
        const incomeNum = parseFloat(row.income);
        if (!isNaN(incomeNum)) totalIncome += incomeNum;
        continue;
      }

      if (row.groupId) {
        if (countedGroups.has(row.groupId)) continue;
        countedGroups.add(row.groupId);
        const primary = landAreas.find((r) => r.groupId === row.groupId && r.isGroupPrimary);
        if (!primary) continue;
        const isInvalid = multiAreaInvalidRows.has(primary.id);
        const groupRows = landAreas.filter((r) => r.groupId === row.groupId);
        const allDiceValid = groupRows.every((r) => r.fertilityDice !== "" && isFertilityMet(r.settlement, r.fertilityDice));
        const groupLinkedVal = getLinkedVillageValidation(primary, landAreas, form.roadNetwork);
        if (!isInvalid && allDiceValid && !groupLinkedVal.isInvalid && primary.constructionComplete) {
          const incomeNum = parseFloat(primary.income);
          if (!isNaN(incomeNum)) totalIncome += incomeNum;
        }
        continue;
      }
      const linkedVal = getLinkedVillageValidation(row, landAreas, form.roadNetwork);
      const invalid = linkedVal.isInvalid || isSettlementRowInvalid(row.settlement, row.fertilityDice);
      if (!invalid && row.constructionComplete) {
        const incomeNum = parseFloat(row.income);
        if (!isNaN(incomeNum)) totalIncome += incomeNum;
      }
    }
    return totalIncome;
  }, [landAreas, multiAreaInvalidRows, form.roadNetwork]);

  /* Compute total population from Land Areas (mirrors the TOTAL footer logic) */
  const landAreasTotalPopulation = useMemo(() => {
    let totalPop = 0;
    const countedGroups = new Set<string>();

    for (const row of landAreas) {
      // Custom areas: always include their population
      if (row.isCustom) {
        const popNum = parseInt(row.population, 10);
        if (!isNaN(popNum)) totalPop += popNum;
        continue;
      }

      if (row.groupId) {
        if (countedGroups.has(row.groupId)) continue;
        countedGroups.add(row.groupId);
        const primary = landAreas.find((r) => r.groupId === row.groupId && r.isGroupPrimary);
        if (!primary) continue;
        const isInvalid = multiAreaInvalidRows.has(primary.id);
        const groupRows = landAreas.filter((r) => r.groupId === row.groupId);
        const allDiceValid = groupRows.every((r) => r.fertilityDice !== "" && isFertilityMet(r.settlement, r.fertilityDice));
        const groupLinkedVal = getLinkedVillageValidation(primary, landAreas, form.roadNetwork);
        if (!isInvalid && allDiceValid && !groupLinkedVal.isInvalid && primary.constructionComplete) {
          const popNum = parseInt(primary.population, 10);
          if (!isNaN(popNum)) totalPop += popNum;
        }
        continue;
      }
      const linkedVal = getLinkedVillageValidation(row, landAreas, form.roadNetwork);
      const invalid = linkedVal.isInvalid || isSettlementRowInvalid(row.settlement, row.fertilityDice);
      if (!invalid && row.constructionComplete) {
        const popNum = parseInt(row.population, 10);
        if (!isNaN(popNum)) totalPop += popNum;
      }
    }
    return totalPop;
  }, [landAreas, multiAreaInvalidRows, form.roadNetwork]);

  /* ── Re-validate multi-area settlements on every state change ── */
  useEffect(() => {
    const invalidIds = new Set<number>();
    const groupMap = buildGroupMap(landAreas);

    // Check all grouped settlements have the required number of member rows
    for (const [, info] of groupMap) {
      const config = SETTLEMENT_CONFIGS[info.settlement];
      if (config?.requiredAreas && config.requiredAreas > 1) {
        // Group must have exactly the required number of members
        if (info.memberIds.length !== config.requiredAreas) {
          invalidIds.add(info.primaryId);
        }
        // Verify group integrity: must have exactly one primary
        const primaryRows = landAreas.filter(
          (r) => r.groupId === info.groupId && r.isGroupPrimary
        );
        if (primaryRows.length !== 1) {
          invalidIds.add(info.primaryId);
        }
        // Verify all member rows reference the same settlement
        const memberRows = landAreas.filter((r) => r.groupId === info.groupId);
        if (memberRows.some((r) => r.settlement !== info.settlement)) {
          invalidIds.add(info.primaryId);
        }
      }
    }

    // Check non-grouped rows that have a multi-area settlement type
    // (rows where grouping failed at creation, or broken persistence)
    // Skip custom areas — they don't follow settlement validation rules
    for (const row of landAreas) {
      if (row.isCustom) continue;
      if (row.settlement !== "-" && !row.groupId) {
        const config = SETTLEMENT_CONFIGS[row.settlement];
        if (config?.requiredAreas && config.requiredAreas > 1) {
          invalidIds.add(row.id);
        }
      }
    }

    // Always update — set to empty if nothing is invalid, or to the new set
    setMultiAreaInvalidRows((prev) => {
      // Avoid unnecessary re-renders if the sets are identical
      if (prev.size === invalidIds.size && [...invalidIds].every((id) => prev.has(id))) {
        return prev;
      }
      return invalidIds;
    });
  }, [landAreas]); // Re-run on every landAreas change

  /* ── Handlers ──────────────────────────────────────────── */

  const createLandArea = useCallback(
    (index: number): LandArea => ({
      id: Date.now() + index,
      area: "Land Area",
      size: "4",
      settlement: "-",
      linkedSettlement: "-",
      constructionComplete: false,
      constructionNote: "",
      population: "-",
      fertilityDice: "",
      income: "-",
      samurais: "-",
      ashigurus: "-",
      highlanders: "-",
      other: "-",
    }),
    []
  );

  const handleChange =
    (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleLandUpdate = useCallback(
    (id: number, patch: Partial<LandArea>) => {
      setLandAreas((prev) => {
        let newAreas = [...prev];

        // Custom areas: simple direct update, no settlement validation logic
        const targetRow = newAreas.find((r) => r.id === id);
        if (targetRow?.isCustom) {
          return newAreas.map((row) => {
            if (row.id !== id) return row;
            return { ...row, ...patch };
          });
        }

        // Handle settlement change — may trigger grouping/ungrouping
        if ("settlement" in patch) {
          const rowIdx = newAreas.findIndex((r) => r.id === id);
          if (rowIdx < 0) return prev;
          const currentRow = newAreas[rowIdx];
          const newSettlement = patch.settlement ?? "-";
          const oldSettlement = currentRow.settlement;
          const newConfig = SETTLEMENT_CONFIGS[newSettlement];
          const oldConfig = SETTLEMENT_CONFIGS[oldSettlement];

          // Ungrouping: if the row was part of a multi-area group, release all grouped rows
          if (currentRow.groupId && currentRow.isGroupPrimary) {
            const groupId = currentRow.groupId;
            newAreas = newAreas.map((r) => {
              if (r.groupId === groupId) {
                if (r.id === id) {
                  // This is the primary row being changed — clear group and linked village data
                  return { ...r, groupId: undefined, isGroupPrimary: undefined, linkedVillageIds: undefined };
                }
                // Secondary rows: reset to free
                return {
                  ...r,
                  settlement: "-",
                  linkedSettlement: "-",
                  constructionComplete: false,
                  constructionNote: "",
                  population: "-",
                  income: "-",
                  samurais: "-",
                  ashigurus: "-",
                  highlanders: "-",
                  other: "-",
                  groupId: undefined,
                  isGroupPrimary: undefined,
                };
              }
              return r;
            });
            // Clear multi-area invalid for this row
            setMultiAreaInvalidRows((prevInvalid) => {
              const next = new Set(prevInvalid);
              next.delete(id);
              return next;
            });
          } else if (currentRow.groupId && !currentRow.isGroupPrimary) {
            // Secondary row trying to change settlement — shouldn't happen normally
            // but handle gracefully: just ignore
            return prev;
          }

          // If old settlement was a multi-area type but row wasn't grouped (was invalid),
          // clear the invalid state
          if (oldConfig?.requiredAreas && oldConfig.requiredAreas > 1) {
            setMultiAreaInvalidRows((prevInvalid) => {
              const next = new Set(prevInvalid);
              next.delete(id);
              return next;
            });
          }

          // Now apply the new settlement
          if (newConfig?.requiredAreas && newConfig.requiredAreas > 1) {
            // Multi-area settlement: try to group
            const requiredAreas = newConfig.requiredAreas;

            // Count free areas (excluding the current row)
            const freeRows = newAreas.filter((r) => r.id !== id && isRowFree(r));

            if (freeRows.length < requiredAreas - 1) {
              // Not enough free areas — mark as invalid
              const updatedRow = { ...newAreas[rowIdx], ...patch };
              updatedRow.settlement = newSettlement;
              updatedRow.population = "-";
              updatedRow.income = "-";
              updatedRow.samurais = "-";
              updatedRow.ashigurus = "-";
              updatedRow.highlanders = "-";
              updatedRow.groupId = undefined;
              updatedRow.isGroupPrimary = undefined;
              newAreas[rowIdx] = updatedRow;

              setMultiAreaInvalidRows((prevInvalid) => {
                const next = new Set(prevInvalid);
                next.add(id);
                return next;
              });

              return newAreas;
            }

            // Enough free areas — create the group
            const gid = generateGroupId();
            const selectedFreeRows = freeRows.slice(0, requiredAreas - 1);

            // Update the primary row
            const s = newSettlement;
            const d = newAreas[rowIdx].fertilityDice;
            const primaryRow: LandArea = {
              ...newAreas[rowIdx],
              settlement: s,
              linkedSettlement: newAreas[rowIdx].linkedSettlement,
              population: getPopulation(s, d),
              income: getIncome(s, d),
              ...getMilitary(s, d),
              groupId: gid,
              isGroupPrimary: true,
            };
            newAreas[rowIdx] = primaryRow;

            // Update secondary rows
            for (const freeRow of selectedFreeRows) {
              const fIdx = newAreas.findIndex((r) => r.id === freeRow.id);
              if (fIdx >= 0) {
                newAreas[fIdx] = {
                  ...newAreas[fIdx],
                  settlement: s,
                  linkedSettlement: primaryRow.linkedSettlement,
                  constructionComplete: primaryRow.constructionComplete,
                  constructionNote: primaryRow.constructionNote,
                  population: primaryRow.population,
                  income: primaryRow.income,
                  samurais: primaryRow.samurais,
                  ashigurus: primaryRow.ashigurus,
                  highlanders: primaryRow.highlanders,
                  groupId: gid,
                  isGroupPrimary: false,
                };
              }
            }

            // Clear any invalid state
            setMultiAreaInvalidRows((prevInvalid) => {
              const next = new Set(prevInvalid);
              next.delete(id);
              return next;
            });

            // Reorder: move secondary rows right after the primary row
            const primaryIdx = newAreas.findIndex((r) => r.id === id);
            const secondaryIds = new Set(selectedFreeRows.map((r) => r.id));
            const secondaries = newAreas.filter((r) => secondaryIds.has(r.id));
            const rest = newAreas.filter((r) => !secondaryIds.has(r.id));
            const insertIdx = rest.findIndex((r) => r.id === id);
            rest.splice(insertIdx + 1, 0, ...secondaries);
            return rest;
          }

          // Regular single-area settlement change
          newAreas = newAreas.map((r) => {
            if (r.id !== id) return r;
            const updated = { ...r, ...patch };
            const s = updated.settlement;
            const d = updated.fertilityDice;
            updated.population = getPopulation(s, d);
            updated.income = getIncome(s, d);
            const mil = getMilitary(s, d);
            updated.samurais = mil.samurais;
            updated.ashigurus = mil.ashigurus;
            updated.highlanders = mil.highlanders;
            // Clear linkedVillageIds when changing away from a linked-village settlement
            if (isLinkedVillageSettlement(oldSettlement) && !isLinkedVillageSettlement(newSettlement)) {
              updated.linkedVillageIds = undefined;
            }
            return updated;
          });

          // If a linkable settlement was changed to something else, clear any linked-village settlement links to it
          const wasLinkable = oldSettlement === "Tenant Village" || oldSettlement === "Mountain Tauric Permaculture Village";
          const isStillSame = oldSettlement === newSettlement;
          if (wasLinkable && !isStillSame) {
            newAreas = newAreas.map((r) => {
              if (isLinkedVillageSettlement(r.settlement) && r.linkedVillageIds) {
                const cleaned = r.linkedVillageIds.map((vid) => (vid === id ? 0 : vid));
                return { ...r, linkedVillageIds: cleaned };
              }
              return r;
            });
          }

          return newAreas;
        }

        // Handle linkedVillageIds update for Agricultural Villa
        if ("linkedVillageIds" in patch) {
          newAreas = newAreas.map((row) => {
            if (row.id !== id) return row;
            return { ...row, ...patch };
          });
          return newAreas;
        }

        // Default: update a single row (fertility dice, etc.)
        newAreas = newAreas.map((row) => {
          if (row.id !== id) return row;
          const updated = { ...row, ...patch };

          if ("fertilityDice" in patch) {
            const s = updated.settlement;
            const d = updated.fertilityDice;
            updated.population = getPopulation(s, d);
            updated.income = getIncome(s, d);
            const mil = getMilitary(s, d);
            updated.samurais = mil.samurais;
            updated.ashigurus = mil.ashigurus;
            updated.highlanders = mil.highlanders;
          }

          return updated;
        });

        return newAreas;
      });
    },
    []
  );

  const handleAddLandArea = useCallback(() => {
    setLandAreas((prev) => [...prev, createLandArea(nextIndex)]);
    setNextIndex((n) => n + 1);
  }, [nextIndex, createLandArea]);

  const handleAddCustomLandArea = useCallback(() => {
    const customArea: LandArea = {
      id: Date.now() + nextCustomIndex + 9000,
      area: "Custom Area",
      size: "4",
      settlement: "-",
      linkedSettlement: "-",
      constructionComplete: false,
      constructionNote: "",
      population: "-",
      fertilityDice: "",
      income: "-",
      samurais: "-",
      ashigurus: "-",
      highlanders: "-",
      other: "0",
      isCustom: true,
    };
    setLandAreas((prev) => [...prev, customArea]);
    setNextCustomIndex((n) => n + 1);
  }, [nextCustomIndex]);

  const handleMoveRow = useCallback(
    (id: number, direction: "up" | "down") => {
      setLandAreas((prev) => {
        const newAreas = [...prev];
        const idx = newAreas.findIndex((r) => r.id === id);
        if (idx < 0) return prev;

        const row = newAreas[idx];

        // For grouped primary rows, move the entire group
        if (row.groupId && row.isGroupPrimary) {
          const groupId = row.groupId;
          // Find all contiguous group rows starting from idx
          const groupIndices: number[] = [];
          for (let i = 0; i < newAreas.length; i++) {
            if (newAreas[i].groupId === groupId) groupIndices.push(i);
          }
          if (groupIndices.length === 0) return prev;

          const firstIdx = groupIndices[0];
          const lastIdx = groupIndices[groupIndices.length - 1];

          if (direction === "up" && firstIdx > 0) {
            // Move the row above the group to after the group
            const aboveRow = newAreas.splice(firstIdx - 1, 1)[0];
            // After splice, the group shifted up by 1, so insert after lastIdx - 1
            newAreas.splice(lastIdx, 0, aboveRow);
            return newAreas;
          }
          if (direction === "down" && lastIdx < newAreas.length - 1) {
            // Move the row below the group to before the group
            const belowRow = newAreas.splice(lastIdx + 1, 1)[0];
            newAreas.splice(firstIdx, 0, belowRow);
            return newAreas;
          }
          return prev;
        }

        // Single row move
        if (direction === "up" && idx > 0) {
          [newAreas[idx - 1], newAreas[idx]] = [newAreas[idx], newAreas[idx - 1]];
          return newAreas;
        }
        if (direction === "down" && idx < newAreas.length - 1) {
          [newAreas[idx], newAreas[idx + 1]] = [newAreas[idx + 1], newAreas[idx]];
          return newAreas;
        }
        return prev;
      });
    },
    []
  );

  const handleRequestDelete = useCallback(
    (id: number) => {
      const row = landAreas.find((r) => r.id === id);
      if (!row) return;

      const idx = landAreas.findIndex((r) => r.id === id);
      if (idx < 0) return;

      // For grouped primary rows, use the settlement display name
      if (row.groupId && row.isGroupPrimary) {
        const displayNames = getSettlementDisplayNames(landAreas);
        const displayName = displayNames.get(row.id) ?? row.settlement;
        setDeleteTarget({ id, areaName: displayName });
      } else {
        setDeleteTarget({ id, areaName: row.area });
      }
    },
    [landAreas]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    const row = landAreas.find((r) => r.id === deleteTarget.id);

    setLandAreas((prev) => {
      let newAreas: LandArea[];
      // If deleting a grouped primary, remove ALL rows in the group
      if (row?.groupId && row.isGroupPrimary) {
        const groupId = row.groupId;
        const deletedIds = new Set(prev.filter((r) => r.groupId === groupId).map((r) => r.id));
        newAreas = prev.filter((r) => r.groupId !== groupId);
        // Clear linked-village settlement links to any deleted linkable settlement
        newAreas = newAreas.map((r) => {
          if (isLinkedVillageSettlement(r.settlement) && r.linkedVillageIds) {
            const cleaned = r.linkedVillageIds.map((vid) => (deletedIds.has(vid) ? 0 : vid));
            return { ...r, linkedVillageIds: cleaned };
          }
          return r;
        });
      } else {
        // Single-area row: just remove that one row
        newAreas = prev.filter((r) => r.id !== deleteTarget.id);
        // Clear linked-village settlement links to the deleted row
        const isLinkableChild = row?.settlement === "Tenant Village" || row?.settlement === "Mountain Tauric Permaculture Village";
        if (isLinkableChild) {
          newAreas = newAreas.map((r) => {
            if (isLinkedVillageSettlement(r.settlement) && r.linkedVillageIds) {
              const cleaned = r.linkedVillageIds.map((vid) => (vid === deleteTarget.id ? 0 : vid));
              return { ...r, linkedVillageIds: cleaned };
            }
            return r;
          });
        }
        // If deleting a linked-village settlement, just remove it (links are on the row itself)
      }
      return newAreas;
    });

    // Clear multi-area invalid
    setMultiAreaInvalidRows((prevInvalid) => {
      const next = new Set(prevInvalid);
      next.delete(deleteTarget.id);
      return next;
    });

    setDeleteTarget(null);
  }, [deleteTarget, landAreas]);

  const handleCancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  /* ── Income & Expense Handlers ─────────────────────────── */

  const handleIncomeUpdate = useCallback(
    (id: number, patch: Partial<IncomeExpenseRow>) => {
      setIncomeRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
      );
    },
    []
  );

  const handleExpenseUpdate = useCallback(
    (id: number, patch: Partial<IncomeExpenseRow>) => {
      setExpenseRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
      );
    },
    []
  );

  const handleAddIncomeRow = useCallback(() => {
    setIncomeRows((prev) => [...prev, createIncomeExpenseRow()]);
  }, []);

  const handleAddExpenseRow = useCallback(() => {
    setExpenseRows((prev) => [...prev, createIncomeExpenseRow()]);
  }, []);

  const handleDeleteIncomeRow = useCallback((id: number) => {
    setIncomeRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleDeleteExpenseRow = useCallback((id: number) => {
    setExpenseRows((prev) => {
      const row = prev.find((r) => r.id === id);
      if (row?.fixedDescription) return prev; // never delete fixed rows
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  /* ── Corruption Handlers ───────────────────────────────── */

  const handleCorruptionUpdate = useCallback(
    (id: number, patch: Partial<CorruptionRow>) => {
      setCorruptionRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
      );
    },
    []
  );

  const handleAddCorruptionRow = useCallback(() => {
    setCorruptionRows((prev) => [...prev, createCorruptionRow()]);
  }, []);

  const handleDeleteCorruptionRow = useCallback((id: number) => {
    setCorruptionRows((prev) => {
      const row = prev.find((r) => r.id === id);
      if (row?.fixedDescription) return prev;
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  /* ── Profit/Loss Handlers ──────────────────────────────── */

  const handleProfitLossUpdate = useCallback(
    (id: number, patch: Partial<ProfitLossRow>) => {
      setProfitLossRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
      );
    },
    []
  );

  const handleAddProfitLossRow = useCallback(() => {
    setProfitLossRows((prev) => [...prev, createProfitLossRow()]);
  }, []);

  const handleDeleteProfitLossRow = useCallback((id: number) => {
    setProfitLossRows((prev) => {
      const row = prev.find((r) => r.id === id);
      if (row?.fixedDescription) return prev;
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  /* ── Computed totals for Corruption & Profit/Loss ─────── */

  const totalIncomeAmount = useMemo(() => {
    const fixedAmount = landAreasTotalIncome;
    const userTotal = incomeRows.reduce((sum, r) => {
      const num = parseFloat(r.amount);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
    return fixedAmount + userTotal;
  }, [landAreasTotalIncome, incomeRows]);

  const totalExpenseAmount = useMemo(() => {
    return expenseRows.reduce((sum, r) => {
      const num = parseFloat(r.amount);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  }, [expenseRows]);

  /* Computed fixed corruption row values */
  const corruptionFromPopulation = useMemo(
    () => getCorruptionFromPopulation(landAreasTotalPopulation),
    [landAreasTotalPopulation]
  );

  const rulerCorruptionBonus = useMemo(() => {
    const skill = parseFloat(form.rulerSkill);
    if (isNaN(skill)) return 0;
    return -skill; // inverse: skill 5 → -5%, skill -2 → 2%
  }, [form.rulerSkill]);

  const magistrateCorruptionBonus = useMemo(() => {
    const skill = parseFloat(form.magistrateSkill);
    if (isNaN(skill)) return 0;
    return -skill; // inverse: skill 5 → -5%, skill -2 → 2%
  }, [form.magistrateSkill]);

  /* Sum all corruption rows: use computed values for fixed rows, stored values for editable rows */
  const totalCorruptionPercent = useMemo(() => {
    let total = corruptionFromPopulation + rulerCorruptionBonus + magistrateCorruptionBonus;
    for (const r of corruptionRows) {
      if (r.fixedDescription) continue; // skip fixed rows — already counted above
      const num = parseFloat(r.percent);
      if (!isNaN(num)) total += num;
    }
    // Clamp to 0–100%
    return Math.min(100, Math.max(0, total));
  }, [corruptionFromPopulation, rulerCorruptionBonus, magistrateCorruptionBonus, corruptionRows]);

  const corruptionGD = useMemo(() => {
    // Corruption in GD = totalIncome * (totalCorruptionPercent / 100), rounded to integer
    return Math.round((totalIncomeAmount * totalCorruptionPercent) / 100);
  }, [totalIncomeAmount, totalCorruptionPercent]);

  const totalProfitLoss = useMemo(() => {
    return totalIncomeAmount - corruptionGD - totalExpenseAmount;
  }, [totalIncomeAmount, corruptionGD, totalExpenseAmount]);

  /* ── Save Link (persistent domain record via Atoms Cloud) ── */

  /** Build the domain URL from a given key. */
  const buildDomainUrl = useCallback((key: string) => {
    return `${window.location.origin}${window.location.pathname}?d=${key}`;
  }, []);

  /** The stable domain link — shown if domain has been saved at least once. */
  const domainLink = domainKey ? buildDomainUrl(domainKey) : null;

  const handleSaveLink = useCallback(async () => {
    const state: DomainState = { form, landAreas, nextIndex, nextCustomIndex, incomeRows, expenseRows, corruptionRows, profitLossRows };
    const stateJson = JSON.stringify(state);
    let key = domainKey;

    // First save: generate a new domain key
    if (!key) {
      key = generateDomainKey();
    }

    setSaving(true);
    setSaveSuccess(false);
    try {
      const record = await saveDomain(
        key,
        form.domainName,
        stateJson,
        cloudRecordId ?? undefined
      );
      setDomainKey(record.domain_key);
      setCloudRecordId(record.id);
      // Update URL if not already set
      const currentParams = new URLSearchParams(window.location.search);
      if (currentParams.get("d") !== record.domain_key) {
        window.history.replaceState(null, "", `${window.location.pathname}?d=${record.domain_key}`);
      }
      setLinkCopied(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save domain to cloud:", err);
      // Fallback: still show the key so user can retry
      if (!domainKey) {
        setDomainKey(key);
      }
    } finally {
      setSaving(false);
    }
  }, [form, landAreas, nextIndex, nextCustomIndex, incomeRows, expenseRows, corruptionRows, profitLossRows, domainKey, cloudRecordId]);

  const handleCopyLink = useCallback(() => {
    if (!domainLink) return;
    navigator.clipboard.writeText(domainLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }, [domainLink]);

  /* ── Reset ─────────────────────────────────────────────── */

  const handleConfirmReset = useCallback(() => {
    const def = getDefaultState();
    setForm(def.form);
    setLandAreas(def.landAreas);
    setNextIndex(def.nextIndex);
    setNextCustomIndex(1);
    setIncomeRows(def.incomeRows ?? [createIncomeExpenseRow()]);
    setExpenseRows(def.expenseRows ?? getDefaultExpenseRows());
    setCorruptionRows(def.corruptionRows ?? getDefaultCorruptionRows());
    setProfitLossRows(def.profitLossRows ?? getDefaultProfitLossRows());
    setMultiAreaInvalidRows(new Set());
    // Clear cloud state (we don't delete the cloud record — user can re-save)
    setDomainKey(null);
    setCloudRecordId(null);
    setLinkCopied(false);
    setSaveSuccess(false);
    // Clear URL params if present
    if (window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    setShowResetConfirm(false);
  }, []);

  /* ── Styles ────────────────────────────────────────────── */

  const textInputClass =
    "bg-[#2C333C] border-[#4A5568] text-[#F0EDE8] placeholder:text-[#505A64] h-[30px] text-[13px] rounded-sm focus-visible:ring-1 focus-visible:ring-[#D4A574] focus-visible:border-[#D4A574] transition-colors";

  const numberInputClass = `${textInputClass} w-[72px] text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;

  return (
    <div className="min-h-screen bg-[#1C2127] flex items-start justify-center px-4 py-8 md:py-12">
      {/* Full Domain warning banner */}
      {landAreasTotalPopulation >= 10000 && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-[#3D2222] border-b border-[#6B3030] shadow-lg">
          <div className="max-w-[1440px] mx-auto px-4 py-2.5 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#C45858] shrink-0" />
            <p className="text-[12px] text-[#F0D0D0] leading-relaxed">
              Your Micro-Domain population is now 10,000 or higher. This means the Micro-Domain becomes a Full Domain and now follows Full Domain rules. See the SAKE book for more details.
            </p>
          </div>
        </div>
      )}
      {/* Cloud loading overlay */}
      {cloudLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C2127]/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 text-[#D4A574] animate-spin" />
            <p className="text-[12px] text-[#A8B0B8]">Loading micro-domain from cloud…</p>
          </div>
        </div>
      )}
      {/* Cloud load error banner */}
      {cloudLoadError && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-[#332E1C] border-b border-[#4D4828] shadow-lg">
          <div className="max-w-[1440px] mx-auto px-4 py-2.5 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#D4A850] shrink-0" />
            <p className="text-[12px] text-[#F0E8B8] leading-relaxed flex-1">
              {cloudLoadError}
            </p>
            <button
              type="button"
              onClick={() => setCloudLoadError(null)}
              className="text-[11px] text-[#A8B0B8] hover:text-[#F0EDE8] px-2 py-1 rounded-sm hover:bg-[#4D4828] transition-colors shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div className="w-full max-w-[1440px] animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Page Title */}
        <header className="mb-0 text-center">
          <h1 className="text-[26px] font-bold text-[#F0EDE8] leading-none tracking-[0.08em] uppercase">
            SAKE Micro-Domain Calculator
          </h1>
          <p className="mt-1.5 text-[11px] text-[#8A95A0] font-light tracking-[0.06em]">
            By Aatomik
          </p>

          {/* About accordion */}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setAboutOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium text-[#A8B0B8] bg-[#2C333C] border border-[#4A5568] rounded-sm hover:bg-[#3A4250] hover:text-[#F0EDE8] hover:border-[#5A6577] transition-colors"
            >
              ABOUT
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${aboutOpen ? "rotate-180" : ""}`} />
            </button>

            {aboutOpen && (
              <div className="mt-2.5 mx-auto max-w-[640px] text-left bg-[#242A32] border border-[#3A424D] rounded-sm px-5 py-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-[12px] text-[#B8C0C8] leading-relaxed">
                  This is a simplified management tool for Micro-Domains in the TTRPG game SAKE (<a href="https://www.sake.ee" target="_blank" rel="noopener noreferrer" className="text-[#D4A574] underline underline-offset-2 hover:text-[#F0EDE8] transition-colors">www.sake.ee</a>).
                </p>
                <p className="mt-3 text-[12px] text-[#B8C0C8] leading-relaxed">
                  The tool helps manage your Micro-Domain more easily by automating the most common calculations and rules.
                </p>
                <p className="mt-3 text-[12px] text-[#B8C0C8] leading-relaxed">
                  The application includes the core settlements that are suitable for Micro-Domains. If you want to expand your domain further or use all the possibilities of a Full Domain, the options in this tool will intentionally remain limited.
                </p>
                <p className="mt-3 text-[12px] text-[#B8C0C8] leading-relaxed">
                  Enjoy using it!
                </p>
              </div>
            )}
          </div>
        </header>

        <div className="h-px bg-[#3A424D] my-4" />

        {/* Upper sections: left form + right save panel */}
        <div className="flex flex-col md:flex-row md:items-start md:gap-8">
          {/* Left: Domain Info Sections */}
          <div className="max-w-[480px] space-y-4 flex-shrink-0">
            {/* Domain */}
            <section>
              <SectionTitle>Micro-Domain</SectionTitle>
              <div>
                <FieldLabel>Micro-Domain Name</FieldLabel>
                <Input
                  type="text"
                  placeholder="e.g. The Verdant March"
                  value={form.domainName}
                  onChange={handleChange("domainName")}
                  className={textInputClass}
                />
              </div>
            </section>

            <div className="h-px bg-[#3A424D]" />

            {/* Domain Ruler */}
            <section>
              <SectionTitle>Micro-Domain Ruler</SectionTitle>
              <div className="flex items-end gap-3">
                <div className="flex-1 min-w-0">
                  <FieldLabel>Ruler Name</FieldLabel>
                  <Input
                    type="text"
                    placeholder="e.g. Ser Aldric Thorne"
                    value={form.rulerName}
                    onChange={handleChange("rulerName")}
                    className={textInputClass}
                  />
                </div>
                <div className="shrink-0">
                  <FieldLabelWithInfo tooltip="Law and Society Skill">L&amp;S Skill</FieldLabelWithInfo>
                  <Input
                    type="number"
                    placeholder="0"
                    min={0}
                    value={form.rulerSkill}
                    onChange={handleChange("rulerSkill")}
                    className={numberInputClass}
                  />
                </div>
              </div>
            </section>

            <div className="h-px bg-[#3A424D]" />

            {/* High Magistrate */}
            <section>
              <SectionTitle>High Magistrate</SectionTitle>
              <div className="flex items-end gap-3">
                <div className="flex-1 min-w-0">
                  <FieldLabel>Magistrate Name</FieldLabel>
                  <Input
                    type="text"
                    placeholder="e.g. Elara Windsong"
                    value={form.magistrateName}
                    onChange={handleChange("magistrateName")}
                    className={textInputClass}
                  />
                </div>
                <div className="shrink-0">
                  <FieldLabelWithInfo tooltip="Law and Society Skill">L&amp;S Skill</FieldLabelWithInfo>
                  <Input
                    type="number"
                    placeholder="0"
                    min={0}
                    value={form.magistrateSkill}
                    onChange={handleChange("magistrateSkill")}
                    className={numberInputClass}
                  />
                </div>
              </div>
            </section>

            <div className="h-px bg-[#3A424D]" />

            {/* Domain Road Network */}
            <section>
              <SectionTitle>Micro-Domain Road Network</SectionTitle>
              <div className="flex items-center gap-3">
                {([
                  { value: "none" as RoadNetwork, label: "No network" },
                  { value: "unpaved" as RoadNetwork, label: "Road Network (Unpaved)" },
                  { value: "paved" as RoadNetwork, label: "Road Network (Paved)" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, roadNetwork: opt.value }))}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border text-[11px] transition-colors ${
                      form.roadNetwork === opt.value
                        ? "bg-[#D4A574] text-[#141820] border-[#D4A574] font-semibold"
                        : "bg-transparent text-[#8A95A0] border-[#4A5568] hover:border-[#6B7580] hover:text-[#B8C0C8]"
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        form.roadNetwork === opt.value
                          ? "border-[#111]"
                          : "border-[#5A6577]"
                      }`}
                    >
                      {form.roadNetwork === opt.value && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#111]" />
                      )}
                    </div>
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Right: Options */}
          <div className="mt-4 md:mt-0 md:ml-auto w-full md:max-w-[320px] flex-shrink-0">
            <section>
              <SectionTitle>Options</SectionTitle>
              <div className="space-y-3">
                {/* Save Link button */}
                <div>
                  <button
                    type="button"
                    onClick={handleSaveLink}
                    disabled={saving}
                    className="flex items-center gap-1.5 h-7 px-3 text-[11px] font-medium text-[#D4A574] bg-[#2C333C] border border-[#4A5568] rounded-sm hover:bg-[#3A4250] hover:border-[#5A6577] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Link2 className="w-3 h-3" />
                    )}
                    {saving ? "Saving..." : domainKey ? "Save Micro-Domain" : "Save Link"}
                  </button>
                  {saveSuccess && (
                    <p className="mt-1.5 text-[10px] text-[#7A9A6E] flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Micro-Domain saved to cloud.
                    </p>
                  )}
                  <p className="mt-1.5 text-[9px] text-[#505A64] tracking-wide">
                    Use Save Micro-Domain to persist your data to the cloud.
                  </p>
                </div>

                {/* Domain link display — shown once a domain has been saved */}
                {domainLink && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={domainLink}
                      className="flex-1 min-w-0 bg-[#2C333C] border border-[#4A5568] text-[#8A95A0] text-[10px] h-7 px-2 rounded-sm truncate outline-none focus:border-[#5A6577]"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className={`flex items-center gap-1 h-7 px-2 text-[10px] font-medium rounded-sm border transition-colors ${
                        linkCopied
                          ? "text-[#7A9A6E] border-[#4A6A3E] bg-[#243020]"
                          : "text-[#A8B0B8] border-[#4A5568] bg-[#2C333C] hover:bg-[#3A4250] hover:text-[#F0EDE8]"
                      }`}
                    >
                      {linkCopied ? (
                        <>
                          <Check className="w-3 h-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                )}

                <div className="h-px bg-[#3A424D]" />

                {/* Reset Micro-Domain */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    className="flex items-center gap-1.5 h-7 px-3 text-[11px] font-medium text-[#A8B0B8] bg-[#2C333C] border border-[#4A5568] rounded-sm hover:bg-[#3A2020] hover:text-[#C45858] hover:border-[#5A2828] transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset Micro-Domain
                  </button>
                  <p className="mt-1.5 text-[9px] text-[#505A64] tracking-wide">
                    Clear all Micro-Domain fields.
                  </p>
                </div>

                <div className="h-px bg-[#3A424D]" />

                {/* Create New Micro-Domain */}
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      const baseUrl = `${window.location.origin}${window.location.pathname}`;
                      window.open(baseUrl, "_blank");
                    }}
                    className="flex items-center gap-1.5 h-7 px-3 text-[11px] font-medium text-[#A8B0B8] bg-[#2C333C] border border-[#4A5568] rounded-sm hover:bg-[#3A4250] hover:text-[#F0EDE8] hover:border-[#5A6577] transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Create New Micro-Domain
                  </button>
                  <p className="mt-1.5 text-[9px] text-[#505A64] tracking-wide">
                    Open a new blank Micro-Domain in a new tab.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="h-px bg-[#3A424D] my-4" />

        {/* Land Areas */}
        <section>
          <SectionTitle>Land Areas</SectionTitle>
          <LandAreasTable
            areas={landAreas}
            onUpdate={handleLandUpdate}
            onAdd={handleAddLandArea}
            onAddCustom={handleAddCustomLandArea}
            onRequestDelete={handleRequestDelete}
            onMoveRow={handleMoveRow}
            multiAreaInvalidRows={multiAreaInvalidRows}
            roadNetwork={form.roadNetwork}
          />
        </section>

        <div className="h-px bg-[#3A424D] my-4" />

        {/* Domain Income and Expenses */}
        <section>
          <SectionTitle>Micro-Domain Income and Expenses</SectionTitle>
          <div className="flex flex-col md:flex-row gap-6">
            <IncomeExpenseTable
              title="Income"
              rows={incomeRows}
              onUpdate={handleIncomeUpdate}
              onAdd={handleAddIncomeRow}
              onDelete={handleDeleteIncomeRow}
              fixedFirstRow={{
                description: "Income from Settlements",
                amount: landAreasTotalIncome,
              }}
            />
            <IncomeExpenseTable
              title="Expenses"
              rows={expenseRows}
              onUpdate={handleExpenseUpdate}
              onAdd={handleAddExpenseRow}
              onDelete={handleDeleteExpenseRow}
            />
          </div>
        </section>

        <div className="h-px bg-[#3A424D] my-4" />

        {/* Corruption and Profit/Loss */}
        <section>
          <SectionTitle>Micro-Domain Corruption and Profit/Loss</SectionTitle>
          <div className="flex flex-col md:flex-row gap-6">
            {/* Corruption Table */}
            <div className="flex-1 min-w-0">
              <h3 className="text-[11px] font-semibold text-[#A8B0B8] uppercase tracking-[0.08em] mb-1.5">
                Corruption
              </h3>
              <div className="border border-[#3A424D] rounded-sm overflow-x-auto">
                <table className="w-full border-collapse table-auto">
                  <thead>
                    <tr className="border-b border-[#4A5568]">
                      <th className="px-2 py-1.5 border-r border-[#3A424D] text-[10px] font-medium uppercase tracking-[0.08em] text-[#8A95A0] bg-[#242A32] whitespace-nowrap text-left min-w-[180px]">
                        Description
                      </th>
                      <th className={`px-2 py-1.5 ${corruptionRows.some((r) => !r.fixedDescription) ? "border-r border-[#3A424D]" : ""} text-[10px] font-medium uppercase tracking-[0.08em] text-[#8A95A0] bg-[#242A32] whitespace-nowrap text-left min-w-[80px]`}>
                        %
                      </th>
                      {corruptionRows.some((r) => !r.fixedDescription) && (
                        <th className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#8A95A0] bg-[#242A32] whitespace-nowrap text-left min-w-[40px] w-[40px]" />
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {corruptionRows.map((row) => {
                      const showDel = corruptionRows.some((r) => !r.fixedDescription);
                      // Compute display value for fixed rows
                      let fixedDisplayPercent = 0;
                      if (row.fixedDescription) {
                        if (row.description === "Corruption from Micro-Domain Population") {
                          fixedDisplayPercent = corruptionFromPopulation;
                        } else if (row.description === "Ruler Bonus") {
                          fixedDisplayPercent = rulerCorruptionBonus;
                        } else if (row.description === "Magistrate Bonus") {
                          fixedDisplayPercent = magistrateCorruptionBonus;
                        }
                      }
                      return (
                        <tr
                          key={row.id}
                          className={`border-b border-[#333B46] last:border-b-0 transition-colors ${
                            row.fixedDescription ? "bg-[#242A32]/40" : "hover:bg-[#303840]"
                          }`}
                        >
                          <td className="px-2 py-1.5 border-r border-[#3A424D]">
                            {row.fixedDescription ? (
                              <span className="text-[12px] text-[#A8B0B8]">{row.description}</span>
                            ) : (
                              <input
                                type="text"
                                value={row.description}
                                onChange={(e) => handleCorruptionUpdate(row.id, { description: e.target.value })}
                                placeholder="Enter description..."
                                className="w-full bg-transparent border-0 text-[12px] text-[#F0EDE8] placeholder:text-[#505A64] h-auto p-0 focus:ring-0 outline-none"
                              />
                            )}
                          </td>
                          <td className={`px-2 py-1.5 ${showDel ? "border-r border-[#3A424D]" : ""}`}>
                            {row.fixedDescription ? (
                              <span className="block text-[12px] text-[#A8B0B8] text-center">
                                {fixedDisplayPercent} %
                              </span>
                            ) : (
                              <div className="flex items-center justify-center gap-0.5">
                                <input
                                  type="number"
                                  value={row.percent}
                                  onChange={(e) => handleCorruptionUpdate(row.id, { percent: e.target.value })}
                                  placeholder="0"
                                  className="w-[calc(100%-16px)] bg-transparent border-0 text-[12px] text-[#F0EDE8] placeholder:text-[#505A64] h-auto p-0 focus:ring-0 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <span className="text-[12px] text-[#8A95A0] shrink-0">%</span>
                              </div>
                            )}
                          </td>
                          {showDel && (
                            <td className="px-2 py-1.5">
                              {row.fixedDescription ? (
                                <span />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCorruptionRow(row.id)}
                                  className="flex items-center justify-center w-full text-[#7A8490] hover:text-[#C45858] transition-colors"
                                  title="Delete row"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[#4A5568]">
                      <td className="px-2 py-1.5 border-r border-[#3A424D] text-[11px] font-semibold text-[#D4A574] bg-[#242A32] whitespace-nowrap">
                        <span className="text-[11px]">TOTAL</span>
                      </td>
                      <td className={`px-2 py-1.5 ${corruptionRows.some((r) => !r.fixedDescription) ? "border-r border-[#3A424D]" : ""} text-[11px] font-semibold text-[#D4A574] bg-[#242A32] whitespace-nowrap`}>
                        <span className="block text-center">{totalCorruptionPercent} %</span>
                      </td>
                      {corruptionRows.some((r) => !r.fixedDescription) && (
                        <td className="px-2 py-1.5 bg-[#242A32]" />
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={handleAddCorruptionRow}
                className="mt-2 h-7 px-3 text-[11px] text-[#8A95A0] hover:text-[#D4A574] hover:bg-[#303840] transition-colors"
              >
                <Plus className="w-3 h-3 mr-1.5" />
                Add New Row
              </Button>
            </div>

            {/* Profit / Loss Table — Warm Amber Summary Panel */}
            <div className="flex-1 min-w-0">
              <h3 className="text-[11px] font-semibold text-[#D4A574] uppercase tracking-[0.08em] mb-1.5">
                Profit / Loss
              </h3>
              <div className="border border-[#504030] rounded-sm overflow-x-auto bg-[#28241E]">
                <table className="w-full border-collapse table-auto">
                  <thead>
                    <tr className="border-b border-[#504030]">
                      <th className="px-2 py-1.5 border-r border-[#443A2E] text-[10px] font-medium uppercase tracking-[0.08em] text-[#B8976E] bg-[#2C2720] whitespace-nowrap text-left min-w-[180px]">
                        Description
                      </th>
                      <th className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#B8976E] bg-[#2C2720] whitespace-nowrap text-left min-w-[80px]">
                        GD
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Fixed read-only rows */}
                    <tr className="border-b border-[#362F26] bg-[#28241E]/40">
                      <td className="px-2 py-1.5 border-r border-[#443A2E]">
                        <span className="text-[12px] text-[#C4B09A]">Income</span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="block text-[12px] text-[#C4B09A] text-center">{Math.round(totalIncomeAmount)}</span>
                      </td>
                    </tr>
                    <tr className="border-b border-[#362F26] bg-[#28241E]/40">
                      <td className="px-2 py-1.5 border-r border-[#443A2E]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] text-[#C4B09A]">Corruption</span>
                          <span className="text-[10px] text-[#8A7560] whitespace-nowrap">
                            {Math.round(totalIncomeAmount)} × {(totalCorruptionPercent / 100).toFixed(2)} =
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="block text-[12px] text-[#C4B09A] text-center">{corruptionGD}</span>
                      </td>
                    </tr>
                    <tr className="border-b border-[#362F26] last:border-b-0 bg-[#28241E]/40">
                      <td className="px-2 py-1.5 border-r border-[#443A2E]">
                        <span className="text-[12px] text-[#C4B09A]">Expenses</span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="block text-[12px] text-[#C4B09A] text-center">{Math.round(totalExpenseAmount)}</span>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[#504030]">
                      <td className="px-2 py-1.5 border-r border-[#443A2E] text-[11px] font-semibold text-[#D4A574] bg-[#302A20] whitespace-nowrap">
                        <span className="text-[11px]">TOTAL</span>
                      </td>
                      <td className="px-2 py-1.5 text-[11px] font-semibold text-[#D4A574] bg-[#302A20] whitespace-nowrap">
                        <span className="block text-center">{Math.round(totalProfitLoss)} GD</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-[10px] text-[#6B7580] font-light tracking-wide">
            A modest tool for those who govern.
          </p>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmDeleteModal
          areaName={deleteTarget.areaName}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <ConfirmResetModal
          onConfirm={handleConfirmReset}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </div>
  );
}