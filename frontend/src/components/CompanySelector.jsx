function CompanySelector({ companies, value }) {
  const active = companies.find((company) => company.id === value) || companies[0];

  return (
    <div className="input" aria-label="Active company">
      {active?.name || 'Company'}
    </div>
  );
}

export default CompanySelector;
