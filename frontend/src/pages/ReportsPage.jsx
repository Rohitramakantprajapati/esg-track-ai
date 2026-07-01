import { useEffect, useState } from 'react';
import CompanySelector from '../components/CompanySelector';
import api, { ensureAuthToken } from '../services/api';

const sections = [
  'ESG Scorecard',
  'Environmental Analysis',
  'Social Analysis',
  'Governance Analysis',
  'Auditor Sign-off',
  'Recommendations',
];

function ReportsPage({ companies, selectedCompanyId, setSelectedCompanyId, dataRefreshKey, lastDataUpdate }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [history, setHistory] = useState([]);
  const [statusMsg, setStatusMsg] = useState('');

  const loadHistory = async () => {
    if (!selectedCompanyId) return;
    const { data } = await api.get(`/reports/history/${selectedCompanyId}`);
    setHistory(data);
  };

  useEffect(() => { loadHistory(); }, [selectedCompanyId, dataRefreshKey, lastDataUpdate]);

  useEffect(() => {
    if (!lastDataUpdate || lastDataUpdate.companyId !== selectedCompanyId) return;
    setMonth(lastDataUpdate.month);
    setYear(lastDataUpdate.year);
  }, [lastDataUpdate, selectedCompanyId]);

  const openReport = async () => {
    if (!selectedCompanyId) return;

    try {
      setStatusMsg('Generating report...');
      await ensureAuthToken();

      const response = await api.get(`/reports/generate/${selectedCompanyId}/${month}/${year}`, {
        responseType: 'blob',
      });

      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      setStatusMsg(`Report generated for ${String(month).padStart(2, '0')}/${year}.`);
      setTimeout(loadHistory, 800);
    } catch (error) {
      const detail = error?.response?.status === 404
        ? `No complete ESG data is available for ${String(month).padStart(2, '0')}/${year} yet.`
        : 'Unable to generate the report right now.';
      setStatusMsg(detail);
    }
  };

  return (
    <div className="stack-lg">
      <div className="card">
        <h2>Reports</h2>
        <div className="row gap wrap">
          <CompanySelector companies={companies} value={selectedCompanyId} onChange={setSelectedCompanyId} />
          <input className="input" type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} />
          <input className="input" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          <button className="btn" onClick={openReport}>Generate Report</button>
          <button className="btn btn-light" onClick={openReport}>Download PDF</button>
        </div>
        {statusMsg && <p className="muted" style={{ marginTop: 10 }}>{statusMsg}</p>}
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
                  <td>
                    <button
                      className="link-button"
                      onClick={async () => {
                        try {
                          setStatusMsg('Preparing historical report...');
                          await ensureAuthToken();
                          const response = await api.get(`/reports/generate/${h.company_id}/${h.month}/${h.year}`, {
                            responseType: 'blob',
                          });
                          const blobUrl = window.URL.createObjectURL(response.data);
                          const link = document.createElement('a');
                          link.href = blobUrl;
                          link.target = '_blank';
                          link.rel = 'noopener noreferrer';
                          link.click();
                          window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
                          setStatusMsg(`Report opened for ${String(h.month).padStart(2, '0')}/${h.year}.`);
                        } catch {
                          setStatusMsg(`No complete ESG report is available for ${String(h.month).padStart(2, '0')}/${h.year}.`);
                        }
                      }}
                    >
                      Download
                    </button>
                  </td>
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
