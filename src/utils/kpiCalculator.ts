import { ActivityItem, GerenciaSummary, OverallKpiMetrics, ProcesoMacroSummary } from '../types/dashboard';

/**
 * Checks whether an activity is technically viable for automation.
 * Following APQC / Gartner rules: Tasks with 'NO' are discarded from the technological baseline.
 */
export function isTaskViable(item: ActivityItem): boolean {
  const val = (item.esAutomatizable || '').trim().toUpperCase();
  return val === 'SÍ' || val === 'SI' || val === 'YES' || val === 'TRUE';
}

/**
 * Normalizes percentage values (0-100).
 */
export function normalizePercent(val: any): number {
  if (typeof val === 'number') {
    return val <= 1 && val > 0 ? Math.round(val * 1000) / 10 : Math.round(val * 10) / 10;
  }
  if (!val) return 0;
  let cleaned = String(val).replace('%', '').trim();
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }
  const match = cleaned.match(/[-+]?[0-9]*\.?[0-9]+/);
  if (!match) return 0;
  const num = parseFloat(match[0]);
  if (isNaN(num)) return 0;
  return num <= 1 && num > 0 ? Math.round(num * 1000) / 10 : Math.round(num * 10) / 10;
}

/**
 * Normalizes numeric hours values handling commas, decimals, and text suffixes.
 */
export function normalizeNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val * 10) / 10;
  if (!val) return 0;
  let str = String(val).trim();
  if (str.includes(',') && !str.includes('.')) {
    str = str.replace(',', '.');
  } else {
    str = str.replace(/,/g, '');
  }
  const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
  if (!match) return 0;
  const num = parseFloat(match[0]);
  return isNaN(num) ? 0 : Math.round(num * 10) / 10;
}

/**
 * Calculates Proceso Macro summaries and KPIs based on Gartner/APQC rules.
 */
export function calculateProcesoMacroSummary(
  procesoMacroName: string,
  gerencia: string,
  items: ActivityItem[]
): ProcesoMacroSummary {
  let horasActividadTotal = 0;
  let horasAutomatizadasTotal = 0;
  let horasManualesTotal = 0;
  let horasViablesActividad = 0;
  let horasViablesAutomatizadas = 0;
  let horasDescartadasNoViables = 0;
  let tareasDigitalizadas = 0;
  let tareasNoDigitalizadas = 0;

  for (const item of items) {
    const actHrs = item.horasMensualesActividad || 0;
    const autoHrs = item.horasMensualesAutomatizadas || 0;
    const manHrs = item.horasManuales || Math.max(0, actHrs - autoHrs);

    horasActividadTotal += actHrs;
    horasAutomatizadasTotal += autoHrs;
    horasManualesTotal += manHrs;

    if (item.digitalizado === 'SÍ') {
      tareasDigitalizadas++;
    } else {
      tareasNoDigitalizadas++;
    }

    if (isTaskViable(item)) {
      horasViablesActividad += actHrs;
      horasViablesAutomatizadas += autoHrs;
    } else {
      horasDescartadasNoViables += actHrs;
    }
  }

  const kpiAutomatizacion =
    horasViablesActividad > 0
      ? Math.min(100, Math.round((horasViablesAutomatizadas / horasViablesActividad) * 1000) / 10)
      : 0;

  const kpiEstatus: 'automatizado' | 'en_desarrollo' =
    kpiAutomatizacion >= 80 ? 'automatizado' : 'en_desarrollo';

  return {
    procesoMacro: procesoMacroName,
    gerencia,
    totalTareas: items.length,
    horasActividadTotal,
    horasAutomatizadasTotal,
    horasManualesTotal,
    horasViablesActividad,
    horasViablesAutomatizadas,
    horasDescartadasNoViables,
    kpiAutomatizacion,
    kpiEstatus,
    tareasDigitalizadas,
    tareasNoDigitalizadas,
    actividades: items,
  };
}

/**
 * Calculates Gerencia summaries and nested Proceso Macro summaries.
 */
