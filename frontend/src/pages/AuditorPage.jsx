import { useEffect, useState } from 'react';
import api from '../services/api';

function AuditorPage({ selectedCompanyId, dataRefreshKey }) {
  const [submissions, setSubmissions] = useState([]);
  const [active, setActive] = useState(null);
  const [trail, setTrail] = useState([]);
  const [comment, setComment] = useState('');

  const load = async () => {
    const subRes = await api.get('/auditor/submissions');
    setSubmissions(subRes.data);
    if (selectedCompanyId) {
      const trailRes = await api.get(`/auditor/trail/${selectedCompanyId}`);
      setTrail(trailRes.data);
    }
  };

  useEffect(() => { load(); }, [selectedCompanyId, dataRefreshKey]);

  const openSubmission = async (id) => {
    const { data } = await api.get(`/auditor/submission/${id}`);
    setActive(data);
  };

  const addComment = async (field, flagged) => {
    if (!active || !comment) return;
    await api.post('/auditor/comment', {
      company_id: active.submission.company_id,
      data_type: active.submission.data_type,
      data_id: active.submission.id,
      comment: `${field}: ${comment}`,
      flagged,
    });
    setComment('');
    load();
  };

  const approve = async () => {
    if (!active) return;
    await api.put(`/auditor/approve/${active.submission.id}`);
    load();
    window.alert('Submission approved');
  };

  const entries = Object.entries(active?.raw_data || {}).filter(([k]) => !['id', 'company_id', 'month', 'year', 'created_at'].includes(k));

  return (
    <div className="auditor-layout">
      <section className="card">
        <h3>Data Submissions</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Company</th><th>Month</th><th>Type</th><th>Status</th></tr></thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} onClick={() => openSubmission(s.id)} className="clickable-row">
                  <td>{s.company_name}</td>
                  <td>{String(s.month).padStart(2, '0')}/{s.year}</td>
                  <td>{s.data_type}</td>
                  <td>{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>Submission Detail</h3>
        {!active && <p className="muted">Select a submission from the left panel.</p>}
        {active && (
          <>
            <div className="stack-md">
              {entries.map(([k, v]) => (
                <div key={k} className="field-comment">
                  <div className="row between"><strong>{k}</strong><span>{String(v)}</span></div>
                  <div className="row gap">
                    <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Auditor comment" />
                    <button className="btn btn-light" onClick={() => addComment(k, false)}>Comment</button>
                    <button className="btn btn-light" onClick={() => addComment(k, true)}>Flag</button>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn" onClick={approve}>Approve Submission</button>
          </>
        )}

        <h4>Audit Trail</h4>
        <div className="trail-list">
          {trail.map((t) => (
            <div className="trail-item" key={t.id}>
              <strong>{t.flagged ? 'FLAGGED' : 'COMMENT'}</strong>
              <p>{t.comment}</p>
              <small>{new Date(t.created_at).toLocaleString()}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default AuditorPage;
