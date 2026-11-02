import React from 'react';
import { Layers, Building2, Users, CheckCircle2, Filter, X } from 'lucide-react';
import { SubdireccionSummaryItem } from '../types/sheets';
import { formatHours, formatThousands } from '../utils/sheetsParser';

interface SubdireccionSummarySectionProps {
  subdirecciones: SubdireccionSummaryItem[];
  selectedSubdireccion: string;
  selectedGerencia?: string;
  onSelectSubdireccion: (subdireccion: string) => void;
  onSelectGerencia?: (gerencia: string, subdireccion?: string) => void;
}

export function SubdireccionSummarySection({
  subdirecciones,
  selectedSubdireccion,
  selectedGerencia = 'ALL',
  onSelectSubdireccion,
  onSelectGerencia,
}: SubdireccionSummarySectionProps) {
  const isFiltered = selectedSubdireccion !== 'ALL';
  const isGerenciaFiltered = selectedGerencia !== 'ALL';

  return (
    <section id="resumen-subdirecciones" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase bg-indigo-100 text-indigo-900 rounded">
              Estructura Organizacional
            </span>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-700" />
              Cuadro Resumen a Nivel Subdirección
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Identificación de procesos, colaboradores y gerencias asignados a cada Subdirección. Haz clic en una subdirección o en cualquiera de sus gerencias para filtrar el tablero.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isFiltered && (
            <button
              type="button"
              onClick={() => onSelectSubdireccion('ALL')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors shadow-xs cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
              Quitar filtro de Subdirección ({selectedSubdireccion})
            </button>
          )}
          {isGerenciaFiltered && onSelectGerencia && (
            <button
              type="button"
              onClick={() => onSelectGerencia('ALL')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors shadow-xs cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5 text-blue-600" />
              Quitar filtro de Gerencia ({selectedGerencia})
            </button>
          )}
        </div>
      </div>

      {/* Main Table for Subdirecciones */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-semibold border-b border-slate-800">
                <th className="py-3 px-4 font-medium tracking-wide">Subdirección</th>
                <th className="py-3 px-3 font-medium tracking-wide">Gerencias que Agrupa</th>
                <th className="py-3 px-3 text-center font-medium tracking-wide">Procesos Macro</th>
                <th className="py-3 px-3 text-center font-medium tracking-wide">Actividades Únicas</th>
                <th className="py-3 px-3 text-center font-medium tracking-wide text-sky-200">Colaboradores</th>
                <th className="py-3 px-3 text-right font-medium tracking-wide text-sky-200">Horas Auto.</th>
                <th className="py-3 px-3 text-right font-medium tracking-wide text-amber-300">Horas Manuales</th>
                <th className="py-3 px-3 text-right font-medium tracking-wide">Horas Totales</th>
                <th className="py-3 px-3 text-center font-medium tracking-wide">% Auto.</th>
                <th className="py-3 px-4 text-center font-medium tracking-wide w-28">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {subdirecciones.map((sub) => {
                const isSelected = selectedSubdireccion === sub.subdireccion;

                return (
                  <tr
                    key={sub.subdireccion}
                    onClick={() => onSelectSubdireccion(isSelected ? 'ALL' : sub.subdireccion)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/90 font-medium'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Subdirección Name */}
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Building2 className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-700' : 'text-slate-400'}`} />
                        <span>{sub.subdireccion}</span>
                        {isSelected && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-600 text-white rounded">
                            Filtrando
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Gerencias tags - Clickable to filter by Gerencia */}
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1.5 max-w-sm">
                        {sub.gerenciasList.map((g) => {
                          const isGSelected = selectedGerencia === g;
                          return (
                            <button
                              key={g}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSelectGerencia) {
                                  if (isGSelected) {
                                    onSelectGerencia('ALL');
                                  } else {
                                    onSelectGerencia(g, sub.subdireccion);
                                  }
                                }
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer font-medium ${
                                isGSelected
                                  ? 'bg-blue-600 text-white font-bold border border-blue-700 shadow-xs'
                                  : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-900 border border-slate-200 hover:border-blue-300'
                              }`}
                              title={
                                isGSelected
                                  ? `Quitar filtro de ${g}`
                                  : `Filtrar el tablero por la gerencia: ${g}`
                              }
                            >
                              <span>{g}</span>
                              {isGSelected && <CheckCircle2 className="w-2.5 h-2.5 text-white shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    {/* Macro Procesos */}
                    <td className="py-3 px-3 text-center font-mono tabular-nums font-bold text-blue-950">
                      {formatThousands(sub.totalProcesosMacro)}
                    </td>

                    {/* Actividades Únicas */}
                    <td className="py-3 px-3 text-center font-mono tabular-nums font-bold text-slate-800">
                      {formatThousands(sub.totalActividades)}
                    </td>

                    {/* Colaboradores */}
                    <td className="py-3 px-3 text-center font-mono tabular-nums font-semibold text-blue-800">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        {formatThousands(sub.totalColaboradores)}
                      </span>
                    </td>

                    {/* Horas Auto */}
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-blue-800">
                      {formatHours(sub.horasAutomatizadas)} h
                    </td>

                    {/* Horas Manuales */}
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-amber-700 bg-amber-50/50">
                      {formatHours(sub.horasManuales)} h
                    </td>

                    {/* Horas Totales */}
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatHours(sub.horasTotales)} h
                    </td>

                    {/* % Automatizado */}
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center gap-1 font-mono font-bold text-xs text-blue-900">
                        <span>{sub.pctAutomatizado}%</span>
                      </div>
                      <div className="w-16 mx-auto bg-slate-200 h-1 rounded-full overflow-hidden mt-1">
                        <div
                          className="bg-blue-600 h-full rounded-full"
                          style={{ width: `${Math.min(100, sub.pctAutomatizado)}%` }}
                        />
                      </div>
                    </td>

                    {/* Acción / Botón Filtrar */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSubdireccion(isSelected ? 'ALL' : sub.subdireccion);
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-800 border border-slate-200'
                        }`}
                      >
                        <Filter className="w-3 h-3" />
                        {isSelected ? 'Activo' : 'Filtrar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Footer Total */}
            <tfoot>
              <tr className="bg-slate-800 text-white font-semibold">
                <td colSpan={2} className="py-3 px-4 font-bold text-white uppercase tracking-wider text-[11px]">
                  Total Consolidado Subdirecciones
                </td>
                <td className="py-3 px-3 text-center font-mono tabular-nums text-white">
                  {formatThousands(
                    subdirecciones.reduce((acc, s) => acc + s.totalProcesosMacro, 0)
                  )}
                </td>
                <td className="py-3 px-3 text-center font-mono tabular-nums text-white">
                  {formatThousands(
                    subdirecciones.reduce((acc, s) => acc + s.totalActividades, 0)
                  )}
                </td>
                <td className="py-3 px-3 text-center font-mono tabular-nums text-sky-200">
                  {formatThousands(
                    subdirecciones.reduce((acc, s) => acc + s.totalColaboradores, 0)
                  )}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-sky-200">
                  {formatHours(
                    subdirecciones.reduce((acc, s) => acc + s.horasAutomatizadas, 0)
                  )}{' '}
                  h
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-300">
                  {formatHours(
                    subdirecciones.reduce((acc, s) => acc + s.horasManuales, 0)
                  )}{' '}
                  h
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-white">
                  {formatHours(
                    subdirecciones.reduce((acc, s) => acc + s.horasTotales, 0)
                  )}{' '}
                  h
                </td>
                <td className="py-3 px-3 text-center font-mono tabular-nums text-white">
                  {(() => {
                    const totAuto = subdirecciones.reduce((acc, s) => acc + s.horasAutomatizadas, 0);
                    const totTot = subdirecciones.reduce((acc, s) => acc + s.horasTotales, 0);
                    return totTot > 0 ? `${((totAuto / totTot) * 100).toFixed(1)}%` : '0%';
                  })()}
                </td>
                <td className="py-3 px-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}
