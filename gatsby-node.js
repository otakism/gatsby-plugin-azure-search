const fetch = require('node-fetch');
const reporter = require('gatsby-cli/lib/reporter');

const API_VERSION = '2019-05-06';

/**
 * Get common header to call Azure search REST APIs.
 * @param apiKey azure search admin key
 * @returns {{'api-key': *, 'Content-Type': string}}
 */
const getHeaders = ({ apiKey }) => {
  return {
    'api-key': apiKey,
    'Content-Type': 'application/json',
  };
};

/**
 * Create or update an search index.
 * @param serviceName azure search service name
 * @param apiKey azure search admin key
 * @param indexConfig specified in gatsby-config.js
 * @param verbose
 * @returns {Promise<*>}
 */
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

/**
 * Index an array of documents to Azure.
 * @param serviceName azure search service name
 * @param apiKey azure search admin key
 * @param indexName indexConfig.name
 * @param docs documents to index
 * @param verbose
 * @returns {*}
 */
const indexDocuments = ({ serviceName, apiKey, indexName, docs, verbose }) => {
  const url = `https://${serviceName}.search.windows.net/indexes/${indexName}/docs/index?api-version=${API_VERSION}`;
  const body = {
    value: docs,
  };
  const headers = getHeaders({ apiKey });
  if (verbose) {
    reporter.info(`Input to index document:`);
    reporter.log(url);
    reporter.log(JSON.stringify(body));
    reporter.log(JSON.stringify(headers));
  }
  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }).then(res => res.json())
    .then(res => {
      if (verbose) {
        reporter.info(`Azure response:`);
        reporter.log(JSON.stringify(res));
      }
      reporter.info(`Indexed documents to: ${indexName}`);
    });
};

/**
 * Default no-op transformer function
 */
const identity = docs => docs;

/**
 * Run graphql query then index documents to Azure.
 * @param graphql
 * @param queryIndex
 * @param query the query config specified in gatsby-config.js
 * @param transformer the transformer function specified in gatsby-config.js
 * @param serviceName azure search service name
 * @param apiKey azure search admin key
 * @param indexName indexConfig.name
 * @param verbose
 * @returns {Promise<*>}
 */
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

// Gatsby API
exports.onPostBuild = async function(
  { graphql },
  { serviceName, apiKey, indexConfig, queries, verbose = false }
  ) {

  const activity = reporter.activityTimer('Index to Azure Search');
  activity.start();

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
