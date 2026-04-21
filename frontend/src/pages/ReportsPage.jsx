import { useEffect, useState } from 'react';
import CompanySelector from '../components/CompanySelector';
import api from '../services/api';

const sections = [
  'ESG Scorecard',
  'Environmental Analysis',
  'Social Analysis',
  'Governance Analysis',
  'Auditor Sign-off',
  'Recommendations',
];

function ReportsPage({ companies, selectedCompanyId, setSelectedCompanyId, refreshTick }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [history, setHistory] = useState([]);

  const loadHistory = async () => {
    if (!selectedCompanyId) return;
    const { data } = await api.get(`/reports/history/${selectedCompanyId}`);
    setHistory(data);
  };

  useEffect(() => { loadHistory(); }, [selectedCompanyId, refreshTick]);

  const generate = async () => {
    if (!selectedCompanyId) return;
    const url = `${api.defaults.baseURL}/reports/generate/${selectedCompanyId}/${month}/${year}`;
    window.open(url, '_blank');
    setTimeout(loadHistory, 800);
  };

  return (
    <div className="stack-lg">
      <div className="card">
        <h2>Reports</h2>
        <div className="row gap wrap">
          <CompanySelector companies={companies} value={selectedCompanyId} onChange={setSelectedCompanyId} />
          <input className="input" type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
          <input className="input" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          <button className="btn" onClick={generate}>Generate Report</button>
          <button className="btn btn-light" onClick={generate}>Download PDF</button>
        </div>
      </div>

      <div className="card">
        <h3>Report Preview Sections</h3>
        <ul className="plain-list">
          {sections.map((s) => <li key={s}>{s}</li>)}
        </ul>
      </div>

      <div className="card">
        <h3>Report History</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Month</th><th>Generated At</th><th>Download</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{String(h.month).padStart(2, '0')}/{h.year}</td>
                  <td>{new Date(h.generated_at).toLocaleString()}</td>
                  <td><a href={`${api.defaults.baseURL}/reports/generate/${h.company_id}/${h.month}/${h.year}`} target="_blank">Download</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;
