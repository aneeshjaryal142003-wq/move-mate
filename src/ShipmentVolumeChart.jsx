import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis,
} from "recharts";

export default function ShipmentVolumeChart({ data }) {
  return <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data} margin={{ top: 10, right: 12, left: -24, bottom: 0 }}>
      <defs>
        <linearGradient id="shipmentFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#80a75e" stopOpacity={0.19} />
          <stop offset="95%" stopColor="#80a75e" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid vertical={false} stroke="#edf0eb" strokeDasharray="3 4" />
      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#98a09c", fontSize: 11 }} dy={11} />
      <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e8ece6", boxShadow: "0 8px 25px #1c28220d", fontSize: 12 }} />
      <Area type="monotone" dataKey="shipments" stroke="#719650" strokeWidth={2.5} fill="url(#shipmentFill)" activeDot={{ r: 5, fill: "#719650", stroke: "white", strokeWidth: 3 }} />
    </AreaChart>
  </ResponsiveContainer>;
}
