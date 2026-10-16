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
        .text-\\[9px\\] { font-size: 9px; }
        .text-\\[10px\\] { font-size: 10px; }
        .text-\\[11px\\] { font-size: 11px; }
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
        .font-bold { font-weight: 700; }
        .font-semibold { font-weight: 600; }
        .font-medium { font-weight: 500; }
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

          // Crisp white background
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
 * Generates and downloads the executive Excel workbook:
 *
 * Hoja 1: Sección 01 con tabla por gerencia y abajo la gráfica (sin cuadros resumen ni nada más)
 * Hoja 2: Zoom al Desglose de Procesos Macro de todas las gerencias (en el mismo orden de la Sección 1)
 * Hoja 3: Desglose de las Actividades de cada proceso macro de cada gerencia (nueva hoja de la Sección 01)
 * Hoja 4: Base de datos de la Sección 2 en el mismo orden de gerencias (CXP, CE/GDP, etc.) CON la columna Actividad / Proceso agregada para llegar al detalle por colaborador
 */
export async function exportExecutiveSummaryXlsx(
  kpi: TopKpiData,
  summaries: GerenciaSummaryItem[],
  colaboradores: ColaboradorSummaryItem[],
  selectedGerencia: string = 'ALL',
  fileName: string = 'Reporte_Sec1_y_Sec2.xlsx'
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

  // Filter scoped summaries and collaborators based on selection
  const scopedSummaries =
    selectedGerencia === 'ALL'
      ? summaries
      : summaries.filter((s) => s.gerencia === selectedGerencia);

  const scopedColaboradores =
    selectedGerencia === 'ALL'
      ? colaboradores
      : colaboradores.filter((c) => c.gerencia === selectedGerencia);

  // Map of total manual hours per collaborator for % Carga Colab calculations
  const colabManualHoursMap = new Map<string, number>();
  for (const c of scopedColaboradores) {
    colabManualHoursMap.set(c.colaborador.trim(), c.horasManuales);
  }

  const now = new Date();
  const dateFormatted = `${now.toLocaleDateString('es-MX')} ${now.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
  const scopeText =
    selectedGerencia === 'ALL'
      ? 'Consolidado Global (Todas las Gerencias)'
      : `Gerencia: ${selectedGerencia}`;

  // =========================================================================
  // HOJA 1: INDICADORES CLAVE (KPIS), SECCIÓN 01 Y GRÁFICA COMPARATIVA
  // =========================================================================
  const ws1 = workbook.addWorksheet('Sección 01 - Gerencias', {
    views: [{ showGridLines: true }],
  });

  ws1.columns = [
    { width: 44 }, // A: Gerencia
    { width: 22 }, // B: Procesos Macro
    { width: 24 }, // C: Actividades Únicas
    { width: 22 }, // D: Colaboradores
    { width: 22 }, // E: Horas Auto. (h)
    { width: 22 }, // F: Horas Manuales (h)
    { width: 24 }, // G: Horas Totales (h)
  ];

  // Header banner
  ws1.mergeCells('A1:G1');
  const title1 = ws1.getCell('A1');
  title1.value = 'REPORTE EJECUTIVO: INVENTARIO DE PROCESOS Y CARGA LABORAL';
  title1.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  title1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate 900
  title1.alignment = { vertical: 'middle', horizontal: 'center' };
  ws1.getRow(1).height = 34;

  // Subtitle
  ws1.mergeCells('A2:G2');
  const sub1 = ws1.getCell('A2');
  sub1.value = `Alcance: ${scopeText}  |  Fecha: ${dateFormatted}  |  Jornada Base: 152 h/mes`;
  sub1.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
  sub1.alignment = { vertical: 'middle', horizontal: 'center' };
  ws1.getRow(2).height = 20;

  // Empty row 3
  ws1.getRow(3).height = 8;

  // -------------------------------------------------------------
  // INDICADORES EJECUTIVOS (KPIS DE INICIO)
  // -------------------------------------------------------------
  ws1.mergeCells('A4:G4');
  const kpiBanner = ws1.getCell('A4');
  kpiBanner.value = 'INDICADORES EJECUTIVOS CLAVE (KPIS DE INICIO)';
  kpiBanner.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  kpiBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate 800
  kpiBanner.alignment = { vertical: 'middle', indent: 1 };
  ws1.getRow(4).height = 24;

  // Card Headers (Row 5)
  ws1.mergeCells('A5:B5');
  const c1Head = ws1.getCell('A5');
  c1Head.value = 'PROCESOS MACRO EVALUADOS';

  ws1.mergeCells('C5:D5');
  const c2Head = ws1.getCell('C5');
  c2Head.value = 'ACTIVIDADES / PROCESOS (ÚNICAS)';

  ws1.mergeCells('E5:F5');
  const c3Head = ws1.getCell('E5');
  c3Head.value = 'HORAS MENSUALES MANUALES';

  const c4Head = ws1.getCell('G5');
  c4Head.value = 'HORAS TOTALES VS. AUTO / MANUAL';

  [c1Head, c2Head, c3Head, c4Head].forEach((cell) => {
    cell.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FF334155' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  ws1.getRow(5).height = 20;

  // Card Values (Row 6)
  ws1.mergeCells('A6:B6');
  const c1Val = ws1.getCell('A6');
  c1Val.value = formatThousands(kpi.macroByGerenciaCount);
  c1Val.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1E3A8A' } }; // Blue 900
  c1Val.alignment = { vertical: 'middle', horizontal: 'center' };

  ws1.mergeCells('C6:D6');
  const c2Val = ws1.getCell('C6');
  c2Val.value = formatThousands(kpi.actividadesCount);
  c2Val.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF4338CA' } }; // Indigo 700
  c2Val.alignment = { vertical: 'middle', horizontal: 'center' };

  ws1.mergeCells('E6:F6');
  const c3Val = ws1.getCell('E6');
  c3Val.value = `${formatHours(kpi.horasManuales)} h`;
  c3Val.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFB45309' } }; // Amber 700
  c3Val.alignment = { vertical: 'middle', horizontal: 'center' };

  const c4Val = ws1.getCell('G6');
  c4Val.value = `Total: ${formatHours(kpi.horasTotales)} h`;
  c4Val.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF0F172A' } }; // Slate 900
  c4Val.alignment = { vertical: 'middle', horizontal: 'center' };
  ws1.getRow(6).height = 32;

  // Card Context / Subtitle (Row 7)
  const promMacroGte = (kpi.macroByGerenciaCount / Math.max(1, kpi.gerenciasCount)).toFixed(1);
  const fteManual = (kpi.horasManuales / 152).toFixed(1);
  const promManualColab = (kpi.horasManuales / Math.max(1, kpi.colaboradoresCount)).toFixed(1);

  ws1.mergeCells('A7:B7');
  const c1Sub = ws1.getCell('A7');
  c1Sub.value = `En ${kpi.gerenciasCount} gerencia(s) · Promedio: ${promMacroGte} por gerencia`;

  ws1.mergeCells('C7:D7');
  const c2Sub = ws1.getCell('C7');
  c2Sub.value = `${formatThousands(kpi.totalFilasCount)} registros totales · ${formatThousands(kpi.colaboradoresCount)} colaboradores`;

  ws1.mergeCells('E7:F7');
  const c3Sub = ws1.getCell('E7');
  c3Sub.value = `${fteManual} FTE manual (152 h/mes) · Prom: ${promManualColab} h/colab`;

  const c4Sub = ws1.getCell('G7');
  c4Sub.value = `Manual: ${formatHours(kpi.horasManuales)} h | Auto: ${formatHours(kpi.horasAutomatizadas)} h`;

  [c1Sub, c2Sub, c3Sub, c4Sub].forEach((cell) => {
    cell.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF64748B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  ws1.getRow(7).height = 20;

  // Borders for the KPI block (Rows 5 to 7)
  for (let r = 5; r <= 7; r++) {
    const row = ws1.getRow(r);
    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: r === 5 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
        bottom: r === 7 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
        left: c === 1 || c === 3 || c === 5 || c === 7 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
        right: c === 2 || c === 4 || c === 6 || c === 7 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
      };
    }
  }

  // Empty separator row 8
  ws1.getRow(8).height = 12;

  // -------------------------------------------------------------
  // SECCIÓN 01: TABLA DE RESUMEN GERENCIAL
  // -------------------------------------------------------------
  ws1.mergeCells('A9:G9');
  const sec1Title = ws1.getCell('A9');
  sec1Title.value = 'SECCIÓN 01: RESUMEN GERENCIAL - PROCESOS MACRO, ACTIVIDADES Y HORAS';
  sec1Title.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  sec1Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Blue 900
  sec1Title.alignment = { vertical: 'middle', indent: 1 };
  ws1.getRow(9).height = 24;

  // Table Column Headers (Row 10)
  const sec1Headers = [
    'Gerencia',
    'Procesos Macro',
    'Actividades Únicas',
    'Colaboradores',
    'Horas Auto.',
    'Horas Manuales',
    'Horas Totales',
  ];

  const rHead1 = ws1.getRow(10);
  rHead1.height = 26;
  sec1Headers.forEach((th, idx) => {
    const cell = rHead1.getCell(idx + 1);
    cell.value = th;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate 900
    cell.alignment = {
      vertical: 'middle',
      horizontal: idx === 0 ? 'left' : idx <= 3 ? 'center' : 'right',
    };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF334155' } } };
  });

  let row1Idx = 11;
  let totMacros = 0;
  let totActs = 0;
  let totColabs = 0;
  let totHorasAuto = 0;
  let totHorasManuales = 0;
  let totHorasTotales = 0;

  scopedSummaries.forEach((s, idx) => {
    totMacros += s.totalProcesosMacro;
    totActs += s.totalActividades;
    totColabs += s.totalColaboradores;
    totHorasAuto += s.horasAutomatizadas;
    totHorasManuales += s.horasManuales;
    totHorasTotales += s.horasTotales;

    const r = ws1.getRow(row1Idx);
    r.height = 22;

    r.getCell(1).value = s.gerencia;
    r.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

    r.getCell(2).value = s.totalProcesosMacro;
    r.getCell(2).numFmt = '#,##0';
    r.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };

    r.getCell(3).value = s.totalActividades;
    r.getCell(3).numFmt = '#,##0';
    r.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };

    r.getCell(4).value = s.totalColaboradores;
    r.getCell(4).numFmt = '#,##0';
    r.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

    r.getCell(5).value = s.horasAutomatizadas;
    r.getCell(5).numFmt = '#,##0.0';
    r.getCell(5).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E3A8A' } };
    r.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(6).value = s.horasManuales;
    r.getCell(6).numFmt = '#,##0.0';
    r.getCell(6).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } };
    r.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

    r.getCell(7).value = s.horasTotales;
    r.getCell(7).numFmt = '#,##0.0';
    r.getCell(7).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
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
    row1Idx++;
  });

  // Total Consolidado Row for Section 1
  const rTotal1 = ws1.getRow(row1Idx);
  rTotal1.height = 25;
  rTotal1.getCell(1).value = 'TOTAL CONSOLIDADO (SECCIÓN 01)';
  rTotal1.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal1.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  rTotal1.getCell(2).value = totMacros;
  rTotal1.getCell(2).numFmt = '#,##0';
  rTotal1.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal1.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };

  rTotal1.getCell(3).value = totActs;
  rTotal1.getCell(3).numFmt = '#,##0';
  rTotal1.getCell(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal1.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };

  rTotal1.getCell(4).value = totColabs;
  rTotal1.getCell(4).numFmt = '#,##0';
  rTotal1.getCell(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal1.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

  rTotal1.getCell(5).value = Number(totHorasAuto.toFixed(1));
  rTotal1.getCell(5).numFmt = '#,##0.0';
  rTotal1.getCell(5).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal1.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal1.getCell(6).value = Number(totHorasManuales.toFixed(1));
  rTotal1.getCell(6).numFmt = '#,##0.0';
  rTotal1.getCell(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal1.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal1.getCell(7).value = Number(totHorasTotales.toFixed(1));
  rTotal1.getCell(7).numFmt = '#,##0.0';
  rTotal1.getCell(7).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal1.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

  for (let c = 1; c <= 7; c++) {
    const cell = rTotal1.getCell(c);
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
  row1Idx++;

  // -------------------------------------------------------------
  // ABAJO DE LA TABLA: LA GRÁFICA COMPARATIVA (SIN NADA MÁS)
  // -------------------------------------------------------------
  row1Idx++; // Empty row
  ws1.getRow(row1Idx).height = 16;
  row1Idx++;

  ws1.mergeCells(`A${row1Idx}:G${row1Idx}`);
  const chartTitleCell = ws1.getCell(`A${row1Idx}`);
  chartTitleCell.value =
    'GRÁFICA COMPARATIVA: HORAS MANUALES VS. AUTOMATIZADAS Y VOLUMEN DE ACTIVIDADES';
  chartTitleCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  chartTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Blue 900
  chartTitleCell.alignment = { vertical: 'middle', indent: 1 };
  ws1.getRow(row1Idx).height = 24;
  row1Idx++;

  // Insert captured chart image if present
  if (chartBase64) {
    try {
      const imageId = workbook.addImage({
        base64: chartBase64,
        extension: 'png',
      });

      const startChartRow = row1Idx;
      const chartRowsCount = 24;
      for (let r = 0; r < chartRowsCount; r++) {
        ws1.getRow(startChartRow + r).height = 20;
      }

      ws1.addImage(imageId, {
        tl: { col: 0.1, row: startChartRow - 0.8 },
        ext: { width: 1020, height: 460 },
        editAs: 'oneCell',
      });

      row1Idx += chartRowsCount + 1;
    } catch (e) {
      console.warn('Error inserting image in Excel:', e);
    }
  } else {
    ws1.mergeCells(`A${row1Idx}:G${row1Idx}`);
    const noImgCell = ws1.getCell(`A${row1Idx}`);
    noImgCell.value =
      'Gráfica interactiva disponible en la vista web del tablero (horas manuales, auto y volumen de actividades).';
    noImgCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
    noImgCell.alignment = { vertical: 'middle', indent: 1 };
    ws1.getRow(row1Idx).height = 24;
  }

  // =========================================================================
  // HOJA 2: ZOOM AL DESGLOSE DE PROCESOS MACRO DE TODAS LAS GERENCIAS
  // (Mismo orden de la Sección 1, sin nada más)
  // =========================================================================
  const ws2 = workbook.addWorksheet('Sec 01 - Procesos Macro', {
    views: [{ showGridLines: true }],
  });

  ws2.columns = [
    { width: 38 }, // A: Gerencia
    { width: 44 }, // B: Proceso Macro
    { width: 22 }, // C: Actividades Únicas
    { width: 22 }, // D: Actividades Totales
    { width: 20 }, // E: Colaboradores
    { width: 22 }, // F: Horas Auto. (h)
    { width: 22 }, // G: Horas Manuales (h)
    { width: 22 }, // H: Horas Totales (h)
  ];

  // Header Banner Sheet 2
  ws2.mergeCells('A1:H1');
  const title2 = ws2.getCell('A1');
  title2.value = 'SECCIÓN 01: ZOOM AL DESGLOSE DE PROCESOS MACRO POR GERENCIA';
  title2.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  title2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  title2.alignment = { vertical: 'middle', horizontal: 'center' };
  ws2.getRow(1).height = 34;

  // Subtitle Sheet 2
  ws2.mergeCells('A2:H2');
  const sub2 = ws2.getCell('A2');
  sub2.value = `Desglose de procesos macro de todas las gerencias en el mismo orden de la Sección 01  |  Alcance: ${scopeText}  |  Fecha: ${dateFormatted}`;
  sub2.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
  sub2.alignment = { vertical: 'middle', horizontal: 'center' };
  ws2.getRow(2).height = 20;

  // Table Column Headers Sheet 2
  const macroHeaders = [
    'Gerencia',
    'Proceso Macro',
    'Actividades Únicas',
    'Actividades Totales',
    'Colaboradores',
    'Horas Auto.',
    'Horas Manuales',
    'Horas Totales',
  ];

  const rHead2 = ws2.getRow(3);
  rHead2.height = 26;
  macroHeaders.forEach((th, idx) => {
    const cell = rHead2.getCell(idx + 1);
    cell.value = th;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: idx < 2 ? 'left' : idx <= 4 ? 'center' : 'right',
    };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF334155' } } };
  });

  let row2Idx = 4;
  let totMacroActs = 0;
  let totMacroActsTotales = 0;
  let totMacroColabs = 0;
  let totMacroHorasAuto = 0;
  let totMacroHorasManual = 0;
  let totMacroHorasTotal = 0;

  // Iterate across summaries in the EXACT same order of Section 1
  scopedSummaries.forEach((s) => {
    (s.macroProcessesList || []).forEach((m) => {
      const actsUnicas = m.totalActividades;
      const actsTotales = m.totalFilas != null ? m.totalFilas : (m.actividades?.length || 0);

      totMacroActs += actsUnicas;
      totMacroActsTotales += actsTotales;
      totMacroColabs += m.colaboradoresCount;
      totMacroHorasAuto += m.horasAutomatizadas;
      totMacroHorasManual += m.horasManuales;
      totMacroHorasTotal += m.horasTotales;

      const r = ws2.getRow(row2Idx);
      r.height = 21;

      r.getCell(1).value = s.gerencia;
      r.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
      r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

      r.getCell(2).value = m.nombre;
      r.getCell(2).font = { name: 'Arial', size: 9, color: { argb: 'FF1E293B' } };
      r.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

      r.getCell(3).value = actsUnicas;
      r.getCell(3).numFmt = '#,##0';
      r.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };

      r.getCell(4).value = actsTotales;
      r.getCell(4).numFmt = '#,##0';
      r.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

      r.getCell(5).value = m.colaboradoresCount;
      r.getCell(5).numFmt = '#,##0';
      r.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };

      r.getCell(6).value = m.horasAutomatizadas;
      r.getCell(6).numFmt = '#,##0.0';
      r.getCell(6).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E3A8A' } };
      r.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

      r.getCell(7).value = m.horasManuales;
      r.getCell(7).numFmt = '#,##0.0';
      r.getCell(7).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } };
      r.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

      r.getCell(8).value = m.horasTotales;
      r.getCell(8).numFmt = '#,##0.0';
      r.getCell(8).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
      r.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };

      for (let c = 1; c <= 8; c++) {
        const cell = r.getCell(c);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: row2Idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }

      row2Idx++;
    });
  });

  // Total Consolidado Row Sheet 2
  const rTotal2 = ws2.getRow(row2Idx);
  rTotal2.height = 25;
  rTotal2.getCell(1).value = 'TOTAL CONSOLIDADO (PROCESOS MACRO)';
  rTotal2.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal2.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  rTotal2.getCell(2).value = `${scopedSummaries.reduce((acc, s) => acc + (s.macroProcessesList?.length || 0), 0)} procesos`;
  rTotal2.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  rTotal2.getCell(3).value = totMacroActs;
  rTotal2.getCell(3).numFmt = '#,##0';
  rTotal2.getCell(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal2.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };

  rTotal2.getCell(4).value = totMacroActsTotales;
  rTotal2.getCell(4).numFmt = '#,##0';
  rTotal2.getCell(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal2.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

  rTotal2.getCell(5).value = totMacroColabs;
  rTotal2.getCell(5).numFmt = '#,##0';
  rTotal2.getCell(5).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal2.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };

  rTotal2.getCell(6).value = Number(totMacroHorasAuto.toFixed(1));
  rTotal2.getCell(6).numFmt = '#,##0.0';
  rTotal2.getCell(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal2.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal2.getCell(7).value = Number(totMacroHorasManual.toFixed(1));
  rTotal2.getCell(7).numFmt = '#,##0.0';
  rTotal2.getCell(7).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal2.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal2.getCell(8).value = Number(totMacroHorasTotal.toFixed(1));
  rTotal2.getCell(8).numFmt = '#,##0.0';
  rTotal2.getCell(8).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal2.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };

  for (let c = 1; c <= 8; c++) {
    const cell = rTotal2.getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF475569' } },
    };
  }

  // =========================================================================
  // HOJA 3: SECCIÓN 01 - DESGLOSE DE ACTIVIDADES DE CADA PROCESO MACRO
  // (La hoja adicional de la Sección 01 solicitada por el usuario)
  // =========================================================================
  const ws3 = workbook.addWorksheet('Sec 01 - Actividades Macro', {
    views: [{ showGridLines: true }],
  });

  ws3.columns = [
    { width: 36 }, // A: Gerencia
    { width: 38 }, // B: Proceso Macro
    { width: 48 }, // C: Actividad / Proceso
    { width: 30 }, // D: Área / Sub Área
    { width: 36 }, // E: Responsable Funcional
    { width: 26 }, // F: Puesto
    { width: 18 }, // G: Frecuencia
    { width: 15 }, // H: ¿Auto.?
    { width: 22 }, // I: Herramienta
    { width: 20 }, // J: Horas Auto. (h)
    { width: 20 }, // K: Horas Manuales (h)
    { width: 20 }, // L: Horas Totales (h)
    { width: 22 }, // M: % Carga Colab. (Manual)
  ];

  // Header Banner Sheet 3
  ws3.mergeCells('A1:M1');
  const title3 = ws3.getCell('A1');
  title3.value = 'SECCIÓN 01: DESGLOSE DE ACTIVIDADES POR PROCESO MACRO Y GERENCIA';
  title3.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  title3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  title3.alignment = { vertical: 'middle', horizontal: 'center' };
  ws3.getRow(1).height = 34;

  // Subtitle Sheet 3
  ws3.mergeCells('A2:M2');
  const sub3 = ws3.getCell('A2');
  sub3.value = `Desglose detallado de actividades por cada proceso macro de cada gerencia en el mismo orden de la Sección 01  |  Alcance: ${scopeText}  |  Fecha: ${dateFormatted}`;
  sub3.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
  sub3.alignment = { vertical: 'middle', horizontal: 'center' };
  ws3.getRow(2).height = 20;

  // Table Column Headers Sheet 3
  const sec1ActHeaders = [
    'Gerencia',
    'Proceso Macro',
    'Actividad / Proceso',
    'Área / Sub Área',
    'Responsable Funcional',
    'Puesto',
    'Frecuencia',
    '¿Auto.?',
    'Herramienta',
    'Horas Auto.',
    'Horas Manuales',
    'Horas Totales',
    '% Carga Colab.',
  ];

  const rHead3 = ws3.getRow(3);
  rHead3.height = 26;
  sec1ActHeaders.forEach((th, idx) => {
    const cell = rHead3.getCell(idx + 1);
    cell.value = th;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: idx < 6 ? 'left' : idx <= 7 ? 'center' : idx === 8 ? 'left' : 'right',
    };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF334155' } } };
  });

  let row3Idx = 4;
  let totSec1ActCount = 0;
  let totSec1ActAutoHours = 0;
  let totSec1ActManHours = 0;
  let totSec1ActTotHours = 0;

  // Loop through scopedSummaries (exact Section 1 order: CXP, CE/GDP, etc.)
  scopedSummaries.forEach((s) => {
    (s.macroProcessesList || []).forEach((m) => {
      (m.actividades || []).forEach((act) => {
        totSec1ActCount++;
        const actMan = Number(
          act.horasManualesTotal != null ? act.horasManualesTotal : (act.horasManuales || 0)
        );
        const actAuto = Number(act.horasMensualesAutomatizadas || 0);
        const actTot = Number(
          act.horasMensualesTotal != null ? act.horasMensualesTotal : (act.horasMensualesActividad || 0)
        );

        totSec1ActManHours += actMan;
        totSec1ActAutoHours += actAuto;
        totSec1ActTotHours += actTot;

        const colabTotalMan = colabManualHoursMap.get((act.responsableFuncional || '').trim()) || 0;
        const pctColabMan =
          colabTotalMan > 0 ? Number(((actMan / colabTotalMan) * 100).toFixed(1)) : 0;

        const r = ws3.getRow(row3Idx);
        r.height = 21;

        // Gerencia
        r.getCell(1).value = s.gerencia;
        r.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
        r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

        // Proceso Macro
        r.getCell(2).value = m.nombre;
        r.getCell(2).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E3A8A' } };
        r.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

        // Actividad / Proceso
        r.getCell(3).value = act.actividadProceso;
        r.getCell(3).font = { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } };
        r.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };

        // Área / Sub Área
        r.getCell(4).value = act.areaSubArea || s.gerencia;
        r.getCell(4).font = { name: 'Arial', size: 9, color: { argb: 'FF475569' } };
        r.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };

        // Responsable Funcional
        r.getCell(5).value = act.responsableFuncional;
        r.getCell(5).font = { name: 'Arial', size: 9, color: { argb: 'FF1E293B' } };
        r.getCell(5).alignment = { vertical: 'middle', horizontal: 'left' };

        // Puesto
        r.getCell(6).value = act.puesto || 'Especialista';
        r.getCell(6).font = { name: 'Arial', size: 9, color: { argb: 'FF475569' } };
        r.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };

        // Frecuencia
        r.getCell(7).value = act.frecuencia || 'Mensual';
        r.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };

        // ¿Auto.?
        r.getCell(8).value = act.esAutomatizable || 'No';
        r.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

        // Herramienta
        r.getCell(9).value = act.herramienta || 'N/A';
        r.getCell(9).alignment = { vertical: 'middle', horizontal: 'left' };

        // Horas Auto.
        r.getCell(10).value = actAuto;
        r.getCell(10).numFmt = '#,##0.0';
        r.getCell(10).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E3A8A' } };
        r.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };

        // Horas Manuales
        r.getCell(11).value = actMan;
        r.getCell(11).numFmt = '#,##0.0';
        r.getCell(11).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } };
        r.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };

        // Horas Totales
        r.getCell(12).value = actTot;
        r.getCell(12).numFmt = '#,##0.0';
        r.getCell(12).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
        r.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };

        // % Carga Colaborador
        r.getCell(13).value = `${pctColabMan}%`;
        r.getCell(13).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } };
        r.getCell(13).alignment = { vertical: 'middle', horizontal: 'right' };

        for (let col = 1; col <= 13; col++) {
          const cell = r.getCell(col);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: row3Idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
          };
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
        }

        row3Idx++;
      });
    });
  });

  // Total Consolidado Row Sheet 3
  const rTotal3 = ws3.getRow(row3Idx);
  rTotal3.height = 25;
  rTotal3.getCell(1).value = 'TOTAL CONSOLIDADO (ACTIVIDADES SECCIÓN 01)';
  rTotal3.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal3.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  rTotal3.getCell(3).value = `${totSec1ActCount} actividades`;
  rTotal3.getCell(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  rTotal3.getCell(10).value = Number(totSec1ActAutoHours.toFixed(1));
  rTotal3.getCell(10).numFmt = '#,##0.0';
  rTotal3.getCell(10).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal3.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal3.getCell(11).value = Number(totSec1ActManHours.toFixed(1));
  rTotal3.getCell(11).numFmt = '#,##0.0';
  rTotal3.getCell(11).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal3.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal3.getCell(12).value = Number(totSec1ActTotHours.toFixed(1));
  rTotal3.getCell(12).numFmt = '#,##0.0';
  rTotal3.getCell(12).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal3.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };

  for (let c = 1; c <= 13; c++) {
    const cell = rTotal3.getCell(c);
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

  // =========================================================================
  // HOJA 4: SECCIÓN 02 - BASE DE DATOS POR COLABORADOR CON COLUMNA ACTIVIDAD/PROCESO
  // (La hoja sección 03 la nueva, con la columna actividad/proceso para llegar al detalle por colaborador)
  // =========================================================================
  const ws4 = workbook.addWorksheet('Sec 02 - Base de Datos', {
    views: [{ showGridLines: true }],
  });

  ws4.columns = [
    { width: 36 }, // A: Gerencia
    { width: 38 }, // B: Responsable Funcional
    { width: 28 }, // C: Puesto
    { width: 48 }, // D: Actividad / Proceso (La columna agregada para el detalle por colaborador)
    { width: 38 }, // E: Proceso Macro
    { width: 30 }, // F: Área / Sub Área
    { width: 18 }, // G: Frecuencia
    { width: 15 }, // H: ¿Auto.?
    { width: 22 }, // I: Herramienta
    { width: 20 }, // J: Horas Manuales (h)
    { width: 20 }, // K: Horas Auto. (h)
    { width: 20 }, // L: Horas Totales (h)
    { width: 22 }, // M: % Carga Colab. (Manual)
    { width: 24 }, // N: Carga Total Colab. (h)
    { width: 22 }, // O: % Jornada Colab. (152h)
  ];

  // Header Banner Sheet 4
  ws4.mergeCells('A1:O1');
  const title4 = ws4.getCell('A1');
  title4.value = 'SECCIÓN 02: BASE DE DATOS DE CARGA LABORAL Y ACTIVIDADES POR COLABORADOR';
  title4.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  title4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  title4.alignment = { vertical: 'middle', horizontal: 'center' };
  ws4.getRow(1).height = 34;

  // Subtitle Sheet 4
  ws4.mergeCells('A2:O2');
  const sub4 = ws4.getCell('A2');
  sub4.value = `Detalle por colaborador con columna Actividad/Proceso en la misma secuencia de gerencias de la Sección 01 (CXP, CE/GDP, etc.)  |  Jornada base: 152 h/mes  |  Fecha: ${dateFormatted}`;
  sub4.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
  sub4.alignment = { vertical: 'middle', horizontal: 'center' };
  ws4.getRow(2).height = 20;

  // Table Column Headers Sheet 4
  const sec2DetailHeaders = [
    'Gerencia',
    'Responsable Funcional',
    'Puesto',
    'Actividad / Proceso',
    'Proceso Macro',
    'Área / Sub Área',
    'Frecuencia',
    '¿Auto.?',
    'Herramienta',
    'Horas Manuales',
    'Horas Auto.',
    'Horas Totales',
    '% Carga Colab.',
    'Carga Total Colab.',
    '% Jornada (152h)',
  ];

  const rHead4 = ws4.getRow(3);
  rHead4.height = 26;
  sec2DetailHeaders.forEach((th, idx) => {
    const cell = rHead4.getCell(idx + 1);
    cell.value = th;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: idx < 6 ? 'left' : idx <= 7 ? 'center' : idx === 8 ? 'left' : 'right',
    };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF334155' } } };
  });

  // Organize collaborators strictly by the order of Gerencias in Section 1 (scopedSummaries: CXP, CE/GDP, etc.)
  const orderedColaboradores: ColaboradorSummaryItem[] = [];
  const processedKeys = new Set<string>();

  scopedSummaries.forEach((s) => {
    // Filter collaborators in this specific gerencia
    const gerenciaColabs = scopedColaboradores.filter(
      (c) => c.gerencia.trim().toUpperCase() === s.gerencia.trim().toUpperCase()
    );
    // Sort collaborators within this gerencia by manual hours descending
    gerenciaColabs.sort((a, b) => b.horasManuales - a.horasManuales);

    gerenciaColabs.forEach((c) => {
      const key = `${c.gerencia}:::${c.colaborador}`;
      if (!processedKeys.has(key)) {
        processedKeys.add(key);
        orderedColaboradores.push(c);
      }
    });
  });

  // Append any remaining collaborators not matched to a known gerencia
  scopedColaboradores.forEach((c) => {
    const key = `${c.gerencia}:::${c.colaborador}`;
    if (!processedKeys.has(key)) {
      processedKeys.add(key);
      orderedColaboradores.push(c);
    }
  });

  let row4Idx = 4;
  let totSec2Acts = 0;
  let totSec2ManHours = 0;
  let totSec2AutoHours = 0;
  let totSec2TotalHours = 0;

  orderedColaboradores.forEach((c) => {
    const activities = c.actividades && c.actividades.length > 0
      ? c.actividades
      : [
          {
            actividadProceso: 'Actividad General',
            procesoMacro: 'Operaciones',
            areaSubArea: c.gerencia,
            frecuencia: 'Mensual',
            esAutomatizable: 'No',
            herramienta: 'N/A',
            horasManualesTotal: c.horasManuales,
            horasMensualesAutomatizadas: c.horasAutomatizadas,
            horasMensualesTotal: c.horasTotales,
          } as any,
        ];

    activities.forEach((act) => {
      totSec2Acts++;
      const actMan = Number(
        act.horasManualesTotal != null ? act.horasManualesTotal : (act.horasManuales || 0)
      );
      const actAuto = Number(act.horasMensualesAutomatizadas || 0);
      const actTot = Number(
        act.horasMensualesTotal != null ? act.horasMensualesTotal : (act.horasMensualesActividad || 0)
      );

      totSec2ManHours += actMan;
      totSec2AutoHours += actAuto;
      totSec2TotalHours += actTot;

      const pctActOfColab =
        c.horasManuales > 0 ? Number(((actMan / c.horasManuales) * 100).toFixed(1)) : 0;

      const r = ws4.getRow(row4Idx);
      r.height = 21;

      // Gerencia
      r.getCell(1).value = c.gerencia;
      r.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
      r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

      // Responsable Funcional
      r.getCell(2).value = c.colaborador;
      r.getCell(2).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
      r.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

      // Puesto
      r.getCell(3).value = c.puesto;
      r.getCell(3).font = { name: 'Arial', size: 9, color: { argb: 'FF475569' } };
      r.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };

      // Actividad / Proceso (La columna agregada para llegar al detalle por colaborador)
      r.getCell(4).value = act.actividadProceso;
      r.getCell(4).font = { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } };
      r.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };

      // Proceso Macro
      r.getCell(5).value = act.procesoMacro || 'General';
      r.getCell(5).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E3A8A' } };
      r.getCell(5).alignment = { vertical: 'middle', horizontal: 'left' };

      // Área / Sub Área
      r.getCell(6).value = act.areaSubArea || c.gerencia;
      r.getCell(6).font = { name: 'Arial', size: 9, color: { argb: 'FF475569' } };
      r.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };

      // Frecuencia
      r.getCell(7).value = act.frecuencia || 'Mensual';
      r.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };

      // ¿Auto.?
      r.getCell(8).value = act.esAutomatizable || 'No';
      r.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };

      // Herramienta
      r.getCell(9).value = act.herramienta || 'N/A';
      r.getCell(9).alignment = { vertical: 'middle', horizontal: 'left' };

      // Horas Manuales (h)
      r.getCell(10).value = actMan;
      r.getCell(10).numFmt = '#,##0.0';
      r.getCell(10).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } };
      r.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };

      // Horas Auto. (h)
      r.getCell(11).value = actAuto;
      r.getCell(11).numFmt = '#,##0.0';
      r.getCell(11).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E3A8A' } };
      r.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };

      // Horas Totales (h)
      r.getCell(12).value = actTot;
      r.getCell(12).numFmt = '#,##0.0';
      r.getCell(12).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
      r.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };

      // % Carga Colaborador (Manual)
      r.getCell(13).value = `${pctActOfColab}%`;
      r.getCell(13).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } };
      r.getCell(13).alignment = { vertical: 'middle', horizontal: 'right' };

      // Carga Total Colaborador (h)
      r.getCell(14).value = c.horasManuales;
      r.getCell(14).numFmt = '#,##0.0';
      r.getCell(14).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFB45309' } };
      r.getCell(14).alignment = { vertical: 'middle', horizontal: 'right' };

      // % Jornada Colaborador (152h)
      r.getCell(15).value = `${c.porcentajeJornada}%`;
      r.getCell(15).font = { name: 'Arial', size: 9, bold: true };
      r.getCell(15).alignment = { vertical: 'middle', horizontal: 'right' };

      for (let col = 1; col <= 15; col++) {
        const cell = r.getCell(col);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: row4Idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }

      row4Idx++;
    });
  });

  // Total Consolidado Row Sheet 4
  const rTotal4 = ws4.getRow(row4Idx);
  rTotal4.height = 25;
  rTotal4.getCell(1).value = 'TOTAL CONSOLIDADO (DETALLE COLABORADORES)';
  rTotal4.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal4.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

  rTotal4.getCell(2).value = `${orderedColaboradores.length} colaboradores`;
  rTotal4.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  rTotal4.getCell(4).value = `${totSec2Acts} actividades`;
  rTotal4.getCell(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  rTotal4.getCell(10).value = Number(totSec2ManHours.toFixed(1));
  rTotal4.getCell(10).numFmt = '#,##0.0';
  rTotal4.getCell(10).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal4.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal4.getCell(11).value = Number(totSec2AutoHours.toFixed(1));
  rTotal4.getCell(11).numFmt = '#,##0.0';
  rTotal4.getCell(11).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal4.getCell(11).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal4.getCell(12).value = Number(totSec2TotalHours.toFixed(1));
  rTotal4.getCell(12).numFmt = '#,##0.0';
  rTotal4.getCell(12).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal4.getCell(12).alignment = { vertical: 'middle', horizontal: 'right' };

  const totalColabManualSum = orderedColaboradores.reduce((acc, c) => acc + c.horasManuales, 0);
  rTotal4.getCell(14).value = Number(totalColabManualSum.toFixed(1));
  rTotal4.getCell(14).numFmt = '#,##0.0';
  rTotal4.getCell(14).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal4.getCell(14).alignment = { vertical: 'middle', horizontal: 'right' };

  rTotal4.getCell(15).value = `${formatThousands(
    (totalColabManualSum / Math.max(1, orderedColaboradores.length * 152)) * 100,
    1
  )}% prom`;
  rTotal4.getCell(15).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  rTotal4.getCell(15).alignment = { vertical: 'middle', horizontal: 'right' };

  for (let c = 1; c <= 15; c++) {
    const cell = rTotal4.getCell(c);
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
  // WRITE AND DOWNLOAD WORKBOOK
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
