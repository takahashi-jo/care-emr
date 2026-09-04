import dayjs from 'dayjs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { VitalSign } from '../types';

// バイタルの推移グラフ（項目別スモールマルチプル）。
// recharts は重いため、このコンポーネントを VitalsManager 側で React.lazy 遅延ロードし、
// 「推移」タブを開いたときだけ読み込む（初期バンドルを軽く保つ）。
const VitalsTrend = ({ vitals }: { vitals: VitalSign[] }) => {
  // 古い→新しいの時系列。未測定は null（connectNulls で橋渡し）
  const chartData = [...vitals].reverse().map((v) => ({
    label: dayjs(v.measuredAt).format('M/D'),
    temperature: v.temperature ?? null,
    systolicBP: v.systolicBP ?? null,
    diastolicBP: v.diastolicBP ?? null,
    pulse: v.pulse ?? null,
    spo2: v.spo2 ?? null,
    weight: v.weight ?? null,
    bloodGlucose: v.bloodGlucose ?? null,
  }));

  const metrics: { key: string; title: string; unit: string; lines: { dataKey: string; name: string; color: string }[] }[] = [
    { key: 'temperature', title: '体温', unit: '℃', lines: [{ dataKey: 'temperature', name: '体温', color: '#2f5b95' }] },
    { key: 'bp', title: '血圧', unit: 'mmHg', lines: [
        { dataKey: 'systolicBP', name: '収縮期', color: '#2f5b95' },
        { dataKey: 'diastolicBP', name: '拡張期', color: '#90b4dd' },
      ] },
    { key: 'pulse', title: '脈拍', unit: '/分', lines: [{ dataKey: 'pulse', name: '脈拍', color: '#2f5b95' }] },
    { key: 'spo2', title: 'SpO₂', unit: '%', lines: [{ dataKey: 'spo2', name: 'SpO₂', color: '#2f5b95' }] },
    { key: 'weight', title: '体重', unit: 'kg', lines: [{ dataKey: 'weight', name: '体重', color: '#2f5b95' }] },
    { key: 'bloodGlucose', title: '血糖', unit: 'mg/dL', lines: [{ dataKey: 'bloodGlucose', name: '血糖', color: '#2f5b95' }] },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {metrics.map((m) => (
        <div key={m.key} className="border border-gray-200 rounded-lg p-3">
          <div className="flex items-baseline gap-2 mb-2">
            <h4 className="text-sm font-semibold text-gray-800">{m.title}</h4>
            <span className="text-xs text-gray-400">{m.unit}</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 5, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} minTickGap={16} />
              <YAxis domain={['auto', 'auto']} width={40} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              {m.lines.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
              {m.lines.map((l) => (
                <Line
                  key={l.dataKey}
                  type="monotone"
                  dataKey={l.dataKey}
                  name={l.name}
                  stroke={l.color}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
};

export default VitalsTrend;
