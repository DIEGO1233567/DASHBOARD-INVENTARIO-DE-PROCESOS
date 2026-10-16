import React, { useState, useMemo, useRef } from 'react';
import {
  BarChart3,
  Layers,
  Columns3,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  Clock,
  Zap,
  ListTodo,
  Info,
} from 'lucide-react';
import { GerenciaSummaryItem } from '../types/sheets';
import { formatThousands, formatHours } from '../utils/sheetsParser';

interface GerenciasChartSectionProps {
  summaries: GerenciaSummaryItem[];
  selectedGerencia: string;
  onSelectGerencia: (gerencia: string) => void;
}

type SortOption = 'totalHoras' | 'horasManuales' | 'actividades' | 'pctAuto' | 'nombre';
type ViewMode = 'stacked' | 'grouped';

export const GerenciasChartSection: React.FC<GerenciasChartSectionProps> = ({
  summaries,
  selectedGerencia,
  onSelectGerencia,
}) => {
  const [sortOption, setSortOption] = useState<SortOption>('totalHoras');
  const [viewMode, setViewMode] = useState<ViewMode>('stacked');
  const [hoveredGerencia, setHoveredGerencia] = useState<GerenciaSummaryItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Global totals across all summaries
  const totals = useMemo(() => {
    let totHoras = 0;
    let totManual = 0;
    let totAuto = 0;
    let totNoAuto = 0;
    let totPendienteAuto = 0;
    let totActividades = 0;

    summaries.forEach((s) => {
      const man = s.horasManuales || 0;
      const pend = Math.min(man, Math.max(0, s.horasPotencialAutomatizable || 0));
      const noAuto = Math.max(0, man - pend);

      totHoras += s.horasTotales || 0;
      totManual += man;
      totAuto += s.horasAutomatizadas || 0;
      totNoAuto += noAuto;
      totPendienteAuto += pend;
      totActividades += s.totalActividades || 0;
    });

    const pctGlobal = totHoras > 0 ? (totAuto / totHoras) * 100 : 0;
    return {
      totHoras,
      totManual,
      totAuto,
      totNoAuto,
      totPendienteAuto,
      totActividades,
      pctGlobal,
    };
  }, [summaries]);

  // Sorted summaries
  const sortedSummaries = useMemo(() => {
    const list = [...summaries];
    switch (sortOption) {
      case 'totalHoras':
        return list.sort((a, b) => (b.horasTotales || 0) - (a.horasTotales || 0));
      case 'horasManuales':
        return list.sort((a, b) => (b.horasManuales || 0) - (a.horasManuales || 0));
      case 'actividades':
        return list.sort((a, b) => (b.totalActividades || 0) - (a.totalActividades || 0));
      case 'pctAuto':
        return list.sort((a, b) => (b.pctAutomatizado || 0) - (a.pctAutomatizado || 0));
      case 'nombre':
        return list.sort((a, b) => a.gerencia.localeCompare(b.gerencia));
      default:
        return list;
    }
  }, [summaries, sortOption]);

  // Max values for scale calculations
  const maxHours = useMemo(() => {
    if (sortedSummaries.length === 0) return 100;
    const peak = Math.max(
      ...sortedSummaries.map((s) => {
        if (viewMode === 'stacked') {
          return s.horasTotales || 0;
        }
        return Math.max(s.horasManuales || 0, s.horasAutomatizadas || 0);
      })
    );
    // Round up to nice upper limit (e.g., 200, 500, 1000 step)
    const rawMax = Math.max(peak * 1.15, 10);
    const step = rawMax > 2000 ? 500 : rawMax > 500 ? 200 : rawMax > 100 ? 50 : 20;
    return Math.ceil(rawMax / step) * step;
  }, [sortedSummaries, viewMode]);

  const maxActivities = useMemo(() => {
    if (sortedSummaries.length === 0) return 10;
    const peak = Math.max(...sortedSummaries.map((s) => s.totalActividades || 0));
    const rawMax = Math.max(peak * 1.2, 5);
    const step = rawMax > 100 ? 25 : rawMax > 40 ? 10 : 5;
    return Math.ceil(rawMax / step) * step;
  }, [sortedSummaries]);

  // SVG Chart Geometry with generous padding to prevent any clipping
  const svgWidth = 1060;
  const svgHeight = 480;
  const padding = { top: 35, right: 80, bottom: 160, left: 80 };
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  // Number of items and bar spacing
  const count = sortedSummaries.length;
  const colWidth = count > 0 ? chartWidth / count : chartWidth;
  const barWidth = Math.min(Math.max(colWidth * 0.42, 22), 48);

  // Helper scale functions
  const getYHours = (val: number) => {
    const ratio = Math.min(Math.max(val / (maxHours || 1), 0), 1);
    return padding.top + chartHeight * (1 - ratio);
  };

  const getYActivities = (val: number) => {
    const ratio = Math.min(Math.max(val / (maxActivities || 1), 0), 1);
    return padding.top + chartHeight * (1 - ratio);
  };

  const getXCenter = (index: number) => {
    return padding.left + index * colWidth + colWidth / 2;
  };

  // Y-axis grid ticks (Hours - Left Axis)
  const hoursTicks = useMemo(() => {
    const ticksCount = 5;
    const ticks: number[] = [];
    for (let i = 0; i <= ticksCount; i++) {
      ticks.push(Math.round((maxHours / ticksCount) * i));
    }
    return ticks;
  }, [maxHours]);

  // Y-axis grid ticks (Activities - Right Axis)
  const activitiesTicks = useMemo(() => {
    const ticksCount = 5;
    const ticks: number[] = [];
    for (let i = 0; i <= ticksCount; i++) {
      ticks.push(Math.round((maxActivities / ticksCount) * i));
    }
    return ticks;
  }, [maxActivities]);

  // Path data for the activities line
  const activitiesLinePoints = useMemo(() => {
    return sortedSummaries.map((s, i) => {
      const cx = getXCenter(i);
      const cy = getYActivities(s.totalActividades || 0);
      return { x: cx, y: cy, val: s.totalActividades || 0, gerencia: s.gerencia };
    });
  }, [sortedSummaries, colWidth, maxActivities]);

  const activitiesPathD = useMemo(() => {
    if (activitiesLinePoints.length === 0) return '';
    return activitiesLinePoints.reduce((acc, pt, i) => {
      return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');
  }, [activitiesLinePoints]);

  const activitiesAreaD = useMemo(() => {
    if (activitiesLinePoints.length === 0) return '';
    const first = activitiesLinePoints[0];
    const last = activitiesLinePoints[activitiesLinePoints.length - 1];
    const bottomY = padding.top + chartHeight;
    return `${activitiesPathD} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
  }, [activitiesLinePoints, activitiesPathD, chartHeight]);

  const handleMouseMove = (e: React.MouseEvent, item: GerenciaSummaryItem) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setHoveredGerencia(item);
  };

  const handleMouseLeave = () => {
    setHoveredGerencia(null);
    setTooltipPos(null);
  };

  return (
    <section id="grafica-gerencias" className="space-y-4">
      {/* Header and Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase bg-blue-100 text-blue-900 rounded">
                Gráfica Comparativa
              </span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-700" />
                Horas Manuales vs. Automatizadas y Volumen de Actividades por Gerencia
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Comparativo de carga horaria operativa mensual (desglose manual vs automatizado, eje izquierdo) y volumen total de actividades inventariadas (eje derecho).
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200/80 rounded-lg text-xs">
              <Zap className="w-3.5 h-3.5 text-blue-700" />
              <span className="text-slate-600 font-medium">Horas Auto:</span>
              <span className="font-bold font-mono tabular-nums text-blue-900">
                {formatHours(totals.totAuto)} h
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50/70 border border-[#ffdf80] rounded-lg text-xs">
              <span className="w-2.5 h-2.5 rounded-xs inline-block shadow-2xs border border-amber-300" style={{ backgroundColor: '#ffdf80' }} />
              <span className="text-slate-600 font-medium">Manual No Auto:</span>
              <span className="font-bold font-mono tabular-nums text-slate-800">
                {formatHours(totals.totNoAuto)} h
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50/70 border border-amber-300 rounded-lg text-xs">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 inline-block shadow-2xs" />
              <span className="text-slate-600 font-medium">Manual Pendiente Auto:</span>
              <span className="font-bold font-mono tabular-nums text-amber-800">
                {formatHours(totals.totPendienteAuto)} h
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200/80 rounded-lg text-xs">
              <ListTodo className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-slate-600 font-medium">Actividades:</span>
              <span className="font-bold font-mono tabular-nums text-emerald-900">
                {formatThousands(totals.totActividades)}
              </span>
            </div>
          </div>
        </div>

        {/* Toolbar: View Mode, Sorting, Filter Indicator */}
        <div className="pt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Legend and Interactivity notice */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-slate-700">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block shadow-2xs"></span>
              <span className="font-medium text-slate-800">Horas Automatizadas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs inline-block shadow-2xs border border-amber-300" style={{ backgroundColor: '#ffdf80' }}></span>
              <span className="font-medium text-slate-800">Horas Manuales No Automatizables</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-amber-400 inline-block shadow-2xs"></span>
              <span className="font-medium text-slate-800">Horas Manuales Pendientes por Automatizar</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white inline-block shadow-2xs"></span>
              <span className="font-semibold text-emerald-800">● Volumen Actividades (Eje der.)</span>
            </div>
          </div>

          {/* Action buttons & Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-md shadow-2xs bg-slate-100 p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('stacked')}
                className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'stacked'
                    ? 'bg-white text-blue-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Barras Apiladas (Horas Totales = Manuales + Auto)"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Apiladas</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'grouped'
                    ? 'bg-white text-blue-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Barras Agrupadas (Manual vs Auto lado a lado)"
              >
                <Columns3 className="w-3.5 h-3.5" />
                <span>Lado a Lado</span>
              </button>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <label htmlFor="sortGerenciasSelect" className="text-slate-500 font-medium">Ordenar:</label>
              <select
                id="sortGerenciasSelect"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="totalHoras">Mayor Horas Totales</option>
                <option value="horasManuales">Mayor Horas Manuales</option>
                <option value="actividades">Mayor Volumen Actividades</option>
                <option value="pctAuto">Mayor % Automatización</option>
                <option value="nombre">Alfabético (A-Z)</option>
              </select>
            </div>

            {/* Active Filter notification if single gerencia is selected */}
            {selectedGerencia !== 'ALL' && (
              <button
                type="button"
                onClick={() => onSelectGerencia('ALL')}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-950 font-bold rounded-md transition-colors cursor-pointer"
                title="Restablecer filtro a todas las gerencias"
              >
                <Filter className="w-3 h-3 text-blue-700" />
                <span>Filtro: {selectedGerencia} (Restablecer)</span>
              </button>
            )}
          </div>
        </div>

        {/* Chart Canvas Area */}
        <div
          ref={containerRef}
          className="relative mt-4 w-full bg-slate-900/2 rounded-lg border border-slate-100 p-2 sm:p-3 overflow-x-auto"
        >
          <div className="min-w-[860px] w-full">
            <svg
              id="gerencias-chart-svg"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto select-none overflow-visible"
              style={{ maxHeight: '520px' }}
            >
              <defs>
                {/* Gradients for bars */}
                <linearGradient id="blueBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
                {/* Horas Manuales No Automatizables (#ffdf80) */}
                <linearGradient id="amberNoAutoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffea9f" />
                  <stop offset="100%" stopColor="#ffdf80" />
                </linearGradient>
                {/* Horas Manuales Pendientes por Automatizar (Ámbar brillante / Dorado) */}
                <linearGradient id="amberPendienteGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
                <linearGradient id="emeraldAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
                <filter id="shadowGlow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.15" />
                </filter>
              </defs>

              {/* Background horizontal grid lines (based on hours ticks) */}
              {hoursTicks.map((tick, i) => {
                const y = getYHours(tick);
                return (
                  <g key={`grid-h-${i}`}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={svgWidth - padding.right}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray={i === 0 ? undefined : '3 3'}
                      strokeWidth={i === 0 ? '1.5' : '1'}
                    />
                    {/* Left Y-Axis Label (Hours) */}
                    <text
                      x={padding.left - 10}
                      y={y + 3.5}
                      textAnchor="end"
                      className="text-[10px] fill-slate-500 font-mono font-medium"
                    >
                      {formatThousands(tick)} h
                    </text>
                  </g>
                );
              })}

              {/* Right Y-Axis Labels (Activity Volume) */}
              {activitiesTicks.map((tick, i) => {
                const y = getYActivities(tick);
                return (
                  <text
                    key={`grid-act-${i}`}
                    x={svgWidth - padding.right + 10}
                    y={y + 3.5}
                    textAnchor="start"
                    className="text-[10px] fill-emerald-700 font-mono font-semibold"
                  >
                    {formatThousands(tick)} act
                  </text>
                );
              })}

              {/* Axis Titles */}
              <text
                x={padding.left - 10}
                y={padding.top - 15}
                textAnchor="start"
                className="text-[11px] fill-slate-700 font-bold tracking-tight"
              >
                Horas Mensuales (h/mes)
              </text>
              <text
                x={svgWidth - padding.right + 10}
                y={padding.top - 15}
                textAnchor="end"
                className="text-[11px] fill-emerald-800 font-bold tracking-tight"
              >
                Volumen Actividades
              </text>

              {/* Activity Volume Area Fill */}
              {activitiesAreaD && (
                <path d={activitiesAreaD} fill="url(#emeraldAreaGrad)" />
              )}

              {/* Bars per Gerencia */}
              {sortedSummaries.map((summary, idx) => {
                const cx = getXCenter(idx);
                const isSelected = selectedGerencia === summary.gerencia;
                const isHovered = hoveredGerencia?.gerencia === summary.gerencia;
                const isDimmed = selectedGerencia !== 'ALL' && !isSelected;

                const hAuto = summary.horasAutomatizadas || 0;
                const hMan = summary.horasManuales || 0;
                const hTot = summary.horasTotales || 0;

                const hManPendienteAuto = Math.min(
                  hMan,
                  Math.max(0, summary.horasPotencialAutomatizable || 0)
                );
                const hManNoAuto = Math.max(0, hMan - hManPendienteAuto);

                const bottomY = padding.top + chartHeight;

                if (viewMode === 'stacked') {
                  // Segment 1 (Base): Automatizadas
                  const yAutoTop = getYHours(hAuto);
                  const autoHeight = Math.max(bottomY - yAutoTop, 0);

                  // Segment 2 (Middle): Manuales No Automatizables
                  const yNoAutoTop = getYHours(hAuto + hManNoAuto);
                  const noAutoHeight = Math.max(yAutoTop - yNoAutoTop, 0);

                  // Segment 3 (Top): Manuales Pendientes por Automatizar
                  const yTotTop = getYHours(hTot);
                  const pendienteHeight = Math.max(yNoAutoTop - yTotTop, 0);

                  const barX = cx - barWidth / 2;

                  return (
                    <g
                      key={`stacked-${summary.gerencia}`}
                      className="cursor-pointer transition-opacity duration-200"
                      opacity={isDimmed ? 0.35 : 1}
                      onClick={() =>
                        onSelectGerencia(isSelected ? 'ALL' : summary.gerencia)
                      }
                      onMouseMove={(e) => handleMouseMove(e, summary)}
                      onMouseLeave={handleMouseLeave}
                    >
                      {/* Selection highlight ring */}
                      {isSelected && (
                        <rect
                          x={barX - 4}
                          y={yTotTop - 18}
                          width={barWidth + 8}
                          height={bottomY - yTotTop + 22}
                          rx={6}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth={2}
                          strokeDasharray="4 2"
                        />
                      )}

                      {/* 1. Automated Hours Bar (Bottom - Azul) */}
                      {autoHeight > 0 && (
                        <rect
                          x={barX}
                          y={yAutoTop}
                          width={barWidth}
                          height={autoHeight}
                          rx={noAutoHeight === 0 && pendienteHeight === 0 ? 4 : 0}
                          fill="url(#blueBarGrad)"
                          className={isHovered ? 'filter brightness-110' : ''}
                        />
                      )}

                      {/* 2. Manual No Automatizable Bar (Middle - Ámbar Oscuro) */}
                      {noAutoHeight > 0 && (
                        <rect
                          x={barX}
                          y={yNoAutoTop}
                          width={barWidth}
                          height={noAutoHeight}
                          rx={pendienteHeight === 0 ? 4 : 0}
                          fill="url(#amberNoAutoGrad)"
                          className={isHovered ? 'filter brightness-110' : ''}
                        />
                      )}

                      {/* 3. Manual Pendiente por Automatizar Bar (Top - Ámbar Brillante) */}
                      {pendienteHeight > 0 && (
                        <rect
                          x={barX}
                          y={yTotTop}
                          width={barWidth}
                          height={pendienteHeight}
                          rx={4}
                          fill="url(#amberPendienteGrad)"
                          className={isHovered ? 'filter brightness-110' : ''}
                        />
                      )}

                      {/* Total Hours Badge at top of stacked bar */}
                      <text
                        x={cx}
                        y={yTotTop - 6}
                        textAnchor="middle"
                        className="text-[10px] font-bold font-mono tabular-nums fill-slate-800"
                      >
                        {formatThousands(Math.round(hTot))} h
                      </text>
                    </g>
                  );
                } else {
                  // Grouped Mode: Side by Side
                  const halfBarWidth = Math.max((barWidth - 4) / 2, 10);
                  const barXAuto = cx - halfBarWidth - 2;
                  const barXMan = cx + 2;

                  const yAutoTop = getYHours(hAuto);
                  const autoHeight = Math.max(bottomY - yAutoTop, 0);

                  const yManNoAutoTop = getYHours(hManNoAuto);
                  const manNoAutoHeight = Math.max(bottomY - yManNoAutoTop, 0);

                  const yManTop = getYHours(hMan);
                  const manPendienteHeight = Math.max(yManNoAutoTop - yManTop, 0);

                  const minTop = Math.min(yAutoTop, yManTop);

                  return (
                    <g
                      key={`grouped-${summary.gerencia}`}
                      className="cursor-pointer transition-opacity duration-200"
                      opacity={isDimmed ? 0.35 : 1}
                      onClick={() =>
                        onSelectGerencia(isSelected ? 'ALL' : summary.gerencia)
                      }
                      onMouseMove={(e) => handleMouseMove(e, summary)}
                      onMouseLeave={handleMouseLeave}
                    >
                      {/* Selection highlight ring */}
                      {isSelected && (
                        <rect
                          x={cx - barWidth / 2 - 4}
                          y={minTop - 18}
                          width={barWidth + 8}
                          height={bottomY - minTop + 22}
                          rx={6}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth={2}
                          strokeDasharray="4 2"
                        />
                      )}

                      {/* Auto bar */}
                      {autoHeight > 0 && (
                        <rect
                          x={barXAuto}
                          y={yAutoTop}
                          width={halfBarWidth}
                          height={autoHeight}
                          rx={3}
                          fill="url(#blueBarGrad)"
                          className={isHovered ? 'filter brightness-110' : ''}
                        />
                      )}

                      {/* Manual No Auto bar */}
                      {manNoAutoHeight > 0 && (
                        <rect
                          x={barXMan}
                          y={yManNoAutoTop}
                          width={halfBarWidth}
                          height={manNoAutoHeight}
                          rx={manPendienteHeight === 0 ? 3 : 0}
                          fill="url(#amberNoAutoGrad)"
                          className={isHovered ? 'filter brightness-110' : ''}
                        />
                      )}

                      {/* Manual Pendiente Auto bar */}
                      {manPendienteHeight > 0 && (
                        <rect
                          x={barXMan}
                          y={yManTop}
                          width={halfBarWidth}
                          height={manPendienteHeight}
                          rx={3}
                          fill="url(#amberPendienteGrad)"
                          className={isHovered ? 'filter brightness-110' : ''}
                        />
                      )}

                      {/* Total label above highest */}
                      <text
                        x={cx}
                        y={minTop - 6}
                        textAnchor="middle"
                        className="text-[9px] font-bold font-mono tabular-nums fill-slate-800"
                      >
                        {formatThousands(Math.round(hTot))} h
                      </text>
                    </g>
                  );
                }
              })}

              {/* Activity Volume Connecting Line */}
              {activitiesPathD && (
                <path
                  d={activitiesPathD}
                  fill="none"
                  stroke="#059669"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#shadowGlow)"
                />
              )}

              {/* Activity Volume Circular Nodes and Labels */}
              {activitiesLinePoints.map((pt, i) => {
                const summary = sortedSummaries[i];
                const isSelected = selectedGerencia === summary.gerencia;
                const isHovered = hoveredGerencia?.gerencia === summary.gerencia;

                return (
                  <g
                    key={`act-node-${i}`}
                    className="cursor-pointer"
                    onMouseMove={(e) => handleMouseMove(e, summary)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() =>
                      onSelectGerencia(isSelected ? 'ALL' : summary.gerencia)
                    }
                  >
                    {/* Halo on hover or selected */}
                    {(isHovered || isSelected) && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={12}
                        fill="#10b981"
                        fillOpacity={0.25}
                      />
                    )}
                    {/* Outer white ring */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={6}
                      fill="#ffffff"
                      stroke="#059669"
                      strokeWidth={2.5}
                    />
                    {/* Inner core */}
                    <circle cx={pt.x} cy={pt.y} r={3} fill="#059669" />

                    {/* Numeric tag for activities with ample padding so number never overflows its frame */}
                    {(() => {
                      const valStr = formatThousands(pt.val);
                      // Generous space between the number and tag border (min width 38px, height 17px)
                      const tagWidth = Math.max(38, Math.round(valStr.length * 7.5 + 16));
                      const halfW = tagWidth / 2;
                      const tagHeight = 17;

                      return (
                        <g transform={`translate(${pt.x}, ${pt.y - 12})`}>
                          <rect
                            x={-halfW}
                            y={-14}
                            width={tagWidth}
                            height={tagHeight}
                            rx={4}
                            fill="#065f46"
                            stroke="#047857"
                            strokeWidth={1}
                          />
                          <text
                            x={0}
                            y={-2}
                            textAnchor="middle"
                            fontSize={9}
                            fontWeight="bold"
                            fill="#ffffff"
                            style={{ fontSize: '9px', fontWeight: 'bold' }}
                            className="text-[9px] font-mono font-bold fill-white"
                          >
                            {valStr}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                );
              })}

              {/* X-Axis Category Labels (Gerencias) acomodados en diagonal hacia arriba */}
              {sortedSummaries.map((summary, idx) => {
                const cx = getXCenter(idx);
                const isSelected = selectedGerencia === summary.gerencia;
                const isHovered = hoveredGerencia?.gerencia === summary.gerencia;
                const bottomY = padding.top + chartHeight;

                const rawName = summary.gerencia;
                // Allow up to 26 characters so names are readable without truncation
                const displayName =
                  rawName.length > 26 ? rawName.slice(0, 24) + '...' : rawName;

                return (
                  <g
                    key={`label-${idx}`}
                    className="cursor-pointer group"
                    onClick={() =>
                      onSelectGerencia(isSelected ? 'ALL' : summary.gerencia)
                    }
                    onMouseMove={(e) => handleMouseMove(e, summary)}
                    onMouseLeave={handleMouseLeave}
                  >
                    {/* Tick mark from x-axis */}
                    <line
                      x1={cx}
                      y1={bottomY}
                      x2={cx}
                      y2={bottomY + 6}
                      stroke={isSelected ? '#2563eb' : '#cbd5e1'}
                      strokeWidth={isSelected ? 2 : 1}
                    />

                    {/* Group rotated diagonally upwards (-40 deg) */}
                    <g transform={`translate(${cx + 4}, ${bottomY + 12}) rotate(-40)`}>
                      {/* Selection / Hover background pill */}
                      {(isSelected || isHovered) && (
                        <rect
                          x={-155}
                          y={-12}
                          width={160}
                          height={28}
                          rx={5}
                          fill={isSelected ? '#dbeafe' : '#f1f5f9'}
                          stroke={isSelected ? '#3b82f6' : '#cbd5e1'}
                          strokeWidth={isSelected ? 1.5 : 1}
                        />
                      )}

                      {/* Gerencia Name */}
                      <text
                        x={-6}
                        y={0}
                        textAnchor="end"
                        className={`text-[11px] font-semibold tracking-tight transition-colors ${
                          isSelected
                            ? 'fill-blue-900 font-bold'
                            : isHovered
                            ? 'fill-blue-700 font-bold'
                            : 'fill-slate-700'
                        }`}
                      >
                        {displayName}
                      </text>

                      {/* Sub-label with activity count and automation % */}
                      <text
                        x={-6}
                        y={12}
                        textAnchor="end"
                        className="text-[9px] font-mono tabular-nums fill-slate-500 font-medium"
                      >
                        {formatThousands(summary.totalActividades)} act · {formatThousands(summary.pctAutomatizado, 0)}% auto
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Floating Rich Tooltip */}
          {hoveredGerencia && tooltipPos && (
            <div
              className="absolute pointer-events-none z-30 bg-slate-900 text-white rounded-lg p-3 shadow-xl border border-slate-700 text-xs w-72 transition-all duration-75"
              style={{
                left: Math.min(Math.max(tooltipPos.x - 144, 10), (containerRef.current?.clientWidth || 800) - 298),
                top: Math.max(tooltipPos.y - 180, 10),
              }}
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="font-bold text-slate-100 text-xs truncate max-w-[190px]">
                  {hoveredGerencia.gerencia}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-900/60 text-blue-200 border border-blue-700/50">
                  {formatThousands(hoveredGerencia.pctAutomatizado, 1)}% Auto
                </span>
              </div>

              {(() => {
                const hMan = hoveredGerencia.horasManuales || 0;
                const hPend = Math.min(
                  hMan,
                  Math.max(0, hoveredGerencia.horasPotencialAutomatizable || 0)
                );
                const hNoAuto = Math.max(0, hMan - hPend);

                return (
                  <div className="mt-2 space-y-1.5">
                    {/* Horas Automatizadas */}
                    <div className="flex justify-between items-center">
                      <span className="text-blue-400 flex items-center gap-1.5 font-medium">
                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                        Horas Automatizadas:
                      </span>
                      <span className="font-mono font-bold text-white">
                        {formatHours(hoveredGerencia.horasAutomatizadas)} h
                      </span>
                    </div>

                    {/* Horas Manuales No Auto */}
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 font-medium" style={{ color: '#ffdf80' }}>
                        <span className="w-2 h-2 rounded-full border border-amber-300" style={{ backgroundColor: '#ffdf80' }}></span>
                        Manual No Auto:
                      </span>
                      <span className="font-mono font-bold" style={{ color: '#ffdf80' }}>
                        {formatHours(hNoAuto)} h
                      </span>
                    </div>

                    {/* Horas Manuales Pendientes por Auto */}
                    <div className="flex justify-between items-center">
                      <span className="text-amber-300 flex items-center gap-1.5 font-medium">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        Manual Pendiente Auto:
                      </span>
                      <span className="font-mono font-bold text-amber-300">
                        {formatHours(hPend)} h
                      </span>
                    </div>

                    {/* Total Horas Manuales */}
                    <div className="flex justify-between items-center pt-1 border-t border-slate-800 text-[11px]">
                      <span className="text-slate-400 font-medium">Total Horas Manuales:</span>
                      <span className="font-mono font-bold text-amber-400">
                        {formatHours(hMan)} h
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-slate-800 font-semibold">
                      <span className="text-slate-300">Carga Horaria Total:</span>
                      <span className="font-mono text-white">
                        {formatHours(hoveredGerencia.horasTotales)} h
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                      <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        Volumen de Actividades:
                      </span>
                      <span className="font-mono font-bold text-emerald-300">
                        {formatThousands(hoveredGerencia.totalActividades)} tareas
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-400">
                      <span>Procesos Macro:</span>
                      <span className="font-mono text-slate-200">
                        {formatThousands(hoveredGerencia.totalProcesosMacro)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-400">
                      <span>Colaboradores:</span>
                      <span className="font-mono text-slate-200">
                        {formatThousands(hoveredGerencia.totalColaboradores)} personas
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-2.5 pt-1.5 border-t border-slate-800/80 text-[10px] text-blue-300 text-center font-medium">
                Haz clic para {selectedGerencia === hoveredGerencia.gerencia ? 'desmarcar' : 'filtrar todo el tablero por esta gerencia'}
              </div>
            </div>
          )}
        </div>

        {/* Footer tip */}
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            Las barras reflejan la carga de horas (azul: automatizadas, amarillo: manuales no automatizables, ámbar dorado: pendientes por automatizar); la línea verde conecta el volumen de actividades de cada gerencia.
          </span>
          <span className="text-slate-400 hidden sm:inline">
            {sortedSummaries.length} gerencias registradas
          </span>
        </div>
      </div>
    </section>
  );
};
