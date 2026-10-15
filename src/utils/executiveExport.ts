import ExcelJS from 'exceljs';
import { ColaboradorSummaryItem, GerenciaSummaryItem } from '../types/sheets';
import { formatHours, formatThousands } from './sheetsParser';

export interface TopKpiData {
  gerenciasCount: number;
  macroByGerenciaCount: number;
  actividadesCount: number;
  totalFilasCount: number;
  colaboradoresCount: number;
  horasTotales: number;
  horasManuales: number;
  horasAutomatizadas: number;
  pctAutomatizadoGlobal: number;
}

/**
 * Captures an SVG element from the DOM and converts it to a high-resolution PNG base64 string.
 * Preserves fonts, colors, and margins so no axis, label, or legend info gets clipped.
 */
async function captureSvgAsBase64Png(svgElement: SVGSVGElement): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const targetWidth = 1060;
      const targetHeight = 480;

      // Clone SVG node to safely inject styling without altering the live DOM
      const clone = svgElement.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', String(targetWidth));
      clone.setAttribute('height', String(targetHeight));
      clone.setAttribute('viewBox', `0 0 ${targetWidth} ${targetHeight}`);

      // Inject explicit embedded CSS so class-based Tailwind colors and fonts render properly in isolated canvas
      const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      styleEl.textContent = `
        text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
        .fill-slate-500 { fill: #64748b; }
        .fill-slate-700 { fill: #334155; }
        .fill-slate-800 { fill: #1e293b; }
        .fill-slate-900 { fill: #0f172a; }
        .fill-emerald-700 { fill: #047857; }
        .fill-emerald-800 { fill: #065f46; }
        .fill-blue-900 { fill: #1e3a8a; }
        .fill-blue-700 { fill: #1d4ed8; }
        .fill-white { fill: #ffffff; }
      `;
      clone.insertBefore(styleEl, clone.firstChild);

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(clone);

      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobUrl = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          // High resolution 2x scale
          const scale = 2;
          canvas.width = targetWidth * scale;
          canvas.height = targetHeight * scale;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(blobUrl);
            resolve(null);
            return;
          }

          // Crisp white background so dark or gray text has optimal contrast
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

          const pngBase64 = canvas.toDataURL('image/png');
          URL.revokeObjectURL(blobUrl);
          resolve(pngBase64);
        } catch (e) {
          console.warn('Canvas export error:', e);
          URL.revokeObjectURL(blobUrl);
          resolve(null);
        }
      };

      image.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        resolve(null);
      };

      image.src = blobUrl;
    } catch (err) {
      console.warn('SVG serialization error:', err);
      resolve(null);
    }
  });
}

/**
 * Generates and downloads a rich, formatted .xlsx file containing:
 * - Encabezados (Indicadores Clave de Inicio / KPIs Ejecutivos)
 * - Gráfica Comparativa con imagen en alta resolución y tabla de datos completa
 * - Sección 01: Resumen Gerencial Pivot y desglose de Procesos Macro
 * - Sección 02: Carga Laboral por Colaborador (Responsable Funcional con base en Horas Manuales)
 *
 * NOTA: Conforme a la solicitud del usuario, NO se incluyen las Secciones 03 ni 04 (Catálogo maestro de todas las filas individuales).
 * Las columnas cuentan con ancho ampliado y la gráfica tiene dimensiones completas para evitar cortes de información.
 */
