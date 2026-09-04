import dayjs from 'dayjs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts';
import type { VitalSign } from '../types';
import { isVitalAbnormal } from '../constants/vitalReference';

const ABNORMAL_COLOR = '#a83d35'; // 一覧の赤字と同じ muted red

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

  const metrics: { key: string; title: string; unit: string; thresholds?: number[]; lines: { dataKey: string; name: string; color: string; abnormal?: (v: number) => boolean }[] }[] = [
    { key: 'temperature', title: '体温', unit: '℃', thresholds: [37.5], lines: [{ dataKey: 'temperature', name: '体温', color: '#2f5b95', abnormal: isVitalAbnormal.temperature }] },
    { key: 'bp', title: '血圧', unit: 'mmHg', thresholds: [140, 90], lines: [
        { dataKey: 'systolicBP', name: '収縮期', color: '#2f5b95', abnormal: isVitalAbnormal.systolicBP },
        { dataKey: 'diastolicBP', name: '拡張期', color: '#90b4dd', abnormal: isVitalAbnormal.diastolicBP },
      ] },
    { key: 'pulse', title: '脈拍', unit: '/分', thresholds: [50, 100], lines: [{ dataKey: 'pulse', name: '脈拍', color: '#2f5b95', abnormal: isVitalAbnormal.pulse }] },
    { key: 'spo2', title: 'SpO₂', unit: '%', thresholds: [93], lines: [{ dataKey: 'spo2', name: 'SpO₂', color: '#2f5b95', abnormal: isVitalAbnormal.spo2 }] },
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
              {(m.thresholds ?? []).map((t) => (
                <ReferenceLine
                  key={t}
                  y={t}
                  stroke={ABNORMAL_COLOR}
                  strokeDasharray="4 3"
                  strokeOpacity={0.5}
                  ifOverflow="extendDomain"
                />
              ))}
              {m.lines.map((l) => (
                <Line
                  key={l.dataKey}
                  type="monotone"
                  dataKey={l.dataKey}
                  name={l.name}
                  stroke={l.color}
                  strokeWidth={2}
                  connectNulls
                  isAnimationActive={false}
                  activeDot={{ r: 4 }}
                  dot={({ cx, cy, value, index }) => {
                    // 未測定（null）は描画しない
                    if (cx == null || cy == null || value == null) {
                      return <circle key={index} r={0} />;
                    }
                    const abn = l.abnormal ? l.abnormal(value as number) : false;
                    return (
                      <circle
                        key={index}
                        cx={cx}
                        cy={cy}
                        r={abn ? 3.4 : 2}
                        fill={abn ? ABNORMAL_COLOR : l.color}
                      />
                    );
                  }}
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
