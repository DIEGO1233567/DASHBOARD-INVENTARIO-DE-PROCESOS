import * as XLSX from 'xlsx';
import { ColaboradorSummaryItem, GerenciaSummaryItem, MacroProcessStat, ProcessRecord } from '../types/sheets';

import { normalizeNumber } from './kpiCalculator';
export { normalizeNumber };

/**
 * Utility functions for numeric display across the dashboard.
 * Enforces standard Mexican / Spanish format with commas as thousands separators (e.g., 1,234.50 or 1,234).
 */
export function formatThousands(
  value: number | string | null | undefined,
  decimals?: number
): string {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  if (isNaN(num)) return '0';

  if (decimals !== undefined) {
    return num.toLocaleString('es-MX', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  return num.toLocaleString('es-MX', {
    maximumFractionDigits: 2,
  });
}

/**
 * Format hours specifically:
 * If it has a decimal part (e.g. 13.5, 73.25), show it clearly with decimal places.
 * If integer (e.g. 60, 200), show integer with thousand separator.
 */
export function formatHours(
  value: number | string | null | undefined
): string {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  if (isNaN(num)) return '0';

  const hasDecimal = num % 1 !== 0;
  return num.toLocaleString('es-MX', {
    minimumFractionDigits: hasDecimal ? 1 : 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Normalizes boolean or 'Sí'/'No' text.
 */
export function normalizeYesNo(val: any): 'Sí' | 'No' {
  if (!val) return 'No';
  const str = String(val).trim().toUpperCase();
  if (str === 'SÍ' || str === 'SI' || str === 'YES' || str === 'TRUE' || str === '1') {
    return 'Sí';
  }
  return 'No';
}

/**
 * Computes consolidated KPIs grouped by Gerencia.
 * Highlight metrics:
 * - Conteo de procesos macro por gerencia
 * - Conteo de ACTIVIDAD / PROCESO por gerencia
 * - Horas manuales vs automatizadas
 * - Potencial de automatización y FTE liberables
 */
export function computeGerenciaSummaries(records: ProcessRecord[]): GerenciaSummaryItem[] {
  const map = new Map<string, ProcessRecord[]>();

  for (const r of records) {
    const g = (r.gerencia || 'Gerencia General').trim();
    if (!map.has(g)) {
      map.set(g, []);
    }
    map.get(g)!.push(r);
  }

  const summaries: GerenciaSummaryItem[] = [];

  for (const [gerencia, items] of map.entries()) {
    const macroMap = new Map<string, ProcessRecord[]>();
    const colaboradoresSet = new Set<string>();

    let horasTotales = 0;
    let horasManuales = 0;
    let horasAutomatizadas = 0;
    let horasPotencialAutomatizable = 0;
    let tareasManuales = 0;
    let tareasAutomatizadas = 0;

    for (const item of items) {
      const macroName = (item.procesoMacro || 'Sin Proceso Macro').trim();
      if (!macroMap.has(macroName)) {
        macroMap.set(macroName, []);
      }
      macroMap.get(macroName)!.push(item);

      const resp = (item.responsableFuncional || 'Sin Asignar').trim();
      colaboradoresSet.add(resp);

      const hTotal = normalizeNumber(item.horasMensualesTotal != null ? item.horasMensualesTotal : item.horasMensualesActividad);
      const hManual = normalizeNumber(item.horasManualesTotal != null ? item.horasManualesTotal : item.horasManuales);
      const hAuto = normalizeNumber(item.horasMensualesAutomatizadas);

      horasTotales += hTotal;
      horasManuales += hManual;
      horasAutomatizadas += hAuto;

      const isAutomatizable = normalizeYesNo(item.esAutomatizable) === 'Sí';
      if (isAutomatizable) {
        horasPotencialAutomatizable += hManual;
      }

      if (hManual > 0) tareasManuales++;
      if (hAuto > 0 || (item.porcentajeAutomatizado || 0) > 0) tareasAutomatizadas++;
    }

    const pctAutomatizado =
      horasTotales > 0 ? Number(((horasAutomatizadas / horasTotales) * 100).toFixed(1)) : 0;
    const pctPotencialMeta =
      horasTotales > 0
        ? Number((((horasAutomatizadas + horasPotencialAutomatizable) / horasTotales) * 100).toFixed(1))
        : 0;

    const macroProcessesList: MacroProcessStat[] = Array.from(macroMap.entries()).map(
      ([nombre, mItems]) => {
        const mTotal = mItems.reduce(
          (sum, it) => sum + normalizeNumber(it.horasMensualesTotal != null ? it.horasMensualesTotal : it.horasMensualesActividad),
          0
        );
        const mManual = mItems.reduce(
          (sum, it) => sum + normalizeNumber(it.horasManualesTotal != null ? it.horasManualesTotal : it.horasManuales),
          0
        );
        const mAuto = mItems.reduce((sum, it) => sum + normalizeNumber(it.horasMensualesAutomatizadas), 0);
        const uniqueMacroActividades = new Set(
          mItems.map((it) => (it.actividadProceso || '').trim().toLowerCase())
        ).size;
        const mColabs = new Set(
          mItems.map((it) => (it.responsableFuncional || '').trim().toLowerCase())
        ).size;

        return {
          nombre,
          totalActividades: uniqueMacroActividades,
          totalFilas: mItems.length,
          horasTotales: Number(mTotal.toFixed(1)),
          horasManuales: Number(mManual.toFixed(1)),
          horasAutomatizadas: Number(mAuto.toFixed(1)),
          pctAutomatizado: mTotal > 0 ? Number(((mAuto / mTotal) * 100).toFixed(1)) : 0,
          colaboradoresCount: mColabs,
          actividades: mItems,
        };
      }
    ).sort((a, b) => b.horasTotales - a.horasTotales);

    const uniqueGerenciaActividades = new Set(
      items.map((it) => (it.actividadProceso || '').trim().toLowerCase())
    ).size;

    summaries.push({
      gerencia,
      totalProcesosMacro: macroMap.size,
      totalActividades: uniqueGerenciaActividades,
      totalFilas: items.length,
      totalColaboradores: colaboradoresSet.size,
      horasTotales: Number(horasTotales.toFixed(1)),
      horasManuales: Number(horasManuales.toFixed(1)),
      horasAutomatizadas: Number(horasAutomatizadas.toFixed(1)),
      horasPotencialAutomatizable: Number(horasPotencialAutomatizable.toFixed(1)),
      tareasManuales,
      tareasAutomatizadas,
      pctAutomatizado,
      pctPotencialMeta,
      fteActual: Number((horasTotales / 152).toFixed(1)),
      fteLiberables: Number((horasPotencialAutomatizable / 152).toFixed(2)),
      macroProcessesList,
    });
  }

  // Sort alphabetically or by total hours descending
  return summaries.sort((a, b) => b.horasTotales - a.horasTotales);
}

/**
 * Computes workload and task metrics per Collaborator (RESPONSABLE FUNCIONAL) by Gerencia.
 * Highlights:
 * - Nombre del colaborador
 * - Carga laboral actual (horas y % de jornada estándar de 152 h/mes)
 * - Volumen de tareas manuales ejecutadas
 * - Volumen de tareas automatizadas
 */
export function computeColaboradorSummaries(records: ProcessRecord[]): ColaboradorSummaryItem[] {
  const map = new Map<string, ProcessRecord[]>();

  for (const r of records) {
    const colab = (r.responsableFuncional || 'Sin Asignar').replace(/\s+/g, ' ').trim();
    const gerencia = (r.gerencia || 'General').trim();
    const key = `${gerencia}:::${colab}`;

    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(r);
  }

  const results: ColaboradorSummaryItem[] = [];

  for (const [key, items] of map.entries()) {
    const [gerencia, colaborador] = key.split(':::');
    const puesto = items[0]?.puesto || 'Especialista';

    let horasTotales = 0;
    let horasManuales = 0;
    let horasAutomatizadas = 0;
    let horasPotencial = 0;
    let tareasManuales = 0;
    let tareasAutomatizadas = 0;

    for (const it of items) {
      const hTot = normalizeNumber(it.horasMensualesTotal != null ? it.horasMensualesTotal : it.horasMensualesActividad);
      const hMan = normalizeNumber(it.horasManualesTotal != null ? it.horasManualesTotal : it.horasManuales);
      const hAut = normalizeNumber(it.horasMensualesAutomatizadas);

      horasTotales += hTot;
      horasManuales += hMan;
      horasAutomatizadas += hAut;

      if (normalizeYesNo(it.esAutomatizable) === 'Sí') {
        horasPotencial += hMan;
      }

      if (hMan > 0) tareasManuales++;
      if (hAut > 0 || (it.porcentajeAutomatizado || 0) > 0) tareasAutomatizadas++;
    }

    const pctAutomatizado =
      horasTotales > 0 ? Number(((horasAutomatizadas / horasTotales) * 100).toFixed(1)) : 0;
    // Carga laboral del colaborador basada en horas manuales sobre jornada de 152h
    const porcentajeJornada =
      Number(((horasManuales / 152) * 100).toFixed(1));

    const uniqueColabActs = new Set(
      items.map((it) => (it.actividadProceso || '').trim().toLowerCase())
    ).size;

    results.push({
      colaborador,
      gerencia,
      puesto,
      totalActividades: uniqueColabActs,
      horasTotales: Number(horasTotales.toFixed(1)),
      horasManuales: Number(horasManuales.toFixed(1)),
      horasAutomatizadas: Number(horasAutomatizadas.toFixed(1)),
      tareasManuales,
      tareasAutomatizadas,
      pctAutomatizado,
      porcentajeJornada,
      horasPotencialAutomatizable: Number(horasPotencial.toFixed(1)),
      actividades: items,
    });
  }

  // Sort by manual workload (hours) descending
  return results.sort((a, b) => b.horasManuales - a.horasManuales);
}

/**
 * Exports all records into a multi-sheet Excel file (.XLSX)
 * Creates a tab per Gerencia, plus a consolidated summary tab.
 */
export function exportRecordsToMultiSheetXlsx(
  records: ProcessRecord[],
  fileName: string = 'Reporte_Ejecutivo_Eficiencia.xlsx'
): void {
  const workbook = XLSX.utils.book_new();

  // 1. Consolidated Summary Sheet
  const summaries = computeGerenciaSummaries(records);
  const summaryRows = summaries.map((s) => ({
    'Gerencia': s.gerencia,
    'Procesos Macro': s.totalProcesosMacro,
    'Actividades Evaluadas': s.totalActividades,
    'Colaboradores': s.totalColaboradores,
    'Horas Mensuales (Total)': s.horasTotales,
    'Horas Manuales': s.horasManuales,
    'Horas Automatizadas': s.horasAutomatizadas,
    '% Automatizado': `${s.pctAutomatizado}%`,
    'Horas Potencial Automatizable': s.horasPotencialAutomatizable,
    'FTE Liberable': s.fteLiberables,
  }));
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen Consolidado');

  // 2. Separate sheet per Gerencia with all 14 columns
  const gerenciaMap = new Map<string, ProcessRecord[]>();
  for (const r of records) {
    const g = (r.gerencia || 'General').trim();
    if (!gerenciaMap.has(g)) gerenciaMap.set(g, []);
    gerenciaMap.get(g)!.push(r);
  }

  for (const [gerencia, items] of gerenciaMap.entries()) {
    // Excel sheet name max 31 characters and no forbidden chars
    const safeSheetName = gerencia.substring(0, 31).replace(/[:\\\/\?\*\[\]]/g, '_');
    const tableRows = items.map((r) => ({
      'Area / Sub Area': r.areaSubArea,
      'TIPO DE PROCESO': r.tipoProceso,
      'PROCESO MACRO': r.procesoMacro,
      'ACTIVIDAD / PROCESO': r.actividadProceso,
      'FRECUENCIA': r.frecuencia,
      'PUESTO': r.puesto,
      'REPONSABLE FUNCIONAL': r.responsableFuncional,
      '¿DIGITALIZADO?': r.digitalizado,
      '¿ES AUTOMATIZABLE?': r.esAutomatizable,
      'HERRAMIENTA': r.herramienta,
      '% AUTOMATIZADO': `${r.porcentajeAutomatizado}%`,
      'Horas mensuales Actividad (Total)': r.horasMensualesTotal,
      'Horas mensuales Automatizadas (Total)': r.horasMensualesAutomatizadas,
      'Horas manuales (Total)': r.horasManualesTotal,
    }));
    const sheet = XLSX.utils.json_to_sheet(tableRows);
    XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName);
  }

  XLSX.writeFile(workbook, fileName);
}

/**
 * Parses raw clipboard or CSV/TSV table text into ProcessRecord objects.
 */
export function parsePastedTableText(text: string, defaultGerencia = 'Gerencia General'): ProcessRecord[] {
  if (!text || !text.trim()) return [];

  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Detect delimiter
  const firstLine = lines[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = tabCount >= commaCount ? '\t' : ',';

  const rows = lines.map((l) => l.split(delimiter).map((c) => c.replace(/^["']|["']$/g, '').trim()));
  const header = rows[0].map((h) => h.toUpperCase());

  const findIdx = (keywords: string[]) => {
    return header.findIndex((h) => keywords.some((k) => h.includes(k)));
  };

  const idxGerencia = findIdx(['GERENCIA']);
  const idxArea = findIdx(['AREA', 'SUB AREA']);
  const idxTipo = findIdx(['TIPO DE PROCESO', 'TIPO']);
  const idxMacro = findIdx(['PROCESO MACRO', 'MACRO']);
  const idxAct = findIdx(['ACTIVIDAD', 'PROCESO']);
  const idxFrec = findIdx(['FRECUENCIA']);
  const idxPuesto = findIdx(['PUESTO', 'ROL', 'CARGO']);
  const idxResp = findIdx(['RESPONSABLE', 'REPONSABLE']);
  const idxDig = findIdx(['DIGITALIZADO']);
  const idxAuto = findIdx(['AUTOMATIZABLE']);
  const idxTool = findIdx(['HERRAMIENTA']);
  const idxPct = findIdx(['% AUTOMATIZADO', 'PORCENTAJE']);
  const idxHTot = findIdx(['HORAS MENSUALES ACTIVIDAD', 'HORAS MENSUALES TOTAL', 'HORAS TOTAL']);
  const idxHAuto = findIdx(['HORAS MENSUALES AUTOMATIZADAS', 'HORAS AUTOMATIZADAS']);
  const idxHMan = findIdx(['HORAS MANUALES']);

  const records: ProcessRecord[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 3 || row.every((c) => !c)) continue;

    const gerencia = idxGerencia !== -1 && row[idxGerencia] ? row[idxGerencia] : defaultGerencia;
    const actText = idxAct !== -1 && row[idxAct] ? row[idxAct] : `Actividad ${i}`;
    const hTot = idxHTot !== -1 ? normalizeNumber(row[idxHTot]) : 10;
    const hAuto = idxHAuto !== -1 ? normalizeNumber(row[idxHAuto]) : 0;
    const hMan = idxHMan !== -1 ? normalizeNumber(row[idxHMan]) : Math.max(0, hTot - hAuto);

    records.push({
      id: `pasted-${i}-${Date.now()}`,
      gerencia,
      areaSubArea: idxArea !== -1 && row[idxArea] ? row[idxArea] : gerencia,
      tipoProceso: idxTipo !== -1 && row[idxTipo] ? row[idxTipo] : 'OPERATIVO',
      procesoMacro: idxMacro !== -1 && row[idxMacro] ? row[idxMacro] : 'General',
      actividadProceso: actText,
      frecuencia: idxFrec !== -1 && row[idxFrec] ? row[idxFrec] : 'Mensual',
      puesto: idxPuesto !== -1 && row[idxPuesto] ? row[idxPuesto] : 'Especialista',
      responsableFuncional: idxResp !== -1 && row[idxResp] ? row[idxResp] : 'Sin Asignar',
      digitalizado: idxDig !== -1 ? normalizeYesNo(row[idxDig]) : 'No',
      esAutomatizable: idxAuto !== -1 ? normalizeYesNo(row[idxAuto]) : 'Sí',
      herramienta: idxTool !== -1 && row[idxTool] ? row[idxTool] : 'N/A',
      porcentajeAutomatizado: idxPct !== -1 ? normalizeNumber(row[idxPct]) : hTot > 0 ? (hAuto / hTot) * 100 : 0,
      horasMensualesTotal: hTot,
      horasMensualesActividad: hTot,
      horasMensualesAutomatizadas: hAuto,
      horasManualesTotal: hMan,
      horasManuales: hMan,
    });
  }

  return records;
}

/**
 * Converts ActivityItem array from googleDriveService into ProcessRecord array.
 */
export function convertActivitiesToRecords(acts: any[]): ProcessRecord[] {
  return acts.map((a, idx) => {
    const hTot = normalizeNumber(a.horasMensualesTotal != null ? a.horasMensualesTotal : a.horasMensualesActividad);
    const hMan = normalizeNumber(a.horasManualesTotal != null ? a.horasManualesTotal : a.horasManuales);
    const hAut = normalizeNumber(a.horasMensualesAutomatizadas);

    return {
      id: a.id || `rec-${idx}-${Date.now()}`,
      gerencia: (a.gerencia || 'General').trim(),
      areaSubArea: (a.areaSubArea || a.gerencia || 'General').trim(),
      tipoProceso: a.tipoProceso || 'OPERATIVO',
      procesoMacro: a.procesoMacro || 'General',
      actividadProceso: a.actividadProceso || 'Actividad',
      frecuencia: a.frecuencia || 'Mensual',
      puesto: a.puesto || 'Especialista',
      responsableFuncional: (a.responsableFuncional || 'Sin Asignar').replace(/\s+/g, ' ').trim(),
      digitalizado: a.digitalizado === 'SÍ' || a.digitalizado === 'Sí' ? 'Sí' : 'No',
      esAutomatizable: a.esAutomatizable === 'SÍ' || a.esAutomatizable === 'Sí' ? 'Sí' : 'No',
      herramienta: a.herramienta || 'N/A',
      porcentajeAutomatizado: typeof a.porcentajeAutomatizado === 'number' ? a.porcentajeAutomatizado : 0,
      horasMensualesTotal: hTot,
      horasMensualesActividad: hTot,
      horasMensualesAutomatizadas: hAut,
      horasManualesTotal: hMan,
      horasManuales: hMan,
      satisfaccionOperativa: a.satisfaccionOperativa,
    };
  });
}
