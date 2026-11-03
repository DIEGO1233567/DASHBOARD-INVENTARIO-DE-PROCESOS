import { ProcessRecord } from '../types/sheets';
import { normalizeNumber } from './sheetsParser';

export type StatusCategory =
  | 'ALL'
  | 'DISCORDANTE'
  | 'DIG_NO_AUTO_SI'
  | 'DIG_SI_AUTO_NO'
  | 'DIG_NO_AUTO_NO'
  | 'DIG_SI_AUTO_SI';

export interface UniqueActivityStatusVariant {
  statusKey: string;
  digitalizado: 'SÍ' | 'NO';
  esAutomatizable: 'SÍ' | 'NO';
  statusLabel: string;
  count: number;
  horasTotales: number;
  horasManuales: number;
  horasAutomatizadas: number;
  colaboradores: string[];
  records: ProcessRecord[];
}

export interface UniqueActivityItem {
  id: string; // `${gerencia}:::${normalizedActivity}`
  gerencia: string;
  actividadProceso: string;
  totalRecords: number;
  totalColaboradores: number;
  colaboradores: string[];
  procesosMacro: string[];
  areasSubArea: string[];
  herramientas: string[];
  horasTotales: number;
  horasManuales: number;
  horasAutomatizadas: number;
  pctAutomatizado: number;
  hasDiscrepancy: boolean;
  discrepancyDescription?: string;
  category: StatusCategory;
  primaryStatusLabel: string;
  variants: UniqueActivityStatusVariant[];
  allRecords: ProcessRecord[];
}

export interface ActivityStatusMetrics {
  totalUniqueActivities: number;
  totalDiscordantes: number;
  totalDigNoAutoSi: number;
  totalDigSiAutoNo: number;
  totalDigNoAutoNo: number;
  totalDigSiAutoSi: number;
  horasTotales: number;
  horasDiscordantes: number;
  colaboradoresInvolucradosDiscordantes: number;
  gerenciasConDiscordanciasCount: number;
}

/**
 * Normalizes boolean status representation from CSV / Excel.
 */
export function normalizeBoolStatus(val: string | undefined | null): 'SÍ' | 'NO' {
  if (!val) return 'NO';
  const clean = val.toString().trim().toUpperCase();
  if (
    clean === 'SÍ' ||
    clean === 'SI' ||
    clean === 'YES' ||
    clean === 'Y' ||
    clean === 'TRUE' ||
    clean === '1'
  ) {
    return 'SÍ';
  }
  return 'NO';
}

/**
 * Normalizes activity name for robust matching while preserving exact casing for display.
 */
