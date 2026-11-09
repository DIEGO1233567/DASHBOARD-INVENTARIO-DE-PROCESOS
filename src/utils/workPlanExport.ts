import ExcelJS from 'exceljs';
import { formatHours, formatThousands } from './sheetsParser';

export interface PlanCollaborator {
  id: string;
  name: string;
  role: 'Jefe Sr' | 'Jefe' | 'Becario' | 'Especialista';
  isVacancy?: boolean;
  isNominaExclusive?: boolean;
  monthlyCapacity: number;
  totalCapacity: number;
  assignedCount: number;
  assignedHours: number;
  gerenciasCovered: string[];
}

export interface PlanActivity {
  id: string;
  actividadProceso: string;
  gerencia: string;
  tipo: 'NO_DIG_SI_AUTO' | 'NO_DIG_NO_AUTO' | 'REQUERIMIENTO' | 'MANTENIMIENTO';
  tipoLabel: string;
  horasManualesMensuales: number;
  horasTotalesMensuales: number;
  colaboradorAsignadoId: string;
  colaboradorAsignadoNombre: string;
  colaboradorAsignadoRol: string;
  assignedYear: number;
  prioridad: number;
  isNomina: boolean;
  isPendingDefinition?: boolean;
  gerenciaInitialPct?: number;
  gerenciaSimPct?: number;
  levelingTier?: string;
}

export interface PlanScenarioConfig {
  years: number;
  monthsTotal: number;
  jefeMonthlyCapacity: number;
  becarioMonthlyCapacity: number;
  especialistaMonthlyCapacity: number;
  pctNoAutoToInclude: number;
  includeNoAutoActivities?: boolean;
  levelingTargetPct?: number;
  anualRequerimientos: number;
  anualMantenimientos: number;
  totalActividades: number;
  totalHorasManuales: number;
  capacidadTotalEquipo: number;
  balanceActividades: number;
  esViable: boolean;
}

