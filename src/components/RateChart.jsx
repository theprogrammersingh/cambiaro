import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { todayIso } from '../api/frankfurter.js'
import { formatDate, formatRate } from '../lib/format.js'
import { useAgentPulse } from '../hooks/useAgentPulse.js'
import { useConverter } from '../state/converterContext.js'
import './RateChart.css'

const PRESETS = ['7D', '30D', '90D', 'custom']
const PRESET_LABEL = { '7D': '7D', '30D': '30D', '90D': '90D', custom: 'Custom' }

/** Labels at the start, middle and end only — no gridline clutter (§5.6). */
function edgeTicks(data) {
  if (data.length === 0) return []
  if (data.length <= 2) return data.map((point) => point.date)
  return [data[0].date, data[Math.floor(data.length / 2)].date, data[data.length - 1].date]
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="chart__tooltip">
      <span className="chart__tooltip-rate tabular">{formatRate(point.rate)}</span>
      <span className="meta">{formatDate(point.date)}</span>
    </div>
  )
}

export function RateChart() {
  const { series, seriesStatus, range, from, to, actions, pulses, customRange } = useConverter()
  const pulsing = useAgentPulse(pulses.chart)
  const data = series.map((row) => ({ date: row.date, rate: row.rate }))

  return (
    <section className={`chart${pulsing ? ' is-agent-touched' : ''}`} aria-label="Rate history">
      <div className="chart__head">
        <span className="label">
          {from} → {to} history
        </span>
        <div className="chart__ranges" role="group" aria-label="Chart range">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`chart__range${range === preset ? ' chart__range--active' : ''}`}
              aria-pressed={range === preset}
              onClick={() =>
                actions.setRange(
                  preset,
                  preset === 'custom'
                    ? (customRange ?? { start: '2026-01-01', end: todayIso() })
                    : undefined,
                )
              }
            >
              {PRESET_LABEL[preset]}
            </button>
          ))}
        </div>
      </div>

      {range === 'custom' ? (
        <div className="chart__custom">
          <label className="visually-hidden" htmlFor="chart-start">
            Range start
          </label>
          <input
            id="chart-start"
            className="chart__date tabular"
            type="date"
            max={customRange?.end ?? todayIso()}
            value={customRange?.start ?? ''}
            onChange={(event) =>
              actions.setRange('custom', {
                start: event.target.value,
                end: customRange?.end ?? todayIso(),
              })
            }
          />
          <span className="meta" aria-hidden="true">
            to
          </span>
          <label className="visually-hidden" htmlFor="chart-end">
            Range end
          </label>
          <input
            id="chart-end"
            className="chart__date tabular"
            type="date"
            min={customRange?.start}
            max={todayIso()}
            value={customRange?.end ?? ''}
            onChange={(event) =>
              actions.setRange('custom', {
                start: customRange?.start ?? '2026-01-01',
                end: event.target.value,
              })
            }
          />
        </div>
      ) : null}

      <div className="chart__plot">
        {seriesStatus === 'empty' || (seriesStatus === 'ready' && data.length === 0) ? (
          <p className="meta chart__message">No rates published in that range.</p>
        ) : seriesStatus === 'error' ? (
          <p className="meta chart__message chart__message--error">Couldn&rsquo;t load the history.</p>
        ) : data.length === 0 ? (
          <p className="meta chart__message">Loading history…</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="date"
                ticks={edgeTicks(data)}
                tickFormatter={formatDate}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={0}
              />
              <YAxis
                domain={['dataMin', 'dataMax']}
                width={52}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                tickFormatter={formatRate}
                axisLine={false}
                tickLine={false}
                tickCount={3}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--color-border)' }} />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="var(--color-accent)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: 'var(--color-accent)' }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