export function normalizeActivityKey(name: string | undefined | null): string {
  if (!name) return 'sin_nombre';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Generates human readable badge label for a status combination.
 */
export function getStatusComboLabel(dig: 'SÍ' | 'NO', auto: 'SÍ' | 'NO'): string {
  return `Digitalizado: ${dig === 'SÍ' ? 'Sí' : 'No'} · Automatizable: ${auto === 'SÍ' ? 'Sí' : 'No'}`;
}

/**
 * Computes the unique activities list adhering strictly to the rule:
 * Uniqueness is defined per Gerencia (Gerencia + Actividad).
 * If the same activity exists in another gerencia, they count as 2 separate unique activities.
 */
export function computeUniqueActivitiesStatusList(
  records: ProcessRecord[],
  selectedGerencia: string = 'ALL'
): {
  items: UniqueActivityItem[];
  metrics: ActivityStatusMetrics;
  discordantItems: UniqueActivityItem[];
} {
  const scoped = selectedGerencia === 'ALL'
    ? records
    : records.filter((r) => r.gerencia === selectedGerencia);

  // Group by (Gerencia + Normalized Activity Name)
  const map = new Map<string, {
    gerencia: string;
    rawName: string;
    records: ProcessRecord[];
  }>();

  for (const r of scoped) {
    const normName = normalizeActivityKey(r.actividadProceso);
    const key = `${r.gerencia}:::${normName}`;
    if (!map.has(key)) {
      map.set(key, {
        gerencia: r.gerencia,
        rawName: (r.actividadProceso || 'Sin nombre').trim(),
        records: [],
      });
    }
    map.get(key)!.records.push(r);
  }

  const items: UniqueActivityItem[] = [];
  let totalDiscordantes = 0;
  let totalDigNoAutoSi = 0;
  let totalDigSiAutoNo = 0;
  let totalDigNoAutoNo = 0;
  let totalDigSiAutoSi = 0;
  let totalHoras = 0;
  let horasDiscordantes = 0;
  const discordantColabsSet = new Set<string>();
  const discordantGerenciasSet = new Set<string>();

  for (const [key, group] of map.entries()) {
    const rawRecords = group.records;

    // Collect collaborators & metadata
    const colabsSet = new Set<string>();
    const macrosSet = new Set<string>();
    const areasSet = new Set<string>();
    const toolsSet = new Set<string>();

    let sumTotales = 0;
    let sumManuales = 0;
    let sumAuto = 0;

    // Sub-group by status variant (digitalizado + esAutomatizable)
    const variantMap = new Map<string, {
      dig: 'SÍ' | 'NO';
      auto: 'SÍ' | 'NO';
      records: ProcessRecord[];
      colabs: Set<string>;
      hTot: number;
      hMan: number;
      hAut: number;
    }>();

    for (const r of rawRecords) {
      const hTot = normalizeNumber(r.horasMensualesTotal != null ? r.horasMensualesTotal : r.horasMensualesActividad);
      const hMan = normalizeNumber(r.horasManualesTotal != null ? r.horasManualesTotal : r.horasManuales);
      const hAut = normalizeNumber(r.horasMensualesAutomatizadas);

      sumTotales += hTot;
      sumManuales += hMan;
      sumAuto += hAut;

      const colabName = (r.responsableFuncional || '').trim();
      if (colabName) colabsSet.add(colabName);
      if (r.procesoMacro) macrosSet.add(r.procesoMacro.trim());
      if (r.areaSubArea) areasSet.add(r.areaSubArea.trim());
      if (r.herramienta && r.herramienta !== 'N/A') toolsSet.add(r.herramienta.trim());

      const digNorm = normalizeBoolStatus(r.digitalizado);
      const autoNorm = normalizeBoolStatus(r.esAutomatizable);
      const variantKey = `${digNorm}__${autoNorm}`;

      if (!variantMap.has(variantKey)) {
        variantMap.set(variantKey, {
          dig: digNorm,
          auto: autoNorm,
          records: [],
          colabs: new Set(),
          hTot: 0,
          hMan: 0,
          hAut: 0,
        });
      }

      const v = variantMap.get(variantKey)!;
      v.records.push(r);
      if (colabName) v.colabs.add(colabName);
      v.hTot += hTot;
      v.hMan += hMan;
      v.hAut += hAut;
    }

    const variants: UniqueActivityStatusVariant[] = Array.from(variantMap.entries()).map(
      ([variantKey, v]) => ({
        statusKey: variantKey,
        digitalizado: v.dig,
        esAutomatizable: v.auto,
        statusLabel: getStatusComboLabel(v.dig, v.auto),
        count: v.records.length,
        horasTotales: Number(v.hTot.toFixed(1)),
        horasManuales: Number(v.hMan.toFixed(1)),
        horasAutomatizadas: Number(v.hAut.toFixed(1)),
        colaboradores: Array.from(v.colabs),
        records: v.records,
      })
    );

    // Sort variants by count descending
    variants.sort((a, b) => b.count - a.count);

    const hasDiscrepancy = variants.length > 1;
    let category: StatusCategory = 'ALL';
    let discrepancyDescription: string | undefined = undefined;

    if (hasDiscrepancy) {
      category = 'DISCORDANTE';
      totalDiscordantes += 1;
      horasDiscordantes += sumTotales;
      discordantGerenciasSet.add(group.gerencia);
      colabsSet.forEach((c) => discordantColabsSet.add(`${group.gerencia}:::${c}`));

      // Describe what differs
      const digValues = new Set(variants.map((v) => v.digitalizado));
      const autoValues = new Set(variants.map((v) => v.esAutomatizable));
      if (digValues.size > 1 && autoValues.size > 1) {
        discrepancyDescription = 'Variación en Digitalizado y en Automatizable';
      } else if (digValues.size > 1) {
        discrepancyDescription = 'Variación en criterio de Digitalizado';
      } else {
        discrepancyDescription = 'Variación en criterio de Automatizable';
      }
    } else {
      const single = variants[0];
      if (single.digitalizado === 'NO' && single.esAutomatizable === 'SÍ') {
        category = 'DIG_NO_AUTO_SI';
        totalDigNoAutoSi += 1;
      } else if (single.digitalizado === 'SÍ' && single.esAutomatizable === 'NO') {
        category = 'DIG_SI_AUTO_NO';
        totalDigSiAutoNo += 1;
      } else if (single.digitalizado === 'NO' && single.esAutomatizable === 'NO') {
        category = 'DIG_NO_AUTO_NO';
        totalDigNoAutoNo += 1;
      } else if (single.digitalizado === 'SÍ' && single.esAutomatizable === 'SÍ') {
        category = 'DIG_SI_AUTO_SI';
        totalDigSiAutoSi += 1;
      }
    }

    totalHoras += sumTotales;

    const primaryStatusLabel = hasDiscrepancy
      ? `Estatus Discordante (${variants.length} variantes encontradas)`
      : variants[0]?.statusLabel || 'Sin estatus';

    const pctAutomatizado = sumTotales > 0 ? (sumAuto / sumTotales) * 100 : 0;

    items.push({
      id: key,
      gerencia: group.gerencia,
      actividadProceso: group.rawName,
      totalRecords: rawRecords.length,
      totalColaboradores: colabsSet.size,
      colaboradores: Array.from(colabsSet),
      procesosMacro: Array.from(macrosSet),
      areasSubArea: Array.from(areasSet),
      herramientas: Array.from(toolsSet),
      horasTotales: Number(sumTotales.toFixed(1)),
      horasManuales: Number(sumManuales.toFixed(1)),
      horasAutomatizadas: Number(sumAuto.toFixed(1)),
      pctAutomatizado: Number(pctAutomatizado.toFixed(1)),
      hasDiscrepancy,
      discrepancyDescription,
      category,
      primaryStatusLabel,
      variants,
      allRecords: rawRecords,
    });
  }

  // Sort items: discordant first, then by total records descending, then by hours descending
  items.sort((a, b) => {
    if (a.hasDiscrepancy && !b.hasDiscrepancy) return -1;
    if (!a.hasDiscrepancy && b.hasDiscrepancy) return 1;
    if (b.variants.length !== a.variants.length) return b.variants.length - a.variants.length;
    if (b.totalRecords !== a.totalRecords) return b.totalRecords - a.totalRecords;
    return b.horasTotales - a.horasTotales;
  });

  const discordantItems = items.filter((i) => i.hasDiscrepancy);

  return {
    items,
    discordantItems,
    metrics: {
      totalUniqueActivities: items.length,
      totalDiscordantes,
      totalDigNoAutoSi,
      totalDigSiAutoNo,
      totalDigNoAutoNo,
      totalDigSiAutoSi,
      horasTotales: Number(totalHoras.toFixed(1)),
      horasDiscordantes: Number(horasDiscordantes.toFixed(1)),
      colaboradoresInvolucradosDiscordantes: discordantColabsSet.size,
      gerenciasConDiscordanciasCount: discordantGerenciasSet.size,
    },
  };
}

/**
 * Cross-Gerencia analysis: Identifies activities that share the same name across
 * multiple gerencias and compares their statuses between gerencias,
 * while still maintaining the rule that each gerencia counts as 1 separate unique activity.
 */
export interface CrossGerenciaActivityGroup {
  actividadNombre: string;
  totalGerencias: number;
  gerenciasList: {
    gerencia: string;
    totalRecords: number;
    hasInternalDiscrepancy: boolean;
    variants: UniqueActivityStatusVariant[];
    primaryStatus: string;
  }[];
  hasCrossDiscrepancy: boolean;
}

export function computeCrossGerenciaAnalysis(
  records: ProcessRecord[]
): CrossGerenciaActivityGroup[] {
  const map = new Map<string, ProcessRecord[]>();
  for (const r of records) {
    const norm = normalizeActivityKey(r.actividadProceso);
    if (!map.has(norm)) {
      map.set(norm, []);
    }
    map.get(norm)!.push(r);
  }

  const results: CrossGerenciaActivityGroup[] = [];

  for (const [, rows] of map.entries()) {
    const gerenciaMap = new Map<string, ProcessRecord[]>();
    for (const r of rows) {
      if (!gerenciaMap.has(r.gerencia)) {
        gerenciaMap.set(r.gerencia, []);
      }
      gerenciaMap.get(r.gerencia)!.push(r);
    }

    if (gerenciaMap.size > 1) {
      const gerenciasList: CrossGerenciaActivityGroup['gerenciasList'] = [];
      const distinctGlobalStatusCombos = new Set<string>();

      for (const [gerenciaName, gRows] of gerenciaMap.entries()) {
        const variantMap = new Map<string, ProcessRecord[]>();
        for (const gr of gRows) {
          const combo = `${normalizeBoolStatus(gr.digitalizado)}__${normalizeBoolStatus(gr.esAutomatizable)}`;
          if (!variantMap.has(combo)) variantMap.set(combo, []);
          variantMap.get(combo)!.push(gr);
          distinctGlobalStatusCombos.add(combo);
        }

        const variants: UniqueActivityStatusVariant[] = Array.from(variantMap.entries()).map(
          ([combo, recs]) => {
            const [dig, auto] = combo.split('__') as ['SÍ' | 'NO', 'SÍ' | 'NO'];
            return {
              statusKey: combo,
              digitalizado: dig,
              esAutomatizable: auto,
              statusLabel: getStatusComboLabel(dig, auto),
              count: recs.length,
              horasTotales: recs.reduce((a, b) => a + normalizeNumber(b.horasMensualesTotal), 0),
              horasManuales: recs.reduce((a, b) => a + normalizeNumber(b.horasManualesTotal), 0),
              horasAutomatizadas: recs.reduce((a, b) => a + normalizeNumber(b.horasMensualesAutomatizadas), 0),
              colaboradores: Array.from(new Set(recs.map((r) => r.responsableFuncional).filter(Boolean))),
              records: recs,
            };
          }
        );

        gerenciasList.push({
          gerencia: gerenciaName,
          totalRecords: gRows.length,
          hasInternalDiscrepancy: variants.length > 1,
          variants,
          primaryStatus: variants[0]?.statusLabel || 'Sin datos',
        });
      }

      results.push({
        actividadNombre: rows[0].actividadProceso,
        totalGerencias: gerenciasList.length,
        gerenciasList,
        hasCrossDiscrepancy: distinctGlobalStatusCombos.size > 1,
      });
    }
  }

  // Sort by cross discrepancy, then total gerencias descending
  results.sort((a, b) => {
    if (a.hasCrossDiscrepancy && !b.hasCrossDiscrepancy) return -1;
    if (!a.hasCrossDiscrepancy && b.hasCrossDiscrepancy) return 1;
    return b.totalGerencias - a.totalGerencias;
  });

  return results;
}

/**
 * Representation of an activity uniquely qualified by (Gerencia + Actividad + Estatus).
 * This satisfies the exact user requirement:
 * "determinar cuántas actividades tenemos, de ahí cuantas son:
 * - sí digitalizado-sí automatizable
 * - no digitalizado-sí automatizable
 * - no digitalizado-no automatizable
 * (y sí digitalizado-no automatizable)
 * Pero que sean con actividades únicas por gerencia y estatus".
 */
export type StatusComboKey = 'SI_SI' | 'NO_SI' | 'NO_NO' | 'SI_NO';

export interface ActivityByGerenciaAndStatusItem {
  id: string; // `${gerencia}:::${normalizedActivity}:::${comboKey}`
  activityKey: string; // `${gerencia}:::${normalizedActivity}`
  gerencia: string;
  actividadProceso: string;
  statusComboKey: StatusComboKey;
  digitalizado: 'SÍ' | 'NO';
  esAutomatizable: 'SÍ' | 'NO';
  statusLabel: string;
  recordsCount: number;
  horasTotales: number;
  horasManuales: number;
  horasAutomatizadas: number;
  colaboradores: string[];
  records: ProcessRecord[];
  // Context from the parent unique activity in that gerencia:
  parentTotalRecords: number;
  hasOtherStatuses: boolean;
  otherStatusesCount: number;
  otherStatusesLabels: string[];
  procesosMacro: string[];
  areasSubArea: string[];
}

export interface ActivitiesByGerenciaAndStatusResult {
  totalActividadesBase: number; // e.g. 267
  totalActividadesPorEstatus: number; // e.g. 298
  countByCombo: {
    SI_SI: number; // Sí Digitalizado - Sí Automatizable (e.g. 130)
    NO_SI: number; // No Digitalizado - Sí Automatizable (e.g. 93)
    NO_NO: number; // No Digitalizado - No Automatizable (e.g. 62)
    SI_NO: number; // Sí Digitalizado - No Automatizable (e.g. 13)
  };
  hoursByCombo: {
    SI_SI: number;
    NO_SI: number;
    NO_NO: number;
    SI_NO: number;
    TOTAL: number;
  };
  manualHoursByCombo: {
    SI_SI: number;
    NO_SI: number;
    NO_NO: number;
    SI_NO: number;
  };
  autoHoursByCombo: {
    SI_SI: number;
    NO_SI: number;
    NO_NO: number;
    SI_NO: number;
  };
  items: ActivityByGerenciaAndStatusItem[];
}

export function computeActivitiesByGerenciaAndStatus(
  records: ProcessRecord[],
  selectedGerencia: string = 'ALL'
): ActivitiesByGerenciaAndStatusResult {
  const scoped = selectedGerencia === 'ALL'
    ? records
    : records.filter((r) => r.gerencia === selectedGerencia);

  // Group records by (gerencia + normalizedActivity)
  const map = new Map<string, {
    gerencia: string;
    rawName: string;
    records: ProcessRecord[];
  }>();

  for (const r of scoped) {
    const norm = normalizeActivityKey(r.actividadProceso);
    const key = `${r.gerencia}:::${norm}`;
    if (!map.has(key)) {
      map.set(key, {
        gerencia: r.gerencia,
        rawName: (r.actividadProceso || 'Sin nombre').trim(),
        records: [],
      });
    }
    map.get(key)!.records.push(r);
  }

  const items: ActivityByGerenciaAndStatusItem[] = [];
  const countByCombo = {
    SI_SI: 0,
    NO_SI: 0,
    NO_NO: 0,
    SI_NO: 0,
  };

  const hoursByCombo = {
    SI_SI: 0,
    NO_SI: 0,
    NO_NO: 0,
    SI_NO: 0,
    TOTAL: 0,
  };

  const manualHoursByCombo = {
    SI_SI: 0,
    NO_SI: 0,
    NO_NO: 0,
    SI_NO: 0,
  };

  const autoHoursByCombo = {
    SI_SI: 0,
    NO_SI: 0,
    NO_NO: 0,
    SI_NO: 0,
  };

  for (const [actKey, group] of map.entries()) {
    // Collect all variants within this parent activity
    const variantMap = new Map<StatusComboKey, ProcessRecord[]>();
    const macrosSet = new Set<string>();
    const areasSet = new Set<string>();

    for (const r of group.records) {
      if (r.procesoMacro) macrosSet.add(r.procesoMacro.trim());
      if (r.areaSubArea) areasSet.add(r.areaSubArea.trim());

      const d = normalizeBoolStatus(r.digitalizado);
      const a = normalizeBoolStatus(r.esAutomatizable);
      const comboKey = `${d === 'SÍ' ? 'SI' : 'NO'}_${a === 'SÍ' ? 'SI' : 'NO'}` as StatusComboKey;

      if (!variantMap.has(comboKey)) {
        variantMap.set(comboKey, []);
      }
      variantMap.get(comboKey)!.push(r);
    }

    const allVariantsKeys = Array.from(variantMap.keys());
    const hasMultiple = allVariantsKeys.length > 1;

    for (const [comboKey, rows] of variantMap.entries()) {
      countByCombo[comboKey]++;

      let hTot = 0;
      let hMan = 0;
      let hAut = 0;
      const colabs = new Set<string>();

      for (const r of rows) {
        const t = normalizeNumber(r.horasMensualesTotal != null ? r.horasMensualesTotal : r.horasMensualesActividad);
        const m = normalizeNumber(r.horasManualesTotal != null ? r.horasManualesTotal : r.horasManuales);
        const auto = normalizeNumber(r.horasMensualesAutomatizadas);

        hTot += t;
        hMan += m;
        hAut += auto;

        if (r.responsableFuncional) {
          colabs.add(r.responsableFuncional.trim());
        }
      }

      hoursByCombo[comboKey] += hTot;
      hoursByCombo.TOTAL += hTot;
      manualHoursByCombo[comboKey] += hMan;
      autoHoursByCombo[comboKey] += hAut;

      const [dStr, aStr] = comboKey.split('_');
      const d = dStr === 'SI' ? 'SÍ' : 'NO';
      const a = aStr === 'SI' ? 'SÍ' : 'NO';

      const otherKeys = allVariantsKeys.filter((k) => k !== comboKey);
      const otherLabels = otherKeys.map((k) => {
        const [od, oa] = k.split('_');
        return `${od === 'SI' ? 'Sí' : 'No'} Digitalizado · ${oa === 'SI' ? 'Sí' : 'No'} Automatizable`;
      });

      items.push({
        id: `${actKey}:::${comboKey}`,
        activityKey: actKey,
        gerencia: group.gerencia,
        actividadProceso: group.rawName,
        statusComboKey: comboKey,
        digitalizado: d,
        esAutomatizable: a,
        statusLabel: `${d === 'SÍ' ? 'Sí' : 'No'} Digitalizado · ${a === 'SÍ' ? 'Sí' : 'No'} Automatizable`,
        recordsCount: rows.length,
        horasTotales: Number(hTot.toFixed(1)),
        horasManuales: Number(hMan.toFixed(1)),
        horasAutomatizadas: Number(hAut.toFixed(1)),
        colaboradores: Array.from(colabs),
        records: rows,
        parentTotalRecords: group.records.length,
        hasOtherStatuses: hasMultiple,
        otherStatusesCount: otherKeys.length,
        otherStatusesLabels: otherLabels,
        procesosMacro: Array.from(macrosSet),
        areasSubArea: Array.from(areasSet),
      });
    }
  }

  // Round all totals
  hoursByCombo.SI_SI = Number(hoursByCombo.SI_SI.toFixed(1));
  hoursByCombo.NO_SI = Number(hoursByCombo.NO_SI.toFixed(1));
  hoursByCombo.NO_NO = Number(hoursByCombo.NO_NO.toFixed(1));
  hoursByCombo.SI_NO = Number(hoursByCombo.SI_NO.toFixed(1));
  hoursByCombo.TOTAL = Number(hoursByCombo.TOTAL.toFixed(1));

  manualHoursByCombo.SI_SI = Number(manualHoursByCombo.SI_SI.toFixed(1));
  manualHoursByCombo.NO_SI = Number(manualHoursByCombo.NO_SI.toFixed(1));
  manualHoursByCombo.NO_NO = Number(manualHoursByCombo.NO_NO.toFixed(1));
  manualHoursByCombo.SI_NO = Number(manualHoursByCombo.SI_NO.toFixed(1));

  autoHoursByCombo.SI_SI = Number(autoHoursByCombo.SI_SI.toFixed(1));
  autoHoursByCombo.NO_SI = Number(autoHoursByCombo.NO_SI.toFixed(1));
  autoHoursByCombo.NO_NO = Number(autoHoursByCombo.NO_NO.toFixed(1));
  autoHoursByCombo.SI_NO = Number(autoHoursByCombo.SI_NO.toFixed(1));

  // Sort items: items with multiple statuses first (since they are interesting for audit), then by hours
  items.sort((a, b) => {
    if (a.hasOtherStatuses && !b.hasOtherStatuses) return -1;
    if (!a.hasOtherStatuses && b.hasOtherStatuses) return 1;
    return b.horasTotales - a.horasTotales;
  });

  return {
    totalActividadesBase: map.size,
    totalActividadesPorEstatus: items.length,
    countByCombo,
    hoursByCombo,
    manualHoursByCombo,
    autoHoursByCombo,
    items,
  };
}

