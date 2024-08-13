import React, { useEffect, useState } from "react";
import ForgeReconciler, {
  Text,
  useProductContext,
  StackBarChart,
  Select,
  TextArea,
  Button,
  Icon,
  Form,
  FormSection,
  FormFooter,
  Label,
  Textfield,
  RequiredAsterisk,
  useForm
} from "@forge/react";
import { requestJira, invoke, view } from '@forge/bridge';
import moment from 'moment';
import { TrashIcon } from '@primer/octicons-react';

function editList(arrayList) {
  const sonuc = {};

  arrayList.forEach(([tarih, sayi, kategori]) => {
    const key = `${tarih}-${kategori}`;

    if (!sonuc[key]) {
      sonuc[key] = [tarih, sayi, kategori];
    } else {
      sonuc[key][1] += sayi;
    }
  });

  return Object.values(sonuc);
}

const FetchOpenIssues = async (jql) => {
  try {
    const response = await requestJira(`/rest/api/3/search?jql=${encodeURIComponent(jql)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error fetching issues: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.issues;
  } catch (error) {
    console.error(error);
    return [];
  }
};

const FetchIssueTypes = async () => {
  try {
    const response = await requestJira('/rest/api/3/issuetype', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error fetching issue types: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    return [];
  }
};

const FetchProjectFields = async (jql) => {
  try {
    const issues = await FetchOpenIssues(jql);
    console.log(issues);
    const fieldsSet = new Set();

    issues.forEach(issue => {
      Object.keys(issue.fields).forEach(field => {
        if (issue.fields[field] !== null && issue.fields[field] !== undefined) {
          fieldsSet.add(field);
        }
      });
    });

    const fields = Array.from(fieldsSet);
    console.log(fields); // Alanları konsola yazdır
    return fields;
  } catch (error) {
    console.error(error);
    return [];
  }
};

const FilterByInterval = (data, interval) => {
  const now = moment();
  return data.filter(([created]) => {
    const createdDate = moment(created);
    switch (interval) {
      case 'daily':
        return createdDate.isSame(now, 'day');
      case 'weekly':
        return createdDate.isSame(now, 'week');
      case 'monthly':
        return createdDate.isSame(now, 'month');
      case 'quarterly':
        return createdDate.isSame(now, 'quarter');
      case 'yearly':
        return createdDate.isSame(now, 'year');
      default:
        return true;
    }
  });
};

const GetDateRangeText = (interval) => {
  const now = moment();
  let startDate, endDate;

  switch (interval) {
    case 'daily':
      startDate = now.startOf('day');
      endDate = now.endOf('day');
      break;
    case 'weekly':
      startDate = now.startOf('week');
      endDate = now.endOf('week');
      break;
    case 'monthly':
      startDate = now.startOf('month');
      endDate = now.endOf('month');
      break;
    case 'quarterly':
      startDate = now.startOf('quarter');
      endDate = now.endOf('quarter');
      break;
    case 'yearly':
      startDate = now.startOf('year');
      endDate = now.endOf('year');
      break;
    default:
      startDate = now;
      endDate = now;
  }

  return `${startDate.format('DD-MM-YYYY')} - ${endDate.format('DD-MM-YYYY')}`;
};

const Chart = ({ jql, field, interval }) => {
  const [data1, setData1] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const extractData = async () => {
      try {
        const issues = await FetchOpenIssues(jql);
        const newData = [];

        for (let i = 0; i < issues.length; i++) {
          if (field && issues[i].fields[field]) {
            const fieldData = Array.isArray(issues[i].fields[field])
              ? issues[i].fields[field]
              : [issues[i].fields[field]];

            for (let j = 0; j < fieldData.length; j++) {
              newData.push([issues[i].fields.created.split('T')[0], 1, fieldData[j]]);
            }
          }
        }

        const filteredData = FilterByInterval(newData, interval);
        setData1(filteredData);
        setError(null); // Clear any previous error
      } catch (error) {
        setError(error.message);
        setData1([]);
      }
    };

    if (jql && field) {
      extractData();
    }
  }, [jql, field, interval]);

  if (error) {
    return <Text>Error: {error}</Text>;
  }

  return (
    <>
      <StackBarChart
        data={editList(data1)}
        xAccessor={0}
        yAccessor={1}
        colorAccessor={2}
      />
      <Text>{`Selected Date Range: ${GetDateRangeText(interval)}`}</Text>
    </>
  );
};

const Projects = ({ selectionHandler }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const projectsData = await invoke('fetchProjects', {});
        setProjects(projectsData);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const options = projects.map(project => ({
    label: project.name,
    value: project.key,
  }));

  if (loading) {
    return <Text>Loading projects...</Text>;
  }

  return (
    <Select
      appearance="default"
      label="Select Project"
      options={options}
      onChange={(e) => selectionHandler(e.value)}
    />
  );
};

const IssueTypeSelect = ({ projectKey, selectionHandler }) => {
  const [issueTypes, setIssueTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIssueTypes = async () => {
      if (!projectKey) return;
      try {
        const issueTypesData = await FetchIssueTypes();
        const uniqueTypes = [...new Set(issueTypesData.map(type => type.name))];
        const options = uniqueTypes.map(type => ({
          label: type,
          value: type,
        }));
        setIssueTypes(options);
      } catch (error) {
        console.error('Error fetching issue types:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchIssueTypes();
  }, [projectKey]);

  if (loading) {
    return <Text>Loading issue types...</Text>;
  }

  return (
    <Select
      appearance="default"
      label="Select Issue Type"
      options={issueTypes}
      onChange={(e) => selectionHandler(e.value)}
    />
  );
};

const JQLInput = ({ jql, setJql }) => (
  <TextArea
    label="Enter JQL Query"
    value={jql}
    onChange={(e) => setJql(e.target.value)}
    placeholder="Enter your JQL query here"
  />
);

const IntervalSelect = ({ selectedInterval, setSelectedInterval }) => {
  const options = [
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
    { label: 'Quarterly', value: 'quarterly' },
    { label: 'Yearly', value: 'yearly' }
  ];

  return (
    <Select
      appearance="default"
      label="Select Interval"
      options={options}
      onChange={(e) => setSelectedInterval(e.value)}
      defaultValue="monthly" // Monthly seçeneğinin varsayılan olarak seçili olması için
    />
  );
};

const FetchPrioritiesFromIssues = async (jql) => {
  try {
    const issues = await FetchOpenIssues(jql);
    const prioritySet = new Set();

    issues.forEach(issue => {
      if (issue.fields.priority && issue.fields.priority.name) {
        prioritySet.add(issue.fields.priority.name);
      }
    });

    return Array.from(prioritySet);
  } catch (error) {
    console.error('Error fetching priorities from issues:', error);
    return [];
  }
};

const PrioritySelect = ({ jql, selectionHandler }) => {
  const [priorities, setPriorities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPriorities = async () => {
      if (!jql) return;
      try {
        const priorityData = await FetchPrioritiesFromIssues(jql);
        const options = priorityData.map(priority => ({
          label: priority,
          value: priority,
        }));
        setPriorities(options);
      } catch (error) {
        console.error('Error fetching priorities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPriorities();
  }, [jql]);

  if (loading) {
    return <Text>Loading priorities...</Text>;
  }

  return (
    <Select
      appearance="default"
      label="Select Priority"
      options={priorities}
      onChange={(e) => selectionHandler(e.value)}
    />
  );
};

const FieldSelect = ({ jql, selectionHandler, setNestedField, setHasNestedFields }) => {
  const [fields, setFields] = useState([]);
  const [nestedFields, setNestedFields] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFields = async () => {
      if (!jql) return;
      try {
        const fieldsData = await FetchProjectFields(jql);
        const options = fieldsData.map(field => ({
          label: field,
          value: field,
        }));
        setFields(options);
      } catch (error) {
        console.error('Error fetching fields:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFields();
  }, [jql]);

  const handleFieldChange = (field) => {
    selectionHandler(field);

    // Seçilen alanın döndürdüğü değeri kontrol et
    const selectedFieldData = fields.find(f => f.value === field);
    const sampleIssue = selectedFieldData && selectedFieldData.sampleIssue; // Örnek issue'dan değer alındığını varsayıyorum

    if (sampleIssue && typeof sampleIssue === 'object' && !Array.isArray(sampleIssue)) {
      // Alan bir nesne (object) döndürüyor, nested özellikler var
      const nestedFields = Object.keys(sampleIssue).filter(key => 
        typeof sampleIssue[key] === 'string' // Örneğin name, key, vb. özellikler için
      );

      if (nestedFields.length > 0) {
        const nestedOptions = nestedFields.map(nField => ({
          label: nField,
          value: nField,
        }));
        setNestedFields(nestedOptions);
        setHasNestedFields(true); // Nested fields var
      } else {
        setNestedFields([]);
        setHasNestedFields(false); // Nested fields yok
      }
    } else if (typeof sampleIssue === 'string') {
      // Alan basit bir veri türü (string) döndürüyor
      setHasNestedFields(false); // Nested fields yok
    } else {
      setNestedFields([]);
      setHasNestedFields(false); // Basit veri türü, nested fields yok
    }
  };

  if (loading) {
    return <Text>Loading fields...</Text>;
  }

  return (
    <>
      <Select
        appearance="default"
        label="Select Field"
        options={fields}
        onChange={(e) => handleFieldChange(e.value)}
      />
      {nestedFields.length > 0 && (
        <Select
          appearance="default"
          label="Select Nested Field"
          options={nestedFields}
          onChange={(e) => setNestedField(e.value)}
        />
      )}
    </>
  );
};

const App = () => {
  const context = useProductContext();
  const [selectedProject, setSelectedProject] = useState(() => localStorage.getItem('selectedProject') || '');
  const [selectedIssueType, setSelectedIssueType] = useState(() => localStorage.getItem('selectedIssueType') || '');
  const [selectedField, setSelectedField] = useState(() => localStorage.getItem('selectedField') || '');
  const [nestedField, setNestedField] = useState(() => localStorage.getItem('nestedField') || '');
  const [jql, setJql] = useState(() => localStorage.getItem('jql') || 'project = GTMS');
  const [selectedInterval, setSelectedInterval] = useState(() => localStorage.getItem('selectedInterval') || 'monthly');
  const [hasNestedFields, setHasNestedFields] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPriority, setSelectedPriority] = useState(() => localStorage.getItem('selectedPriority') || '');
  const [showConfig, setShowConfig] = useState(false);
  const [showChart, setShowChart] = useState(false);

  useEffect(() => {
    setNestedField(null);
  }, [selectedProject]);

  useEffect(() => {
    if (selectedProject) localStorage.setItem('selectedProject', selectedProject);
    if (selectedIssueType) localStorage.setItem('selectedIssueType', selectedIssueType);
    if (selectedField) localStorage.setItem('selectedField', selectedField);
    if (nestedField) localStorage.setItem('nestedField', nestedField);
    if (jql) localStorage.setItem('jql', jql);
    if (selectedInterval) localStorage.setItem('selectedInterval', selectedInterval);
    if (selectedPriority) localStorage.setItem('selectedPriority', selectedPriority);
  }, [selectedProject, selectedIssueType, selectedField, nestedField, jql, selectedInterval, selectedPriority]);

  useEffect(() => {
    if (selectedProject && selectedIssueType) {
      let jqlQuery = `project = ${selectedProject} AND statusCategory != Done AND issuetype = ${selectedIssueType}`;
      if (selectedPriority) {
        jqlQuery += ` AND priority = "${selectedPriority}"`;
      }
      setJql(jqlQuery);
      setError(null);
    } else {
      setJql('');
      setError('Please select a project, issue type, and priority.');
    }
  }, [selectedProject, selectedIssueType, selectedPriority]);

  const shouldRenderChart = jql && selectedField && (!hasNestedFields || nestedField);

  const clearLocalStorage = () => {
    localStorage.clear();
    setSelectedProject('');
    setSelectedIssueType('');
    setSelectedField('');
    setNestedField('');
    setJql('');
    setSelectedInterval('monthly');
    setSelectedPriority('');
  };

  if (!context) {
    return "Loading...";
  }

  return (
    <>
      <Button shouldFitContainer appearance="primary" onClick={() => setShowConfig(!showConfig)}>Seçenekleri göster</Button>

      {showConfig && (
        <>
          <Projects selectionHandler={setSelectedProject} />
          {selectedProject && <IssueTypeSelect projectKey={selectedProject} selectionHandler={setSelectedIssueType} />}
          {jql && <FieldSelect jql={jql} selectionHandler={setSelectedField} setNestedField={setNestedField} setHasNestedFields={setHasNestedFields} />}
          {selectedField && jql && <PrioritySelect jql={jql} selectionHandler={setSelectedPriority} />}
          <IntervalSelect selectedInterval={selectedInterval} setSelectedInterval={setSelectedInterval} />
          <JQLInput jql={jql} setJql={setJql} />
        </>
      )}

      <Button shouldFitContainer appearance="primary" onClick={() => setShowChart(!showChart)}>Grafiği Göster</Button>
      
      {error ? <Text>{error}</Text> : (showChart && shouldRenderChart && <Chart jql={jql} field={nestedField || selectedField} interval={selectedInterval} />)}

      <Button shouldFitContainer appearance="danger" onClick={clearLocalStorage} iconBefore={<Icon component={TrashIcon} />}>
        Verileri Temizle
      </Button>
    </>
  );
};

// Edit component
export const Edit = () => {
  const { handleSubmit, register, getFieldId } = useForm();

  const configureGadget = (data) => {
    view.submit({
      username: data.username,
    });
  };

  return (
    <Form onSubmit={handleSubmit(configureGadget)}>
      <FormSection>
        <Label labelFor={getFieldId('username')}>
          Username
          <RequiredAsterisk />
        </Label>
        <Textfield {...register('username', { required: true })} />
      </FormSection>
      <FormFooter>
        <Button appearance="primary" type="submit">
          Submit
        </Button>
      </FormFooter>
    </Form>
  );
};

const View = () => {
  const context = useProductContext();

  if (!context) {
    return "Loading...";
  }

  const { extension: { gadgetConfiguration } } = context;

  return (
    <>
      <Text>Username: {gadgetConfiguration.username}</Text>
      <App />
    </>
  );
};

const AppWrapper = () => {
  const context = useProductContext();
  if (!context) {
    return "Loading...";
  }

  return context.extension.entryPoint === "edit" ? <Edit /> : <View />;
};

ForgeReconciler.render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
);
