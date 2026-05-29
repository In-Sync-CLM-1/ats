export function generateMandateTemplate() {
  const headers = [
    'job_title',
    'client_name',
    'minimum_qualification',
    'job_description',
    'job_location',
    'min_experience_years',
    'max_experience_years',
    'min_ctc_lakhs',
    'max_ctc_lakhs',
    'notice_period_acceptable'
  ];
  
  const dataTypes = [
    'Text (Required)',
    'Text (Required - Must match existing client)',
    'Text (Required)',
    'Text (Required)',
    'Text (Required)',
    'Number (Optional, Default: 0)',
    'Number (Optional, Default: 0)',
    'Number (Optional, Default: 0)',
    'Number (Optional, Default: 0)',
    'Number (Optional, Default: 30)'
  ];
  
  const sampleData = [
    'Senior Software Engineer',
    'Acme Corporation',
    'B.Tech in Computer Science',
    'Develop and maintain web applications using React and Node.js. Lead a team of 3-5 developers.',
    'Bangalore, Karnataka',
    '5',
    '8',
    '15',
    '25',
    '60'
  ];
  
  const rows = [headers, dataTypes, sampleData];
  const csvContent = rows.map(row => 
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mandates-import-template-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
