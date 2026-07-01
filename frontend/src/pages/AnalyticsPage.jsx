import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import CompanySelector from '../components/CompanySelector';
import api from '../services/api';

function Progress({ label, value }) {
  return (
    <div className="progress-block">
      <div className="row between"><span>{label}</span><strong>{value}</strong></div>
      <div className="progress-bg"><div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    </div>
  );
}

function AnalyticsPage({ companies, selectedCompanyId, setSelectedCompanyId, dataRefreshKey, lastDataUpdate }) {
  const now = new Date();
  const [startMonth, setStartMonth] = useState(Math.max(1, now.getMonth() - 2));
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [endMonth, setEndMonth] = useState(now.getMonth() + 1);
  const [endYear, setEndYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);

  const load = async () => {
    if (!selectedCompanyId) return;
    const res = await api.get(`/analytics/${selectedCompanyId}`, {
      params: { start_month: startMonth, start_year: startYear, end_month: endMonth, end_year: endYear },
    });
    setData(res.data);
  };

  useEffect(() => {
    load();
  }, [selectedCompanyId, dataRefreshKey]);

  useEffect(() => {
    if (!lastDataUpdate || lastDataUpdate.companyId !== selectedCompanyId) return;
    const updateStartMonth = Math.max(1, lastDataUpdate.month - 2);
    const updateStartYear = lastDataUpdate.year;
    const updateEndMonth = lastDataUpdate.month;
    const updateEndYear = lastDataUpdate.year;

    setEndMonth(updateEndMonth);
    setEndYear(updateEndYear);
    setStartMonth(updateStartMonth);
    setStartYear(updateStartYear);

    (async () => {
      if (!selectedCompanyId) return;
      const res = await api.get(`/analytics/${selectedCompanyId}`, {
        params: {
          start_month: updateStartMonth,
          start_year: updateStartYear,
          end_month: updateEndMonth,
          end_year: updateEndYear,
        },
      });
      setData(res.data);
    })();
  }, [lastDataUpdate, selectedCompanyId]);

  return (
    <div className="stack-lg">
      <div className="card">
        <div className="row gap wrap">
          <CompanySelector companies={companies} value={selectedCompanyId} onChange={setSelectedCompanyId} />
          <input className="input" type="number" value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))} min={1} max={12} />
          <input className="input" type="number" value={startYear} onChange={(e) => setStartYear(Number(e.target.value))} />
          <input className="input" type="number" value={endMonth} onChange={(e) => setEndMonth(Number(e.target.value))} min={1} max={12} />
          <input className="input" type="number" value={endYear} onChange={(e) => setEndYear(Number(e.target.value))} />
          <button className="btn" onClick={load}>Apply Range</button>
        </div>
      </div>

      <div className="card">
        <h3>ESG Breakdown</h3>
        <Progress label="Environmental" value={data?.breakdown?.e_score || 0} />
        <Progress label="Social" value={data?.breakdown?.s_score || 0} />
        <Progress label="Governance" value={data?.breakdown?.g_score || 0} />
      </div>

      <div className="card">
        <h3>Gap Analysis</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Metric</th><th>Actual</th><th>Benchmark</th><th>Gap %</th><th>Status</th></tr></thead>
            <tbody>
              {(data?.gap_analysis || []).map((g) => (
                <tr key={g.metric}>
                  <td>{g.metric}</td><td>{g.actual}</td><td>{g.benchmark}</td><td>{g.difference_pct}%</td>
                  <td className={g.status === 'good' ? 'good' : 'bad'}>{g.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h3>Recommendations</h3>
          <ol className="ordered-list">
            {(data?.recommendations || []).map((r, idx) => (
              <li key={idx}>{r.recommendation} to {r.estimated_impact}</li>
            ))}
          </ol>
        </section>
        <section className="card">
          <h3>Peer Comparison</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data?.peer_comparison || []}>
                <CartesianGrid stroke="#e7ece8" strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="score" fill="#1A5C38" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="card">
        <h3>Month Over Month</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Month</th><th>Score</th><th>Change</th><th>%</th></tr></thead>
            <tbody>
              {(data?.trend_table || []).map((row) => (
                <tr key={`${row.year}-${row.month}`}>
                  <td>{String(row.month).padStart(2, '0')}/{row.year}</td>
                  <td>{row.score}</td>
                  <td>{row.direction === 'up' ? '▲' : '▼'} {row.change}</td>
                  <td>{row.change_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPage;
