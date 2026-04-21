import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

function ScoreGauge({ score = 0 }) {
  const normalized = Math.max(0, Math.min(100, score));
  const data = [
    { name: 'score', value: normalized },
    { name: 'rest', value: 100 - normalized },
  ];

  return (
    <div className="gauge-card">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={68}
            outerRadius={92}
            startAngle={225}
            endAngle={-45}
            stroke="none"
          >
            <Cell fill="#1A5C38" />
            <Cell fill="#E4E8E6" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="gauge-number">{normalized.toFixed(1)}</div>
      <div className="gauge-label">Total ESG Score</div>
    </div>
  );
}

export default ScoreGauge;
