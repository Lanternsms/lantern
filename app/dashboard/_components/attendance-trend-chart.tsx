'use client'

import { useState, useId } from 'react'

export type DailyPoint = {
  date: string
  pct: number | null
}

const formatDateShort = (iso: string) => {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d)
  } catch {
    return iso
  }
}

const formatDateFull = (iso: string) => {
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d)
  } catch {
    return iso
  }
}

export function AttendanceTrendChart({
  daily,
  termAvg,
}: {
  daily: DailyPoint[]
  termAvg: number | null
}) {
  const gradientId = useId()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  // Filter to days that have valid attendance percentage
  const points = daily.filter((d) => d.pct !== null)
  const validPcts = points.map((p) => p.pct as number)

  // Dynamic Y-axis: 84% to 100%, extend downwards in steps of 5 if below 84%
  const minVal = validPcts.length > 0 ? Math.min(...validPcts) : 90
  let yMin = 84
  if (minVal < 84) {
    yMin = 84 - Math.ceil((84 - minVal) / 5) * 5
  }
  const yMax = 100

  // Ticks at 100, 95, 90, 85, etc. down to yMin
  const ticks: number[] = []
  for (let t = 100; t >= yMin; t -= 5) {
    ticks.push(t)
  }

  // Find lowest day for aria-label
  const lowestDay = points.length > 0
    ? points.reduce((min, p) => (p.pct! < min.pct! ? p : min), points[0])
    : null

  // Chart dimensions & padding
  const width = 640
  const height = 180
  const padLeft = 40
  const padRight = 16
  const padTop = 14
  const padBottom = 26

  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom

  const getY = (val: number) => {
    const ratio = (val - yMin) / (yMax - yMin)
    return padTop + plotH * (1 - ratio)
  }

  const getX = (index: number, total: number) => {
    if (total <= 1) return padLeft + plotW / 2
    return padLeft + (index / (total - 1)) * plotW
  }

  const coords = points.map((p, idx) => ({
    x: getX(idx, points.length),
    y: getY(p.pct!),
    date: p.date,
    pct: p.pct!,
  }))

  // Line path & area path
  let pathD = ''
  let areaD = ''
  if (coords.length === 1) {
    pathD = `M ${coords[0].x - 10} ${coords[0].y} L ${coords[0].x + 10} ${coords[0].y}`
  } else if (coords.length > 1) {
    pathD = coords.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`), '')
    const first = coords[0]
    const last = coords[coords.length - 1]
    const bottomY = getY(yMin)
    areaD = `${pathD} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`
  }

  // Pick 3-5 date labels across the available points
  const totalCount = points.length
  const labelIndices: number[] = []
  if (totalCount > 0) {
    if (totalCount <= 5) {
      for (let i = 0; i < totalCount; i++) labelIndices.push(i)
    } else {
      const step = (totalCount - 1) / 4
      for (let i = 0; i < 5; i++) {
        labelIndices.push(Math.round(i * step))
      }
    }
  }

  const activeCoord = hoverIndex !== null && coords[hoverIndex] ? coords[hoverIndex] : null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-text-secondary">
        <span className="font-medium text-text-primary">School-wide, each school day</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3.5 border-t border-dashed border-[#FDB104]" />
          <span>Dashed line = 90%</span>
        </span>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label={`School-wide daily attendance trend. Term average: ${
            termAvg !== null ? `${termAvg}%` : 'no records'
          }, lowest day: ${
            lowestDay ? `${lowestDay.pct}% on ${formatDateFull(lowestDay.date)}` : 'none'
          }.`}
          tabIndex={0}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#023879" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#023879" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Gridlines */}
          {ticks.map((t) => {
            const y = getY(t)
            const is90 = t === 90
            return (
              <g key={t}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke={is90 ? '#FDB104' : '#e5e7eb'}
                  strokeDasharray={is90 ? '4 4' : undefined}
                  strokeWidth={is90 ? 1.5 : 1}
                />
                <text
                  x={padLeft - 6}
                  y={y + 3.5}
                  textAnchor="end"
                  className={`text-[10px] tabular-nums ${is90 ? 'fill-[#92400e] font-semibold' : 'fill-gray-400'}`}
                >
                  {t}%
                </text>
              </g>
            )
          })}

          {/* Area fill */}
          {areaD && <path d={areaD} fill={`url(#${gradientId})`} pointerEvents="none" />}

          {/* Trend line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#023879"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          )}

          {/* Latest point ring marker */}
          {coords.length > 0 && (
            <circle
              cx={coords[coords.length - 1].x}
              cy={coords[coords.length - 1].y}
              r="4.5"
              fill="#ffffff"
              stroke="#023879"
              strokeWidth="2.5"
              pointerEvents="none"
            />
          )}

          {/* Interactive hover targets for each point */}
          {coords.map((c, i) => (
            <g
              key={c.date}
              className="cursor-pointer focus:outline-none"
              tabIndex={0}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              onFocus={() => setHoverIndex(i)}
              onBlur={() => setHoverIndex(null)}
              onTouchStart={() => setHoverIndex(i)}
            >
              {/* Invisible large target for touch & hover */}
              <circle cx={c.x} cy={c.y} r="14" fill="transparent" />

              {/* Highlight active circle */}
              {hoverIndex === i && (
                <circle
                  cx={c.x}
                  cy={c.y}
                  r="5"
                  fill="#023879"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              )}
            </g>
          ))}

          {/* X-axis date labels */}
          {labelIndices.map((idx, pos) => {
            const pt = coords[idx]
            if (!pt) return null
            const isPhoneHidden = pos === 1 || pos === 3
            return (
              <text
                key={pt.date}
                x={pt.x}
                y={height - 6}
                textAnchor="middle"
                className={`text-[10px] fill-gray-400 ${isPhoneHidden ? 'hidden sm:block' : 'block'}`}
              >
                {formatDateShort(pt.date)}
              </text>
            )
          })}

          {/* Empty state message when 0 points */}
          {coords.length === 0 && (
            <text
              x={padLeft + plotW / 2}
              y={padTop + plotH / 2 + 4}
              textAnchor="middle"
              className="text-xs fill-gray-400"
            >
              No attendance recorded yet this term
            </text>
          )}
        </svg>

        {/* Tooltip on active point */}
        {activeCoord && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full transform rounded-md bg-neutral-900 px-2.5 py-1 text-xs text-white shadow-md transition-all duration-75"
            style={{
              left: `${(activeCoord.x / width) * 100}%`,
              top: `${(activeCoord.y / height) * 100}%`,
              marginTop: '-8px',
            }}
          >
            <div className="font-medium whitespace-nowrap">{formatDateFull(activeCoord.date)}</div>
            <div className="text-[11px] font-semibold text-amber-300 tabular-nums">
              {activeCoord.pct.toFixed(1)}% present
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

