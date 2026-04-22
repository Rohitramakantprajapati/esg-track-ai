function CompanySelector({ companies, value, onChange }) {
  return (
    <select className="input" value={value || ''} onChange={(e) => onChange(Number(e.target.value))}>
      <option value="">Select Company</option>
      {companies.map((company) => (
        <option key={company.id} value={company.id}>
          {company.name}
        </option>
      ))}
    </select>
  );
}

export default CompanySelector;
