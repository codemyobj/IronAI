import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, Legend
} from 'recharts'

// --- Chart wrapper ---
export function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="chart-card">
      <h3 className="chart-title">{title}</h3>
      <div className="chart-body">{children}</div>
    </div>
  )
}

// --- Colors ---
export const CHART_COLORS = {
  primary: '#10b981',
  protein: '#3b82f6',
  carbs: '#f59e0b',
  fat: '#ef4444',
  calories: '#10b981',
  training: '#8b5cf6',
}

const PIE_COLORS = [CHART_COLORS.protein, CHART_COLORS.carbs, CHART_COLORS.fat]

// --- Calorie Trend Line Chart ---
interface TrendData {
  date: string
  value: number
}

export function CalorieTrendChart({ data, color = CHART_COLORS.calories }: { data: TrendData[]; color?: string }) {
  if (!data || data.length === 0) return null
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={formatShortDate} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, fill: color }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// --- Training Frequency Bar Chart ---
interface BarData {
  label: string
  value: number
}

export function TrainingBarChart({ data, color = CHART_COLORS.training }: { data: BarData[]; color?: string }) {
  if (!data || data.length === 0) return null
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// --- Macro Pie Chart ---
interface PieData {
  name: string
  value: number
}

export function MacroPieChart({ data }: { data: PieData[] }) {
  const filtered = data.filter(d => d.value > 0)
  if (filtered.length === 0) return null
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={filtered}
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={70}
          paddingAngle={2}
          dataKey="value"
        >
          {filtered.map((_, index) => (
            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip suffix="g" />} />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// --- Muscle Group Radial Bar ---
export function MuscleGroupChart({ data }: { data: BarData[] }) {
  if (!data || data.length === 0) return null
  const chartData = data.map(d => ({ name: d.label, value: d.value, fill: getColorByIndex(data.indexOf(d)) }))
  return (
    <ResponsiveContainer width="100%" height={200}>
      <RadialBarChart
        cx="50%"
        cy="50%"
        innerRadius="20%"
        outerRadius="90%"
        data={chartData}
        startAngle={90}
        endAngle={-270}
      >
        <RadialBar background dataKey="value" cornerRadius={6} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
      </RadialBarChart>
    </ResponsiveContainer>
  )
}

// --- Helpers ---
function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short' })
}

const RAINBOW = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
function getColorByIndex(i: number): string {
  return RAINBOW[i % RAINBOW.length]
}

interface TooltipPayload {
  name?: string
  value?: number | string
  color?: string
}

function CustomTooltip({ active, payload, label, suffix }: any) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="chart-tooltip">
      {label && <p className="chart-tooltip-label">{label}</p>}
      {payload.map((entry: TooltipPayload, i: number) => (
        <p key={i} className="chart-tooltip-item" style={{ color: entry.color }}>
          {entry.name}: {entry.value}{suffix || ''}
        </p>
      ))}
    </div>
  )
}
