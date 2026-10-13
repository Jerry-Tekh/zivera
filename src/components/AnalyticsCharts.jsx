import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const money = (cents) => `$${(cents / 100).toFixed(2)}`;
const compactMoney = (cents) => `$${new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(cents / 100)}`;
const number = (value) => new Intl.NumberFormat('en-US').format(value);
const dateLabel = (date) => new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export function DailyBarChart({ daily, firstKey, secondKey, firstLabel, secondLabel, formatValue, formatAxisValue }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={daily} accessibilityLayer margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={dateLabel}
          minTickGap={16}
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatAxisValue}
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={68}
        />
        <Tooltip
          labelFormatter={dateLabel}
          formatter={(value, name) => [formatValue(value), name]}
          contentStyle={{ borderRadius: 10, borderColor: 'var(--border)' }}
        />
        <Legend />
        <Bar dataKey={firstKey} name={firstLabel} fill="#c352ed" radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar dataKey={secondKey} name={secondLabel} fill="#a872e6" radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategorySalesChart({ ticketCategories }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, ticketCategories.length * 42)}>
      <BarChart
        data={ticketCategories}
        layout="vertical"
        accessibilityLayer
        margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
      >
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          allowDecimals={false}
          tickFormatter={number}
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fill: 'var(--text)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip formatter={(value) => [`${number(value)} sold`, 'Tickets']} />
        <Bar dataKey="sold" name="Tickets sold" fill="#c352ed" radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function EventPerformancePlot({ events }) {
  const chartData = [...events]
    .sort((first, second) => second.grossRevenueCents - first.grossRevenueCents)
    .slice(0, 8);

  return (
    <ResponsiveContainer width="100%" height={Math.max(260, chartData.length * 54)}>
      <BarChart
        data={chartData}
        layout="vertical"
        accessibilityLayer
        margin={{ top: 4, right: 18, bottom: 4, left: 8 }}
      >
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={compactMoney}
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="title"
          width={128}
          tick={{ fill: 'var(--text)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value, name) => [money(value), name]}
          contentStyle={{ borderRadius: 10, borderColor: 'var(--border)' }}
        />
        <Legend />
        <Bar dataKey="grossRevenueCents" name="Gross sales" fill="#c352ed" radius={[0, 4, 4, 0]} maxBarSize={18} />
        <Bar dataKey="refundedAmountCents" name="Refunds" fill="#a872e6" radius={[0, 4, 4, 0]} maxBarSize={18} />
        <Bar dataKey="netRevenueCents" name="Net revenue" fill="#764ba2" radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