export async function exportExecutiveSummaryXlsx(
  kpi: TopKpiData,
  summaries: GerenciaSummaryItem[],
  colaboradores: ColaboradorSummaryItem[],
  selectedGerencia: string = 'ALL',
  fileName: string = 'Resumen_Ejecutivo_Encabezados_a_Sec2.xlsx'
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Tablero Inventario de Procesos';
  workbook.created = new Date();

  // Try to capture chart image from DOM
  const svgEl = (document.getElementById('gerencias-chart-svg') ||
    document.querySelector('#grafica-gerencias svg')) as SVGSVGElement | null;
  let chartBase64: string | null = null;
  if (svgEl) {
    try {
      chartBase64 = await captureSvgAsBase64Png(svgEl);
    } catch (e) {
      console.warn('Could not capture chart image:', e);
    }
  }

  // Filter scoped collaborators
  const scopedColabs =
    selectedGerencia === 'ALL'
      ? colaboradores
      : colaboradores.filter((c) => c.gerencia === selectedGerencia);

  const totalColabs = scopedColabs.length;
  const totalHorasManualesColab = scopedColabs.reduce((acc, c) => acc + c.horasManuales, 0);
  const avgHorasManualesColab = totalColabs > 0 ? totalHorasManualesColab / totalColabs : 0;
  const totalTareasMan = scopedColabs.reduce((acc, c) => acc + c.tareasManuales, 0);
  const totalTareasAuto = scopedColabs.reduce((acc, c) => acc + c.tareasAutomatizadas, 0);

  // -------------------------------------------------------------
  // HOJA 1: RESUMEN EJECUTIVO (ENCABEZADOS HASTA SECCIÓN 02)
  // -------------------------------------------------------------
  const ws1 = workbook.addWorksheet('Resumen Ejecutivo', {
    views: [{ showGridLines: true }],
  });

  // Generous column widths so no text, metrics or titles are truncated
  ws1.columns = [
    { width: 46 }, // A: Concepto / Gerencia
    { width: 28 }, // B: Cifra Principal / Macro / Horas Manuales
    { width: 28 }, // C: Equivalente FTE / Actividades / Horas Auto
    { width: 36 }, // D: Promedio / Detalle / Horas Totales
    { width: 30 }, // E: Volumen Adicional / Actividades
    { width: 30 }, // F: Estado / Distribución / % Automatizado
    { width: 28 }, // G: FTE Total / Observaciones
    { width: 24 }, // H: Notas Adicionales
  ];

  // Header banner
  ws1.mergeCells('A1:G1');
  const titleCell = ws1.getCell('A1');
  titleCell.value = 'TABLERO INVENTARIO DE PROCESOS - REPORTE EJECUTIVO (ENCABEZADOS A SECCIÓN 02)';
  titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }, // Slate 900
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws1.getRow(1).height = 36;

  // Subtitle info
  ws1.mergeCells('A2:G2');
  const subCell = ws1.getCell('A2');
  const scopeText =
    selectedGerencia === 'ALL'
      ? 'Consolidado Global (Todas las Gerencias)'
      : `Gerencia: ${selectedGerencia}`;
  const now = new Date();
  subCell.value = `Alcance: ${scopeText}  |  Fecha: ${now.toLocaleDateString('es-MX')} ${now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}  |  Jornada Base: 152 h/mes  |  Excluye Secciones 03 y 04`;
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF334155' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws1.getRow(2).height = 20;

  // Empty row 3
  ws1.getRow(3).height = 10;

  // -------------------------------------------------------------
  // 1. INDICADORES CLAVE DE INICIO (ENCABEZADOS KPIS)
  // -------------------------------------------------------------
  ws1.mergeCells('A4:G4');
  const kpiHeader = ws1.getCell('A4');
  kpiHeader.value = '1. INDICADORES CLAVE DE INICIO (ENCABEZADOS KPIS)';
  kpiHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  kpiHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' }, // Blue 900
  };
  kpiHeader.alignment = { vertical: 'middle', indent: 1 };
  ws1.getRow(4).height = 26;

  // KPI Table Headers
  const kpiTableHeaders = [
    'Indicador',
    'Cifra Principal',
    'Equivalente FTE (152h)',
    'Promedio / Detalle',
    'Volumen Adicional',
    'Estado / Distribución',
    '',
  ];
  const r5 = ws1.getRow(5);
  r5.height = 22;
  kpiTableHeaders.forEach((th, idx) => {
    if (idx < 6) {
      const cell = r5.getCell(idx + 1);
      cell.value = th;
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.alignment = { vertical: 'middle', horizontal: idx === 0 ? 'left' : 'center' };
      cell.border = { bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } } };
    }
  });

  const avgManual =
    kpi.colaboradoresCount > 0 ? (kpi.horasManuales / kpi.colaboradoresCount).toFixed(1) : '0';
  const pctAuto = kpi.pctAutomatizadoGlobal.toFixed(1);
  const pctManual = (100 - kpi.pctAutomatizadoGlobal).toFixed(1);

  const kpiRows = [
    [
      'Procesos Macro Evaluados',
      `${formatThousands(kpi.macroByGerenciaCount)} procesos`,
      'N/A',
      `${formatThousands(kpi.gerenciasCount)} gerencias activas`,
      'Estructura multi-proceso',
      'Inventario consolidado',
    ],
    [
      'Actividades / Procesos (Únicas)',
      `${formatThousands(kpi.actividadesCount)} actividades`,
      'N/A',
      `${formatThousands(kpi.totalFilasCount)} registros evaluados`,
      `${formatThousands(kpi.colaboradoresCount)} responsables funcionales`,
      'Actividades únicas sin duplicar',
    ],
    [
      'Horas Mensuales Manuales',
      `${formatHours(kpi.horasManuales)} h/mes`,
      `${formatThousands(kpi.horasManuales / 152, 1)} FTE manual`,
      `Promedio: ${formatThousands(Number(avgManual), 1)} h/mes manuales`,
      'Carga operativa manual',
      `${pctManual}% del total de horas`,
    ],
    [
      'Horas Manuales vs. Automatizadas (Total)',
      `Total: ${formatHours(kpi.horasTotales)} h/mes`,
      `${formatThousands(kpi.horasTotales / 152, 1)} FTE total`,
      `Manual: ${formatHours(kpi.horasManuales)} h  |  Auto: ${formatHours(kpi.horasAutomatizadas)} h`,
      `Automatización: ${pctAuto}%`,
      `${pctAuto}% auto · ${pctManual}% manual`,
    ],
  ];

  kpiRows.forEach((row, i) => {
    const rowNum = 6 + i;
    const r = ws1.getRow(rowNum);
    r.height = 24;
    row.forEach((val, colIdx) => {
      const cell = r.getCell(colIdx + 1);
      cell.value = val;
      cell.font = { name: 'Arial', size: 9, bold: colIdx === 0 || colIdx === 1 };
      cell.alignment = { vertical: 'middle', horizontal: colIdx === 0 ? 'left' : 'center' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  // -------------------------------------------------------------
  // 2. GRÁFICA COMPARATIVA POR GERENCIA (IMAGEN SIN CORTES + DATOS)
  // -------------------------------------------------------------
  let currentExcelRow = 11;
  ws1.getRow(currentExcelRow).height = 10;
  currentExcelRow++;

  ws1.mergeCells(`A${currentExcelRow}:G${currentExcelRow}`);
  const chartHeader = ws1.getCell(`A${currentExcelRow}`);
  chartHeader.value =
    '2. GRÁFICA COMPARATIVA: HORAS MANUALES VS. AUTOMATIZADAS Y VOLUMEN DE ACTIVIDADES';
  chartHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  chartHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' },
  };
  chartHeader.alignment = { vertical: 'middle', indent: 1 };
  ws1.getRow(currentExcelRow).height = 26;
  currentExcelRow++;

  // If chart image is captured, insert it with full dimensions and dedicated row clearance
  if (chartBase64) {
    try {
      const imageId = workbook.addImage({
        base64: chartBase64,
        extension: 'png',
      });

      // Allocate 24 rows of height 20pt (480pt ≈ 640px) so image is NEVER squished or clipped
      const startChartRow = currentExcelRow;
      const chartRowsCount = 24;
      for (let r = 0; r < chartRowsCount; r++) {
        ws1.getRow(startChartRow + r).height = 20;
      }

      ws1.addImage(imageId, {
        tl: { col: 0.1, row: startChartRow - 0.8 },
        ext: { width: 1020, height: 460 },
        editAs: 'oneCell',
      });

      currentExcelRow += chartRowsCount + 1;
    } catch (e) {
      console.warn('Error inserting image in Excel:', e);
    }
  }

  // Table with chart data points
  ws1.mergeCells(`A${currentExcelRow}:G${currentExcelRow}`);
  const chartDataSubHeader = ws1.getCell(`A${currentExcelRow}`);
  chartDataSubHeader.value = 'DATOS DE LA GRÁFICA POR GERENCIA (HORAS MANUALES, AUTO Y VOLUMEN)';
  chartDataSubHeader.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF334155' } };
  chartDataSubHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  chartDataSubHeader.alignment = { vertical: 'middle', indent: 1 };
  ws1.getRow(currentExcelRow).height = 22;
  currentExcelRow++;

  const chartColHeaders = [
    'Gerencia',
    'Horas Manuales (h)',
    'Horas Auto (h)',
    'Horas Totales (h)',
    'Volumen Actividades',
    '% Automatizado',
    'FTE Total (152h)',
  ];
  const rChartHead = ws1.getRow(currentExcelRow);
  rChartHead.height = 24;
  chartColHeaders.forEach((th, idx) => {
    const cell = rChartHead.getCell(idx + 1);
    cell.value = th;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { vertical: 'middle', horizontal: idx === 0 ? 'left' : 'right' };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF94A3B8' } } };
  });
  currentExcelRow++;

  summaries.forEach((s, idx) => {
    const r = ws1.getRow(currentExcelRow);
    r.height = 21;
    r.getCell(1).value = s.gerencia;
    r.getCell(1).font = { name: 'Arial', size: 9, bold: true };
    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

    r.getCell(2).value = s.horasManuales;
    r.getCell(2).numFmt = '#,##0.0';
    r.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(3).value = s.horasAutomatizadas;
    r.getCell(3).numFmt = '#,##0.0';
    r.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(4).value = s.horasTotales;
    r.getCell(4).numFmt = '#,##0.0';
    r.getCell(4).font = { bold: true };
    r.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(5).value = s.totalActividades;
    r.getCell(5).numFmt = '#,##0';
    r.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(6).value = `${s.pctAutomatizado}%`;
    r.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(7).value = Number((s.horasTotales / 152).toFixed(1));
    r.getCell(7).numFmt = '#,##0.0';
    r.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

    for (let c = 1; c <= 7; c++) {
      const cell = r.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }
    currentExcelRow++;
  });

  // -------------------------------------------------------------
  // 3. SECCIÓN 01: RESUMEN GERENCIAL CONSOLIDADO
  // -------------------------------------------------------------
  currentExcelRow++;
  ws1.mergeCells(`A${currentExcelRow}:G${currentExcelRow}`);
  const sec1Header = ws1.getCell(`A${currentExcelRow}`);
  sec1Header.value = '3. SECCIÓN 01: RESUMEN GERENCIAL - PROCESOS MACRO, ACTIVIDADES Y HORAS';
  sec1Header.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  sec1Header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' },
  };
  sec1Header.alignment = { vertical: 'middle', indent: 1 };
  ws1.getRow(currentExcelRow).height = 26;
  currentExcelRow++;

  const sec1ColHeaders = [
    'Gerencia',
    'Procesos Macro',
    'Actividades Únicas',
    'Colaboradores',
    'Horas Totales (h)',
    'Horas Manuales (h)',
    'Horas Auto. (h)',
  ];

  const rSec1Head = ws1.getRow(currentExcelRow);
  rSec1Head.height = 24;
  sec1ColHeaders.forEach((th, idx) => {
    const cell = rSec1Head.getCell(idx + 1);
    cell.value = th;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate 900
    cell.alignment = { vertical: 'middle', horizontal: idx === 0 ? 'left' : 'right' };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF334155' } } };
  });
  currentExcelRow++;

  let totMacros = 0;
  let totActs = 0;
  let totColabs = 0;
  let totHorasTotales = 0;
  let totHorasManuales = 0;
  let totHorasAuto = 0;

  summaries.forEach((s, idx) => {
    totMacros += s.totalProcesosMacro;
    totActs += s.totalActividades;
    totColabs += s.totalColaboradores;
    totHorasTotales += s.horasTotales;
    totHorasManuales += s.horasManuales;
    totHorasAuto += s.horasAutomatizadas;

    const r = ws1.getRow(currentExcelRow);
    r.height = 22;
    r.getCell(1).value = s.gerencia;
    r.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

    r.getCell(2).value = s.totalProcesosMacro;
    r.getCell(2).numFmt = '#,##0';
    r.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(3).value = s.totalActividades;
    r.getCell(3).numFmt = '#,##0';
    r.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(4).value = s.totalColaboradores;
    r.getCell(4).numFmt = '#,##0';
    r.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(5).value = s.horasTotales;
    r.getCell(5).numFmt = '#,##0.0';
    r.getCell(5).font = { bold: true };
    r.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(6).value = s.horasManuales;
    r.getCell(6).numFmt = '#,##0.0';
    r.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(7).value = s.horasAutomatizadas;
    r.getCell(7).numFmt = '#,##0.0';
    r.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

    for (let c = 1; c <= 7; c++) {
      const cell = r.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }
    currentExcelRow++;
  });

  // Total Row for Section 1
  const rTotal = ws1.getRow(currentExcelRow);
  rTotal.height = 25;
  rTotal.getCell(1).value = 'TOTAL CONSOLIDADO (SECCIÓN 01)';
  rTotal.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  rTotal.getCell(2).value = totMacros;
  rTotal.getCell(2).numFmt = '#,##0';
  rTotal.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal.getCell(3).value = totActs;
  rTotal.getCell(3).numFmt = '#,##0';
  rTotal.getCell(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal.getCell(4).value = totColabs;
  rTotal.getCell(4).numFmt = '#,##0';
  rTotal.getCell(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal.getCell(5).value = Number(totHorasTotales.toFixed(1));
  rTotal.getCell(5).numFmt = '#,##0.0';
  rTotal.getCell(5).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal.getCell(6).value = Number(totHorasManuales.toFixed(1));
  rTotal.getCell(6).numFmt = '#,##0.0';
  rTotal.getCell(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal.getCell(7).value = Number(totHorasAuto.toFixed(1));
  rTotal.getCell(7).numFmt = '#,##0.0';
  rTotal.getCell(7).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

  for (let c = 1; c <= 7; c++) {
    const cell = rTotal.getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Slate 800
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF475569' } },
      bottom: { style: 'medium', color: { argb: 'FF475569' } },
    };
  }
  currentExcelRow++;

  // -------------------------------------------------------------
  // 4. SECCIÓN 02: RESUMEN DE CARGA LABORAL POR COLABORADOR
  // -------------------------------------------------------------
  currentExcelRow++;
  ws1.mergeCells(`A${currentExcelRow}:G${currentExcelRow}`);
  const sec2SummaryHeader = ws1.getCell(`A${currentExcelRow}`);
  sec2SummaryHeader.value =
    '4. SECCIÓN 02: RESUMEN DE CARGA LABORAL POR COLABORADOR (RESPONSABLE FUNCIONAL)';
  sec2SummaryHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  sec2SummaryHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' },
  };
  sec2SummaryHeader.alignment = { vertical: 'middle', indent: 1 };
  ws1.getRow(currentExcelRow).height = 26;
  currentExcelRow++;

  const sec2SummaryCards = [
    [
      'Colaboradores Asignados',
      `${formatThousands(totalColabs)} colaboradores`,
      'Responsables funcionales únicos identificados en el inventario',
    ],
    [
      'Carga Promedio del Equipo (Horas Manuales)',
      `${formatThousands(avgHorasManualesColab, 1)} h/mes`,
      `${formatThousands((avgHorasManualesColab / 152) * 100, 0)}% respecto a la jornada mensual normal (152h)`,
    ],
    [
      'Total Horas Manuales del Equipo',
      `${formatHours(totalHorasManualesColab)} h/mes`,
      `Equivalente a ${formatThousands(totalHorasManualesColab / 152, 1)} FTE operativos manuales`,
    ],
    [
      'Volumen de Tareas Manuales vs. Automatizadas',
      `${formatThousands(totalTareasMan)} manuales · ${formatThousands(totalTareasAuto)} automatizadas`,
      `${formatThousands(totalTareasMan + totalTareasAuto)} ejecuciones totales analizadas`,
    ],
  ];

  sec2SummaryCards.forEach((card, cIdx) => {
    const r = ws1.getRow(currentExcelRow);
    r.height = 24;

    ws1.mergeCells(`A${currentExcelRow}:C${currentExcelRow}`);
    const cLabel = r.getCell(1);
    cLabel.value = card[0];
    cLabel.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    cLabel.alignment = { vertical: 'middle', horizontal: 'left' };

    ws1.mergeCells(`D${currentExcelRow}:E${currentExcelRow}`);
    const cVal = r.getCell(4);
    cVal.value = card[1];
    cVal.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E3A8A' } };
    cVal.alignment = { vertical: 'middle', horizontal: 'center' };

    ws1.mergeCells(`F${currentExcelRow}:G${currentExcelRow}`);
    const cNote = r.getCell(6);
    cNote.value = card[2];
    cNote.font = { name: 'Arial', size: 8.5, italic: true, color: { argb: 'FF475569' } };
    cNote.alignment = { vertical: 'middle', horizontal: 'left' };

    for (let c = 1; c <= 7; c++) {
      const cell = r.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: cIdx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }
    currentExcelRow++;
  });

  // Note informing user about the dedicated Section 2 Tab
  currentExcelRow++;
  ws1.mergeCells(`A${currentExcelRow}:G${currentExcelRow}`);
  const sec2NoteCell = ws1.getCell(`A${currentExcelRow}`);
  sec2NoteCell.value =
    '>> Consulta la pestaña "Sec 02 - Carga Colaboradores" para el desglose completo por persona, horas manuales y % de jornada. Las secciones 03 y 04 están excluidas conforme a tu solicitud.';
  sec2NoteCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF1E3A8A' } };
  sec2NoteCell.alignment = { vertical: 'middle', indent: 1 };
  ws1.getRow(currentExcelRow).height = 26;

  // -------------------------------------------------------------
  // HOJA 2: SECCIÓN 02 - CARGA LABORAL POR COLABORADOR (DETALLE)
  // -------------------------------------------------------------
  const ws2 = workbook.addWorksheet('Sec 02 - Carga Colaboradores', {
    views: [{ showGridLines: true }],
  });

  // Broad columns so names, job titles, and departments are never cut off
  ws2.columns = [
    { width: 38 }, // A: Responsable Funcional
    { width: 42 }, // B: Gerencia
    { width: 34 }, // C: Puesto
    { width: 28 }, // D: Carga Actual (Horas Manuales)
    { width: 22 }, // E: % de Jornada (152h)
    { width: 20 }, // F: Tareas Manuales
    { width: 20 }, // G: Tareas Auto.
    { width: 24 }, // H: Horas Manuales (h)
    { width: 24 }, // I: Horas Auto. (h)
    { width: 26 }, // J: Potencial Auto (h)
    { width: 22 }, // K: Actividades Únicas
  ];

  // Header Banner Sheet 2
  ws2.mergeCells('A1:K1');
  const ws2Title = ws2.getCell('A1');
  ws2Title.value =
    'SECCIÓN 02: CARGA LABORAL Y TAREAS POR RESPONSABLE FUNCIONAL (HORAS MANUALES)';
  ws2Title.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  ws2Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  ws2Title.alignment = { vertical: 'middle', horizontal: 'center' };
  ws2.getRow(1).height = 34;

  // Subtitle Sheet 2
  ws2.mergeCells('A2:K2');
  const ws2Sub = ws2.getCell('A2');
  ws2Sub.value = `Carga mensual basada en horas manuales como tiempo operativo humano · Jornada laboral base: 152 h/mes · Total colaboradores: ${totalColabs}`;
  ws2Sub.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF334155' } };
  ws2Sub.alignment = { vertical: 'middle', horizontal: 'center' };
  ws2.getRow(2).height = 22;

  // Table Columns Sheet 2
  const colabHeaders = [
    'Responsable Funcional',
    'Gerencia',
    'Puesto',
    'Carga Actual (Horas Manuales)',
    '% Jornada (152h)',
    'Tareas Manuales',
    'Tareas Auto.',
    'Horas Manuales (h)',
    'Horas Auto. (h)',
    'Potencial Auto (h)',
    'Actividades Únicas',
  ];

  const rColabHead = ws2.getRow(3);
  rColabHead.height = 26;
  colabHeaders.forEach((th, idx) => {
    const cell = rColabHead.getCell(idx + 1);
    cell.value = th;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { vertical: 'middle', horizontal: idx < 3 ? 'left' : 'right' };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF334155' } } };
  });

  let colabRowIdx = 4;
  let sumManHours = 0;
  let sumAutoHours = 0;
  let sumPotHours = 0;
  let sumManTasks = 0;
  let sumAutoTasks = 0;

  scopedColabs.forEach((c) => {
    sumManHours += c.horasManuales;
    sumAutoHours += c.horasAutomatizadas;
    sumPotHours += c.horasPotencialAutomatizable;
    sumManTasks += c.tareasManuales;
    sumAutoTasks += c.tareasAutomatizadas;

    const r = ws2.getRow(colabRowIdx);
    r.height = 21;

    r.getCell(1).value = c.colaborador;
    r.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

    r.getCell(2).value = c.gerencia;
    r.getCell(2).font = { name: 'Arial', size: 9 };
    r.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

    r.getCell(3).value = c.puesto;
    r.getCell(3).font = { name: 'Arial', size: 9 };
    r.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };

    // Carga Actual (Horas Manuales)
    r.getCell(4).value = c.horasManuales;
    r.getCell(4).numFmt = '#,##0.0';
    r.getCell(4).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } }; // Amber 700
    r.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

    // % Jornada (152h)
    r.getCell(5).value = `${c.porcentajeJornada}%`;
    r.getCell(5).font = { name: 'Arial', size: 9, bold: true };
    r.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

    // Tareas Manuales
    r.getCell(6).value = c.tareasManuales;
    r.getCell(6).numFmt = '#,##0';
    r.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

    // Tareas Auto
    r.getCell(7).value = c.tareasAutomatizadas;
    r.getCell(7).numFmt = '#,##0';
    r.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

    // Horas Manuales
    r.getCell(8).value = c.horasManuales;
    r.getCell(8).numFmt = '#,##0.0';
    r.getCell(8).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } };
    r.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };

    // Horas Auto
    r.getCell(9).value = c.horasAutomatizadas;
    r.getCell(9).numFmt = '#,##0.0';
    r.getCell(9).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E3A8A' } };
    r.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };

    // Potencial Auto
    r.getCell(10).value = c.horasPotencialAutomatizable;
    r.getCell(10).numFmt = '#,##0.0';
    r.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };

    // Actividades Únicas
    r.getCell(11).value = c.totalActividades;
    r.getCell(11).numFmt = '#,##0';
    r.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };

    for (let col = 1; col <= 11; col++) {
      const cell = r.getCell(col);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colabRowIdx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }

    colabRowIdx++;
  });

  // Total Row Sheet 2
  const rColabTotal = ws2.getRow(colabRowIdx);
  rColabTotal.height = 25;
  rColabTotal.getCell(1).value = 'TOTAL CONSOLIDADO (COLABORADORES)';
  rColabTotal.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  rColabTotal.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  rColabTotal.getCell(2).value = `${totalColabs} personas`;
  rColabTotal.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  rColabTotal.getCell(4).value = Number(sumManHours.toFixed(1));
  rColabTotal.getCell(4).numFmt = '#,##0.0';
  rColabTotal.getCell(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rColabTotal.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

  rColabTotal.getCell(5).value = `${formatThousands((sumManHours / Math.max(1, totalColabs * 152)) * 100, 1)}% prom`;
  rColabTotal.getCell(5).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rColabTotal.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

  rColabTotal.getCell(6).value = sumManTasks;
  rColabTotal.getCell(6).numFmt = '#,##0';
  rColabTotal.getCell(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rColabTotal.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

  rColabTotal.getCell(7).value = sumAutoTasks;
  rColabTotal.getCell(7).numFmt = '#,##0';
  rColabTotal.getCell(7).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rColabTotal.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

  rColabTotal.getCell(8).value = Number(sumManHours.toFixed(1));
  rColabTotal.getCell(8).numFmt = '#,##0.0';
  rColabTotal.getCell(8).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rColabTotal.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };

  rColabTotal.getCell(9).value = Number(sumAutoHours.toFixed(1));
  rColabTotal.getCell(9).numFmt = '#,##0.0';
  rColabTotal.getCell(9).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rColabTotal.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };

  rColabTotal.getCell(10).value = Number(sumPotHours.toFixed(1));
  rColabTotal.getCell(10).numFmt = '#,##0.0';
  rColabTotal.getCell(10).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rColabTotal.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };

  for (let c = 1; c <= 11; c++) {
    const cell = rColabTotal.getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF475569' } },
      bottom: { style: 'medium', color: { argb: 'FF475569' } },
    };
  }

  // -------------------------------------------------------------
  // HOJA 3: SECCIÓN 01 - DESGLOSE DE PROCESOS MACRO POR GERENCIA
  // -------------------------------------------------------------
  const ws3 = workbook.addWorksheet('Sec 01 - Procesos Macro', {
    views: [{ showGridLines: true }],
  });

  // Generous column widths for Macro Processes
  ws3.columns = [
    { width: 42 }, // Gerencia
    { width: 46 }, // Proceso Macro
    { width: 24 }, // Actividades Únicas
    { width: 22 }, // Colaboradores
    { width: 26 }, // Horas Totales
    { width: 26 }, // Horas Manuales
    { width: 26 }, // Horas Auto
  ];

  ws3.mergeCells('A1:G1');
  const ws3Title = ws3.getCell('A1');
  ws3Title.value = 'SECCIÓN 01: DESGLOSE DETALLADO DE PROCESOS MACRO POR GERENCIA';
  ws3Title.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  ws3Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  ws3Title.alignment = { vertical: 'middle', horizontal: 'center' };
  ws3.getRow(1).height = 32;

  const macroHeaders = [
    'Gerencia',
    'Proceso Macro',
    'Actividades Únicas',
    'Colaboradores',
    'Horas Totales (h)',
    'Horas Manuales (h)',
    'Horas Auto (h)',
  ];
  const rMacroHead = ws3.getRow(2);
  rMacroHead.height = 24;
  macroHeaders.forEach((th, idx) => {
    const cell = rMacroHead.getCell(idx + 1);
    cell.value = th;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { vertical: 'middle', horizontal: idx < 2 ? 'left' : 'right' };
  });

  let macroRowIndex = 3;
  summaries.forEach((s) => {
    (s.macroProcessesList || []).forEach((m) => {
      const r = ws3.getRow(macroRowIndex);
      r.height = 21;
      r.getCell(1).value = s.gerencia;
      r.getCell(2).value = m.nombre;
      r.getCell(3).value = m.totalActividades;
      r.getCell(4).value = m.colaboradoresCount;
      r.getCell(5).value = m.horasTotales;
      r.getCell(6).value = m.horasManuales;
      r.getCell(7).value = m.horasAutomatizadas;

      r.getCell(3).numFmt = '#,##0';
      r.getCell(4).numFmt = '#,##0';
      r.getCell(5).numFmt = '#,##0.0';
      r.getCell(6).numFmt = '#,##0.0';
      r.getCell(7).numFmt = '#,##0.0';

      for (let c = 1; c <= 7; c++) {
        const cell = r.getCell(c);
        cell.font = { name: 'Arial', size: 9 };
        cell.alignment = { vertical: 'middle', horizontal: c <= 2 ? 'left' : 'right' };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: macroRowIndex % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }
      macroRowIndex++;
    });
  });

  // -------------------------------------------------------------
  // WRITE AND DOWNLOAD WORKBOOK (STRICTLY NO SECTIONS 03 OR 04)
  // -------------------------------------------------------------
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
