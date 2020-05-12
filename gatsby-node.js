const fetch = require('node-fetch');
const reporter = require('gatsby-cli/lib/reporter');

const API_VERSION = '2019-05-06';

const getHeaders = ({ apiKey }) => {
  return {
    'api-key': apiKey,
    'Content-Type': 'application/json',
  };
};

const putIndex = async (
  {
    serviceName,
    apiKey,
    indexConfig,
    verbose = false,
  }
  ) => {
  const url = `https://${serviceName}.search.windows.net/indexes/${indexConfig.name}?api-version=${API_VERSION}`;
  const body = indexConfig;
  const headers = getHeaders({ apiKey });
  if (verbose) {
    reporter.info(`Input to put index:`);
    reporter.log(url);
    reporter.log(JSON.stringify(body));
    reporter.log(JSON.stringify(headers));
  }
  return fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  }).then(res => {
    reporter.info(`Response status: ${res.status}`);
    reporter.info(`Created index: ${indexConfig.name}`);
  });
};

const indexDocuments = ({ serviceName, apiKey, indexName, docs, verbose, }) => {
  const url = `https://${serviceName}.search.windows.net/indexes/${indexName}/docs/index?api-version=${API_VERSION}`;
  const body = {
    value: docs,
  };
  const headers = getHeaders({ apiKey });
  if (verbose) {
    reporter.info(`Input to index document:`);
    reporter.log(url);
    reporter.log(JSON.stringify(headers));
  }
  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }).then(res => res.json())
    .then(res => {
      reporter.info(`Response: ${JSON.stringify(res)}`);
      reporter.log(JSON.stringify(res));
      reporter.info(`Indexed documents to: ${indexName}`);
    });
};

const identity = () => {};

const doQuery = async (
  {
    graphql, queryIndex, query, transformer = identity,
    serviceName, apiKey, indexName, verbose,
  }
  ) => {
  if (!query) {
    reporter.panic(`Please specify "query"`);
  }

  reporter.info(`Query ${queryIndex}: running graphql query`);
  const result = await graphql(query);
  if (result.errors) {
    reporter.panic(`Failed to run graphql query`, result.errors);
  }

  reporter.info(`Query ${queryIndex}: running transformer`);
  const docs = await transformer(result);

  reporter.info(`Query ${queryIndex}: generated ${docs.length} documents`);
  reporter.info(`Query ${queryIndex}: indexing documents`);

  return indexDocuments({
    serviceName,
    apiKey,
    indexName,
    docs,
    verbose,
  });
};

exports.onPostBuild = async function(
  { graphql },
  {
    serviceName, apiKey, indexConfig, queries,
    verbose = false
  }
    ) {

  const activity = reporter.activityTimer('Index to Azure Search');
  activity.start();

  reporter.info(`Validating inputs`);

  reporter.info(`Create or update index ${indexConfig.name}`);
  await putIndex({
    serviceName,
    apiKey,
    indexConfig,
    verbose,
  });


  reporter.info(`${queries.length} queries to index`);
  const jobs = queries.map((query, queryIndex) => doQuery({
    ...query,
    queryIndex,
    graphql,
    activity,
    serviceName,
    apiKey,
    indexName: indexConfig.name,
    verbose,
  }));

  try {
    await Promise.all(jobs);
  } catch (e) {
    reporter.panic(`Failed to index to Azure Search`, e);
  }

  activity.end();
};
