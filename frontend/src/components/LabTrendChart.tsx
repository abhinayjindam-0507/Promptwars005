import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { demoTrendSeries } from '../data/mockData'
import { formatDisplayDate } from '../lib/labels'
import type { LabResultResponse, ReportResponse } from '../types/api'
import { DemoBadge } from './DemoBadge'

interface LabTrendChartProps {
  isLive?: boolean
  patientLabResults?: LabResultResponse[]
  reports?: ReportResponse[]
}

export function LabTrendChart({
  isLive = false,
  patientLabResults = [],
  reports = [],
}: LabTrendChartProps) {
  // Map report IDs to report objects for easy date lookup
  const reportMap = useMemo(() => {
    const map = new Map<number, ReportResponse>()
    reports.forEach((r) => map.set(r.id, r))
    return map
  }, [reports])

  // Extract all numeric lab results
  const numericResults = useMemo(() => {
    if (!isLive) return []
    return patientLabResults.filter(
      (r) => r.numeric_value != null && !isNaN(r.numeric_value)
    )
  }, [isLive, patientLabResults])

  // Get distinct analytes with count
  const analytes = useMemo(() => {
    const counts = new Map<string, number>()
    numericResults.forEach((r) => {
      const name = r.test_name.trim()
      counts.set(name, (counts.get(name) || 0) + 1)
    })
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
  }, [numericResults])

  const [selectedAnalyte, setSelectedAnalyte] = useState<string>('')

  // Active analyte is selectedAnalyte if valid, otherwise top analyte
  const activeAnalyte =
    selectedAnalyte && analytes.includes(selectedAnalyte)
      ? selectedAnalyte
      : analytes[0] || ''

  // Filter and sort chronological data points for active analyte
  const chartData = useMemo(() => {
    if (!activeAnalyte) return []
    const matching = numericResults.filter(
      (r) => r.test_name.trim().toLowerCase() === activeAnalyte.toLowerCase()
    )

    // Sort chronologically
    const sorted = [...matching].sort((a, b) => {
      const repA = a.report_id != null ? reportMap.get(a.report_id) : undefined
      const repB = b.report_id != null ? reportMap.get(b.report_id) : undefined
      const dateA = a.test_date || repA?.report_date || repA?.uploaded_at || a.created_at
      const dateB = b.test_date || repB?.report_date || repB?.uploaded_at || b.created_at
      return new Date(dateA).getTime() - new Date(dateB).getTime()
    })

    return sorted.map((item, idx) => {
      const rep = item.report_id != null ? reportMap.get(item.report_id) : undefined
      const rawDate = item.test_date || rep?.report_date || rep?.uploaded_at || item.created_at
      const formatted = formatDisplayDate(rawDate)
      return {
        id: item.id,
        label: formatted !== '—' ? formatted : `Pt #${idx + 1}`,
        value: item.numeric_value as number,
        displayValue: item.value,
        unit: item.unit || '',
        referenceRange: item.reference_range_text,
        refLow: item.reference_low,
        refHigh: item.reference_high,
        status: item.status,
        verificationStatus: item.verification_status,
        sourceReport: rep?.file_name || `Report #${item.report_id}`,
      }
    })
  }, [activeAnalyte, numericResults, reportMap])

  // Summary factual metrics (no subjective interpretation)
  const summaryMetrics = useMemo(() => {
    if (chartData.length === 0) return null
    const latest = chartData[chartData.length - 1]
    const previous = chartData.length >= 2 ? chartData[chartData.length - 2] : null

    let deltaStr = '—'
    if (previous && previous.value != null && latest.value != null) {
      const diff = Math.round((latest.value - previous.value) * 100) / 100
      const sign = diff > 0 ? '+' : ''
      deltaStr = `${sign}${diff} ${latest.unit}`.trim()
    }

    return {
      latestValue: `${latest.displayValue} ${latest.unit}`.trim(),
      deltaStr,
      dataPointsCount: chartData.length,
      referenceRange: latest.referenceRange || 'None specified in source',
      refLow: latest.refLow,
      refHigh: latest.refHigh,
      status: latest.status,
      verificationStatus: latest.verificationStatus,
    }
  }, [chartData])

  // Calculate Y-axis domain
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100]
    const vals = chartData.map((d) => d.value)
    if (chartData[0].refLow != null) vals.push(chartData[0].refLow)
    if (chartData[0].refHigh != null) vals.push(chartData[0].refHigh)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const padding = (max - min) * 0.2 || (min > 0 ? min * 0.1 : 5)
    return [
      Math.max(0, Math.floor(min - padding)),
      Math.ceil(max + padding),
    ]
  }, [chartData])

  // Render live chart when active
  if (isLive && analytes.length > 0 && chartData.length > 0) {
    return (
      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-ink">
                Longitudinal analyte trend
              </h2>
              <span className="inline-flex items-center rounded-sm border border-teal/30 bg-teal-mist px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal">
                Live Data
              </span>
            </div>
            <p className="mt-1 text-[12.5px] text-slate-body">
              Chronological factual values extracted across patient records.
            </p>
          </div>

          {/* Analyte selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="analyte-select" className="text-[11px] font-medium text-slate-body">
              Analyte:
            </label>
            <select
              id="analyte-select"
              value={activeAnalyte}
              onChange={(e) => setSelectedAnalyte(e.target.value)}
              className="rounded-md border border-line bg-surface px-2.5 py-1 text-[12px] font-medium text-ink shadow-2xs focus:border-teal focus:outline-hidden"
            >
              {analytes.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Chart */}
        <div className="mt-4 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 12, right: 12, left: -14, bottom: 0 }}
            >
              <CartesianGrid stroke="#d5dedb" strokeDasharray="3 6" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#5a6b68', fontSize: 11 }}
                axisLine={{ stroke: '#c3cfcc' }}
                tickLine={false}
              />
              <YAxis
                domain={yDomain}
                tick={{ fill: '#5a6b68', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #d5dedb',
                  fontSize: 12,
                }}
                formatter={(val) => [
                  `${val} ${chartData[0]?.unit || ''}`.trim(),
                  activeAnalyte,
                ]}
                labelFormatter={(label, items) => {
                  const item = items?.[0]?.payload
                  return `${label} · ${item?.sourceReport || ''}`
                }}
              />
              {summaryMetrics?.refLow != null && (
                <ReferenceLine
                  y={summaryMetrics.refLow}
                  stroke="#c3cfcc"
                  strokeDasharray="4 4"
                />
              )}
              {summaryMetrics?.refHigh != null && (
                <ReferenceLine
                  y={summaryMetrics.refHigh}
                  stroke="#c3cfcc"
                  strokeDasharray="4 4"
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#1a5c54"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#1a5c54' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Factual Summary Cards (zero subjective medical terms) */}
        {summaryMetrics && (
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line/60 pt-3 sm:grid-cols-4">
            <div className="rounded-md border border-line bg-paper/60 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-body">
                Latest Value
              </p>
              <p className="mt-1 text-[13.5px] font-bold text-ink">
                {summaryMetrics.latestValue}
              </p>
            </div>
            <div className="rounded-md border border-line bg-paper/60 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-body">
                Prior Delta
              </p>
              <p className="mt-1 text-[13.5px] font-bold text-ink">
                {summaryMetrics.deltaStr}
              </p>
            </div>
            <div className="rounded-md border border-line bg-paper/60 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-body">
                Reference Range
              </p>
              <p className="mt-1 truncate text-[12px] font-medium text-ink" title={summaryMetrics.referenceRange}>
                {summaryMetrics.referenceRange}
              </p>
            </div>
            <div className="rounded-md border border-line bg-paper/60 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-body">
                Chronological Points
              </p>
              <p className="mt-1 text-[13.5px] font-bold text-ink">
                {summaryMetrics.dataPointsCount} report(s)
              </p>
            </div>
          </div>
        )}

        <p className="mt-2.5 text-[11px] text-slate-body">
          * Factual numerical delta across documented reports. MedLens does not compute subjective trend interpretations.
        </p>
      </section>
    )
  }

  // Fallback demo series when offline or when patient has no extracted numerical data
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">
            Illustrative lab series
          </h2>
          <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-slate-body">
            {isLive
              ? 'No numerical lab results extracted for this patient yet. Showing illustrative layout.'
              : 'Synthetic analyte values for chart layout only. This series does not represent a real patient.'}
          </p>
        </div>
        <DemoBadge />
      </div>
      <div className="mt-4 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={demoTrendSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="#d5dedb" strokeDasharray="3 6" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#5a6b68', fontSize: 11 }}
              axisLine={{ stroke: '#c3cfcc' }}
              tickLine={false}
            />
            <YAxis
              domain={[11.5, 13.2]}
              tick={{ fill: '#5a6b68', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: '1px solid #d5dedb',
                fontSize: 12,
              }}
              formatter={(value) => [
                `${value ?? '—'} (demo units)`,
                'Analyte A',
              ]}
              labelFormatter={(label) => `Interval ${label}`}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#1a5c54"
              strokeWidth={2}
              dot={{ r: 3, fill: '#1a5c54' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
