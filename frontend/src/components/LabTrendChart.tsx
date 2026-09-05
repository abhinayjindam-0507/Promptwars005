import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { demoTrendSeries } from '../data/mockData'
import { DemoBadge } from './DemoBadge'

export function LabTrendChart() {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">
            Illustrative lab series
          </h2>
          <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-slate-body">
            Synthetic analyte values for chart layout only. This series does not
            represent a real patient or a clinical condition.
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
