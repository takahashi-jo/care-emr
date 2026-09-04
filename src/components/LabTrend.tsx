import dayjs from 'dayjs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { LAB_ANALYTES, isLabAbnormal } from '../constants/labReference';
import type { LabResult } from '../types';

// 検査結果の推移グラフ（項目別スモールマルチプル）。データのある項目だけ表示。
// recharts は重いため LabResultsManager 側で React.lazy 遅延ロードする。
const LINE_COLOR = '#2f5b95';
const ABNORMAL_COLOR = '#a83d35';

const LabTrend = ({ labs }: { labs: LabResult[] }) => {
  const chrono = [...labs].reverse(); // 古い→新しい
  const present = LAB_ANALYTES.filter((a) => chrono.some((l) => l.items.some((it) => it.code === a.code)));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {present.map((a) => {
        const data = chrono.map((l) => {
          const it = l.items.find((i) => i.code === a.code);
          return { label: dayjs(l.collectedAt).format('M/D'), value: it ? it.value : null };
        });
        return (
          <div key={a.code} className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-baseline gap-2 mb-2">
              <h4 className="text-sm font-semibold text-gray-800">{a.name}</h4>
              {a.unit && <span className="text-xs text-gray-400">{a.unit}</span>}
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={data} margin={{ top: 5, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} minTickGap={16} />
                <YAxis domain={['auto', 'auto']} width={40} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                {a.refLow != null && (
                  <ReferenceLine y={a.refLow} stroke={ABNORMAL_COLOR} strokeDasharray="4 3" strokeOpacity={0.5} ifOverflow="extendDomain" />
                )}
                {a.refHigh != null && (
                  <ReferenceLine y={a.refHigh} stroke={ABNORMAL_COLOR} strokeDasharray="4 3" strokeOpacity={0.5} ifOverflow="extendDomain" />
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={LINE_COLOR}
                  strokeWidth={2}
                  connectNulls
                  isAnimationActive={false}
                  activeDot={{ r: 4 }}
                  dot={({ cx, cy, value, index }) => {
                    if (cx == null || cy == null || value == null) {
                      return <circle key={index} r={0} />;
                    }
                    const abn = isLabAbnormal(value as number, a.refLow, a.refHigh);
                    return (
                      <circle key={index} cx={cx} cy={cy} r={abn ? 3.4 : 2} fill={abn ? ABNORMAL_COLOR : LINE_COLOR} />
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
};

export default LabTrend;
