import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import CompanySelector from '../components/CompanySelector';
import ScoreGauge from '../components/ScoreGauge';
import api from '../services/api';

const monthLabel = (m, y) => `${String(m).padStart(2, '0')}/${y}`;

function DashboardPage({ companies, selectedCompanyId, setSelectedCompanyId, refreshCompanies, dataRefreshKey }) {
  const [scoreData, setScoreData] = useState(null);
  const [alerts, setAlerts] = useState([]);

  const loadDashboard = async () => {
    if (!selectedCompanyId) return;
    const [scoresRes, alertsRes] = await Promise.all([
      api.get(`/scores/${selectedCompanyId}`),
      api.get(`/alerts/${selectedCompanyId}`),
    ]);
    setScoreData(scoresRes.data);
    setAlerts(alertsRes.data.slice(0, 6));
  };

  useEffect(() => {
    loadDashboard();
  }, [selectedCompanyId, dataRefreshKey]);

  const trendData = useMemo(() => {
    const rows = scoreData?.monthly_scores || [];
    return rows.slice(-12).map((x) => ({
      label: monthLabel(x.month, x.year),
      ESG: x.total_score,
    }));
  }, [scoreData]);

  const currentBreakdown = useMemo(() => {
    if (!scoreData?.current) return [];
    return [
      { name: 'E', score: scoreData.current.e_score },
      { name: 'S', score: scoreData.current.s_score },
      { name: 'G', score: scoreData.current.g_score },
    ];
  }, [scoreData]);

  const addCompany = async () => {
    const name = window.prompt('Company Name');
    if (!name) return;
    const industry = window.prompt('Industry', 'Technology') || 'Technology';
    const size = Number(window.prompt('Company Size', '1000') || 1000);
    await api.post('/companies', { name, industry, size });
    await refreshCompanies();
  };

  return (
    <div className="dashboard-grid">
      <section className="card card-span-2">
        <div className="row between gap">
          <h2>Home Dashboard</h2>
          <div className="row gap">
            <CompanySelector
              companies={companies}
              value={selectedCompanyId}
              onChange={setSelectedCompanyId}
            />
            <button className="btn" onClick={addCompany}>Add New Company</button>
          </div>
        </div>

        <div className="metrics-layout">
          <ScoreGauge score={scoreData?.current?.total_score || 0} />
          <div className="mini-cards">
            <div className="stat-card"><h4>E Score</h4><p>{scoreData?.current?.e_score ?? '-'}</p></div>
            <div className="stat-card"><h4>S Score</h4><p>{scoreData?.current?.s_score ?? '-'}</p></div>
            <div className="stat-card"><h4>G Score</h4><p>{scoreData?.current?.g_score ?? '-'}</p></div>
          </div>
        </div>
      </section>

      <aside className="card">
        <h3>Recent Alerts</h3>
        <div className="alerts-list">
          {alerts.length === 0 && <p className="muted">No alerts</p>}
          {alerts.map((a) => (
            <div className="alert-item" key={a.id}>
              <span className={`dot ${a.severity}`} />
              <div>
                <p>{a.message}</p>
                <small>{new Date(a.created_at).toLocaleString()}</small>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="card card-span-2">
        <h3>ESG Trend (12 Months)</h3>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid stroke="#e7ece8" strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="ESG" stroke="#1A5C38" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card">
        <h3>Current Month E/S/G</h3>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={currentBreakdown}>
              <CartesianGrid stroke="#e7ece8" strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="score" fill="#1A5C38" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card card-span-3">
        <h3>Quick Stats</h3>
        <div className="quick-grid">
          <div className="quick-item">
            <small>Total Carbon This Year</small>
            <strong>{scoreData?.quick_stats?.total_carbon_this_year ?? 0} tonnes</strong>
          </div>
          <div className="quick-item">
            <small>Water Saved</small>
            <strong>{scoreData?.quick_stats?.water_saved ?? 0} litres</strong>
          </div>
          <div className="quick-item">
            <small>Safety Score</small>
            <strong>{scoreData?.quick_stats?.safety_score ?? 0}</strong>
          </div>
          <div className="quick-item">
            <small>Board Diversity %</small>
            <strong>{scoreData?.quick_stats?.board_diversity_pct ?? 0}%</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