export async function exportWorkPlanSimulationXlsx(
  config: PlanScenarioConfig,
  collaborators: PlanCollaborator[],
  activities: PlanActivity[],
  fileName: string = 'Plan_de_Trabajo_Eficiencia_Procesos.xlsx'
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Liverpool - Eficiencia de Procesos';
  workbook.lastModifiedBy = 'Liverpool - Eficiencia de Procesos';
  workbook.created = new Date();
  workbook.modified = new Date();

  // --------------------------------------------------------------------------
  // HOJA 1: RESUMEN EJECUTIVO Y MATRIZ DE COLABORADORES
  // --------------------------------------------------------------------------
  const sheetSummary = workbook.addWorksheet('Resumen Ejecutivo Plan', {
    views: [{ showGridLines: true }],
  });

  sheetSummary.columns = [
    { width: 4 },  // A (Margen)
    { width: 32 }, // B (Colaborador / Parámetro)
    { width: 22 }, // C (Rol / Valor)
    { width: 16 }, // D (Capacidad)
    { width: 16 }, // E (Asignadas)
    { width: 16 }, // F (Horas Asignadas)
    { width: 16 }, // G (% Ocupación)
    { width: 38 }, // H (Gerencias Asignadas)
  ];

  // Header banner corporativo
  sheetSummary.mergeCells('B2:H2');
  const titleCell = sheetSummary.getCell('B2');
  titleCell.value = 'PLAN DE DISTRIBUCIÓN DE AUTOMATIZACIÓN DE PROCESOS';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }, // Slate 900
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheetSummary.getRow(2).height = 36;

  sheetSummary.mergeCells('B3:H3');
  const startCalYear = 2027;
  const endCalYear = startCalYear + config.years - 1;
  const subTitleCell = sheetSummary.getCell('B3');
  subTitleCell.value = `Horizonte del Plan: ${startCalYear} a ${endCalYear} (${config.years} Años · ${config.monthsTotal} Meses) | Viabilidad: ${config.esViable ? 'VIABLE (SUPERÁVIT)' : 'REQUIERE AJUSTE (DÉFICIT)'}`;
  subTitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: config.esViable ? 'FF10B981' : 'FFF43F5E' } };
  subTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' },
  };
  subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheetSummary.getRow(3).height = 24;

  // KPIs Resumen
  sheetSummary.getCell('B5').value = 'MÉTRICAS CLAVE DEL PLAN';
  sheetSummary.getCell('B5').font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1E3A8A' } };

  const kpis = [
    ['Total Actividades a Distribuir', `${formatThousands(config.totalActividades)} actividades`],
    ['Total Horas Manuales a Liberar', `${formatHours(config.totalHorasManuales)} h/mes (${formatThousands(config.totalHorasManuales / 152, 1)} FTE)`],
    ['Capacidad Total del Equipo', `${formatThousands(config.capacidadTotalEquipo)} actividades en ${config.years} años (${startCalYear}-${endCalYear})`],
    ['Balance de Capacidad', `${config.balanceActividades >= 0 ? '+' : ''}${formatThousands(config.balanceActividades)} actividades (${config.esViable ? 'Superávit' : 'Déficit'})`],
    ['Plazo de Ejecución Calendario', `${startCalYear} a ${endCalYear} (${config.years} Años · ${config.monthsTotal} Meses)`],
    ['Requerimientos y Mantenimientos Totales', `${config.anualRequerimientos * config.years} reqs + ${config.anualMantenimientos * config.years} mants`],
    ['Regla Especial de Nómina', 'Asignada exclusivamente a Daniel García Velázquez'],
  ];

  kpis.forEach((kpi, idx) => {
    const rowNum = 6 + idx;
    sheetSummary.getCell(`B${rowNum}`).value = kpi[0];
    sheetSummary.getCell(`B${rowNum}`).font = { bold: true, color: { argb: 'FF334155' } };
    sheetSummary.getCell(`B${rowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    sheetSummary.getCell(`C${rowNum}`).value = kpi[1];
    sheetSummary.getCell(`C${rowNum}`).font = { bold: true, color: { argb: 'FF0F172A' } };
    sheetSummary.mergeCells(`C${rowNum}:D${rowNum}`);
  });

  // Matriz de Colaboradores
  const tableStartRow = 15;
  sheetSummary.getCell(`B${tableStartRow - 1}`).value = 'DISTRIBUCIÓN POR COLABORADOR DEL EQUIPO DE EFICIENCIA';
  sheetSummary.getCell(`B${tableStartRow - 1}`).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1E3A8A' } };

  const colHeaders = [
    'Colaborador',
    'Rol',
    'Capacidad Máx',
    'Actividades Asignadas',
    'Horas Asignadas/Mes',
    '% Ocupación',
    'Gerencias con Actividades',
  ];

  colHeaders.forEach((h, i) => {
    const colLetter = String.fromCharCode(66 + i); // B to H
    const cell = sheetSummary.getCell(`${colLetter}${tableStartRow}`);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; // Blue 600
    cell.alignment = { horizontal: i >= 2 && i <= 5 ? 'center' : 'left', vertical: 'middle' };
  });
  sheetSummary.getRow(tableStartRow).height = 24;

  collaborators.forEach((c, idx) => {
    const rowNum = tableStartRow + 1 + idx;
    const isDaniel = c.isNominaExclusive;
    const isVac = c.isVacancy;
    const ocupPct = c.totalCapacity > 0 ? (c.assignedCount / c.totalCapacity) * 100 : 0;

    sheetSummary.getCell(`B${rowNum}`).value = `${c.name} ${isDaniel ? '⭐ (Exclusivo Nómina)' : ''}${isVac ? ' [Vacante]' : ''}`;
    sheetSummary.getCell(`B${rowNum}`).font = { bold: isDaniel || isVac, color: { argb: isDaniel ? 'FF1E3A8A' : isVac ? 'FF7C3AED' : 'FF0F172A' } };

    sheetSummary.getCell(`C${rowNum}`).value = c.role;
    sheetSummary.getCell(`C${rowNum}`).font = { color: { argb: 'FF475569' } };

    sheetSummary.getCell(`D${rowNum}`).value = c.totalCapacity;
    sheetSummary.getCell(`D${rowNum}`).alignment = { horizontal: 'center' };

    sheetSummary.getCell(`E${rowNum}`).value = Number(c.assignedCount.toFixed(1));
    sheetSummary.getCell(`E${rowNum}`).font = { bold: true };
    sheetSummary.getCell(`E${rowNum}`).alignment = { horizontal: 'center' };

    sheetSummary.getCell(`F${rowNum}`).value = Number(c.assignedHours.toFixed(1));
    sheetSummary.getCell(`F${rowNum}`).alignment = { horizontal: 'right' };

    sheetSummary.getCell(`G${rowNum}`).value = `${ocupPct.toFixed(1)}%`;
    sheetSummary.getCell(`G${rowNum}`).alignment = { horizontal: 'center' };
    sheetSummary.getCell(`G${rowNum}`).font = {
      bold: true,
      color: { argb: ocupPct > 100 ? 'FFE11D48' : ocupPct >= 80 ? 'FF059669' : 'FFD97706' },
    };

    sheetSummary.getCell(`H${rowNum}`).value = c.gerenciasCovered.join(', ') || 'Sin gerencias';
    sheetSummary.getCell(`H${rowNum}`).font = { size: 9, color: { argb: 'FF334155' } };

    const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    for (let col = 66; col <= 72; col++) {
      const cell = sheetSummary.getCell(`${String.fromCharCode(col)}${rowNum}`);
      if (!cell.fill || (cell.fill as any).type !== 'pattern') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }
  });

  // --------------------------------------------------------------------------
  // HOJA 2: CATÁLOGO COMPLETO DE ACTIVIDADES Y ASIGNACIONES
  // --------------------------------------------------------------------------
  const sheetActivities = workbook.addWorksheet('Plan Detalle Actividades', {
    views: [{ showGridLines: true }],
  });

  sheetActivities.columns = [
    { width: 4 },  // A
    { width: 10 }, // B Prioridad
    { width: 12 }, // C Año Calendario
    { width: 28 }, // D Gerencia
    { width: 48 }, // E Actividad / Tarea
    { width: 28 }, // F Tipo / Clasificación
    { width: 24 }, // G Tier de Nivelación (80%)
    { width: 18 }, // H Horas Manuales/Mes
    { width: 32 }, // I Colaborador Asignado
    { width: 18 }, // J Rol Colaborador
    { width: 14 }, // K % Base Gerencia
  ];

  sheetActivities.mergeCells('B2:K2');
  const actHeader = sheetActivities.getCell('B2');
  actHeader.value = 'CATÁLOGO DE ACTIVIDADES ASIGNADAS Y CRONOGRAMA';
  actHeader.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  actHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  actHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  sheetActivities.getRow(2).height = 30;

  const actTableStart = 4;
  const actCols = [
    'Prioridad',
    'Año',
    'Gerencia',
    'Actividad / Proceso',
    'Clasificación en Plan',
    'Estrategia Nivelación',
    'Horas Manuales / Mes',
    'Colaborador Asignado',
    'Rol del Asignado',
    '% Base Gerencia',
  ];

  actCols.forEach((h, i) => {
    const colLetter = String.fromCharCode(66 + i); // B to K
    const cell = sheetActivities.getCell(`${colLetter}${actTableStart}`);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }; // Teal 700
    cell.alignment = { horizontal: i === 0 || i === 1 || i === 6 || i === 9 ? 'center' : 'left', vertical: 'middle' };
  });
  sheetActivities.getRow(actTableStart).height = 22;

  activities.forEach((act, idx) => {
    const rowNum = actTableStart + 1 + idx;

    sheetActivities.getCell(`B${rowNum}`).value = act.prioridad;
    sheetActivities.getCell(`B${rowNum}`).alignment = { horizontal: 'center' };

    const calYear = act.tipo === 'REQUERIMIENTO' || act.tipo === 'MANTENIMIENTO' ? 'Anual' : (2026 + act.assignedYear);
    sheetActivities.getCell(`C${rowNum}`).value = calYear;
    sheetActivities.getCell(`C${rowNum}`).alignment = { horizontal: 'center' };
    sheetActivities.getCell(`C${rowNum}`).font = { bold: true };

    sheetActivities.getCell(`D${rowNum}`).value = act.gerencia;

    sheetActivities.getCell(`E${rowNum}`).value = act.actividadProceso;

    sheetActivities.getCell(`F${rowNum}`).value = act.tipoLabel;

    // Col G: Tier Nivelación
    const tierLabel =
      act.levelingTier === 'NIVELACION_SUB_80'
        ? 'Nivelación (< 80%)'
        : act.levelingTier === 'CONSOLIDACION_SUPER_80'
        ? 'Consolidación (≥ 80%)'
        : act.levelingTier === 'EVALUACION_NO_AUTO'
        ? 'Cupo No Auto [Por Evaluar]'
        : 'Operativo';
    sheetActivities.getCell(`G${rowNum}`).value = tierLabel;
    sheetActivities.getCell(`G${rowNum}`).alignment = { horizontal: 'center' };

    // Col H: Horas
    if (act.tipo === 'NO_DIG_NO_AUTO' || act.isPendingDefinition) {
      sheetActivities.getCell(`H${rowNum}`).value = 'Por definir';
      sheetActivities.getCell(`H${rowNum}`).alignment = { horizontal: 'center' };
      sheetActivities.getCell(`H${rowNum}`).font = { italic: true, color: { argb: 'FFB45309' } };
    } else {
      sheetActivities.getCell(`H${rowNum}`).value = act.horasManualesMensuales;
      sheetActivities.getCell(`H${rowNum}`).alignment = { horizontal: 'right' };
    }

    // Col I: Colaborador
    sheetActivities.getCell(`I${rowNum}`).value = act.colaboradorAsignadoNombre;
    sheetActivities.getCell(`I${rowNum}`).font = {
      bold: act.isNomina,
      color: { argb: act.isNomina ? 'FF1E3A8A' : 'FF0F172A' },
    };

    // Col J: Rol
    sheetActivities.getCell(`J${rowNum}`).value = act.colaboradorAsignadoRol;

    // Col K: % Base Gerencia
    sheetActivities.getCell(`K${rowNum}`).value =
      act.gerenciaInitialPct !== undefined ? `${act.gerenciaInitialPct}%` : 'N/D';
    sheetActivities.getCell(`K${rowNum}`).alignment = { horizontal: 'center' };

    const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
    for (let col = 66; col <= 75; col++) {
      const cell = sheetActivities.getCell(`${String.fromCharCode(col)}${rowNum}`);
      if (!cell.fill || (cell.fill as any).type !== 'pattern') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }
  });

  // Generar y descargar archivo
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