export function calculateGerenciaSummary(
  gerenciaName: string,
  items: ActivityItem[]
): GerenciaSummary {
  // Group activities by Proceso Macro
  const macroMap = new Map<string, ActivityItem[]>();
  const puestos = new Set<string>();
  const responsables = new Set<string>();

  let totalHorasActividad = 0;
  let totalHorasAutomatizadas = 0;
  let totalHorasManuales = 0;
  let horasViablesActividad = 0;
  let horasViablesAutomatizadas = 0;
  let horasDescartadasNoViables = 0;
  let tareasDigitalizadas = 0;
  let tareasNoDigitalizadas = 0;
  let totalSatisfaccionPonderada = 0;
  let totalItemsConSatisfaccion = 0;

  for (const item of items) {
    const macro = (item.procesoMacro || 'Sin Proceso Macro Asignado').trim();
    if (!macroMap.has(macro)) {
      macroMap.set(macro, []);
    }
    macroMap.get(macro)!.push(item);

    if (item.puesto) puestos.add(item.puesto.trim());
    if (item.responsableFuncional) responsables.add(item.responsableFuncional.trim());

    const actHrs = item.horasMensualesActividad || 0;
    const autoHrs = item.horasMensualesAutomatizadas || 0;
    const manHrs = item.horasManuales || Math.max(0, actHrs - autoHrs);

    totalHorasActividad += actHrs;
    totalHorasAutomatizadas += autoHrs;
    totalHorasManuales += manHrs;

    if (item.digitalizado === 'SÍ') {
      tareasDigitalizadas++;
    } else {
      tareasNoDigitalizadas++;
    }

    if (isTaskViable(item)) {
      horasViablesActividad += actHrs;
      horasViablesAutomatizadas += autoHrs;
    } else {
      horasDescartadasNoViables += actHrs;
    }

    if (item.satisfaccionOperativa !== undefined) {
      totalSatisfaccionPonderada += item.satisfaccionOperativa;
      totalItemsConSatisfaccion++;
    }
  }

  const procesosMacro: ProcesoMacroSummary[] = Array.from(macroMap.entries()).map(
    ([macroName, macroItems]) =>
      calculateProcesoMacroSummary(macroName, gerenciaName, macroItems)
  );

  // Sort macro processes by workload descending
  procesosMacro.sort((a, b) => b.horasActividadTotal - a.horasActividadTotal);

  const kpiAutomatizacion =
    horasViablesActividad > 0
      ? Math.min(100, Math.round((horasViablesAutomatizadas / horasViablesActividad) * 1000) / 10)
      : 0;

  const kpiEstatus: 'automatizado' | 'en_desarrollo' =
    kpiAutomatizacion >= 80 ? 'automatizado' : 'en_desarrollo';

  // KPI Satisfacción Operativa (default around 97% if not provided)
  const kpiSatisfaccion =
    totalItemsConSatisfaccion > 0
      ? Math.round((totalSatisfaccionPonderada / totalItemsConSatisfaccion) * 10) / 10
      : 97.4;

  const satisfaccionEstatus: 'satisfactorio' | 'critico' =
    kpiSatisfaccion >= 96 ? 'satisfactorio' : 'critico';

  return {
    gerencia: gerenciaName,
    totalTareas: items.length,
    totalHorasActividad,
    totalHorasAutomatizadas,
    totalHorasManuales,
    horasViablesActividad,
    horasViablesAutomatizadas,
    horasDescartadasNoViables,
    kpiAutomatizacion,
    kpiEstatus,
    kpiSatisfaccion,
    satisfaccionEstatus,
    tareasDigitalizadas,
    tareasNoDigitalizadas,
    procesosMacro,
    puestosCount: puestos.size,
    responsablesCount: responsables.size,
    actividades: items,
  };
}

/**
 * Calculates executive overall metrics for the entire organization across all Gerencias.
 */
export function calculateOverallMetrics(gerencias: GerenciaSummary[]): OverallKpiMetrics {
  let totalTareas = 0;
  let totalHorasActividad = 0;
  let totalHorasAutomatizadas = 0;
  let totalHorasManuales = 0;
  let horasViablesActividad = 0;
  let horasViablesAutomatizadas = 0;
  let horasDescartadasNoViables = 0;
  let totalDigitalizadas = 0;
  let totalNoDigitalizadas = 0;
  let totalSatisfaccionSum = 0;

  for (const g of gerencias) {
    totalTareas += g.totalTareas;
    totalHorasActividad += g.totalHorasActividad;
    totalHorasAutomatizadas += g.totalHorasAutomatizadas;
    totalHorasManuales += g.totalHorasManuales;
    horasViablesActividad += g.horasViablesActividad;
    horasViablesAutomatizadas += g.horasViablesAutomatizadas;
    horasDescartadasNoViables += g.horasDescartadasNoViables;
    totalDigitalizadas += g.tareasDigitalizadas;
    totalNoDigitalizadas += g.tareasNoDigitalizadas;
    totalSatisfaccionSum += g.kpiSatisfaccion;
  }

  const kpiAutomatizacionGlobal =
    horasViablesActividad > 0
      ? Math.min(100, Math.round((horasViablesAutomatizadas / horasViablesActividad) * 1000) / 10)
      : 0;

  const kpiEstatusGlobal: 'automatizado' | 'en_desarrollo' =
    kpiAutomatizacionGlobal >= 80 ? 'automatizado' : 'en_desarrollo';

  const kpiSatisfaccionGlobal =
    gerencias.length > 0
      ? Math.round((totalSatisfaccionSum / gerencias.length) * 10) / 10
      : 97.2;

  const satisfaccionEstatusGlobal: 'satisfactorio' | 'critico' =
    kpiSatisfaccionGlobal >= 96 ? 'satisfactorio' : 'critico';

  const porcentajeDigitalizacionTotal =
    totalTareas > 0
      ? Math.round((totalDigitalizadas / totalTareas) * 1000) / 10
      : 0;

  return {
    totalGerencias: gerencias.length,
    totalTareas,
    totalHorasActividad,
    totalHorasAutomatizadas,
    totalHorasManuales,
    horasViablesActividad,
    horasViablesAutomatizadas,
    horasDescartadasNoViables,
    kpiAutomatizacionGlobal,
    kpiEstatusGlobal,
    kpiSatisfaccionGlobal,
    satisfaccionEstatusGlobal,
    totalDigitalizadas,
    totalNoDigitalizadas,
    porcentajeDigitalizacionTotal,
  };
}
