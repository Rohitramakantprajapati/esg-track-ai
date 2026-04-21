import { useEffect, useState } from 'react';
import CompanySelector from '../components/CompanySelector';
import api from '../services/api';

function AlertsPage({ companies, selectedCompanyId, setSelectedCompanyId, refreshTick }) {
  const [severity, setSeverity] = useState('all');
  const [alerts, setAlerts] = useState([]);

  const load = async () => {
    if (!selectedCompanyId) return;
    const { data } = await api.get(`/alerts/${selectedCompanyId}`, {
      params: severity === 'all' ? {} : { severity },
    });
    setAlerts(data);
  };

  useEffect(() => { load(); }, [selectedCompanyId, severity, refreshTick]);

  const markAsRead = async (id) => {
    await api.put(`/alerts/read/${id}`);
    load();
  };

  return (
    <div className="stack-lg">
      <div className="card">
        <h2>Alerts</h2>
        <div className="row gap wrap">
          <CompanySelector companies={companies} value={selectedCompanyId} onChange={setSelectedCompanyId} />
          {['all', 'info', 'warning', 'critical'].map((s) => (
            <button key={s} className={`btn ${severity === s ? '' : 'btn-light'}`} onClick={() => setSeverity(s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="alerts-list">
          {alerts.map((a) => (
            <div className={`alert-item ${a.is_read ? 'read' : ''}`} key={a.id}>
              <span className={`dot ${a.severity}`} />
              <div className="grow">
                <p><strong>[{a.severity.toUpperCase()}]</strong> {a.message}</p>
                <small>{new Date(a.created_at).toLocaleString()}</small>
              </div>
              {!a.is_read && <button className="btn btn-light" onClick={() => markAsRead(a.id)}>Mark as read</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AlertsPage;
