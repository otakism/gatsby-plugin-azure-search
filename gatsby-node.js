const axios = require('axios');
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
 * Delete a search index.
 * @param serviceName azure search service name
 * @param apiKey azure search admin key
 * @param indexConfig specified in gatsby-config.js
 * @param verbose
 * @returns {Promise<*>}
 */
const deleteIndex = async ({ serviceName, apiKey, indexConfig, verbose = false}) => {
  const url = `https://${serviceName}.search.windows.net/indexes/${indexConfig.name}?api-version=${API_VERSION}`;
  const headers = getHeaders({ apiKey });
  if (verbose) {
    reporter.info(`Input to delete index:`);
    console.log(`url:`, url);
    console.log(`indexName:`, indexConfig.name);
    console.log(`headers:`, headers);
  }
  try {
    const res = await axios({
      method: 'delete',
      url,
      headers,
    });
    reporter.info(`Deleted index: ${indexConfig.name}`);
    return Promise.resolve(res);
  } catch (e) {
    reporter.warn(`Faield to delete index: ${e.message}. But it might be OK.`);
    if (verbose) {
      console.log(`Error response:`, e.response.data);
    }
    return Promise.resolve();
  }
};

/**
 * Create a search index.
 * @param serviceName azure search service name
 * @param apiKey azure search admin key
 * @param indexConfig specified in gatsby-config.js
 * @param verbose
 * @returns {Promise<*>}
 */
const createIndex = async ({ serviceName, apiKey, indexConfig, verbose = false }) => {
  const url = `https://${serviceName}.search.windows.net/indexes/${indexConfig.name}?api-version=${API_VERSION}`;
  const headers = getHeaders({ apiKey });
  if (verbose) {
    reporter.info(`Input to create index:`);
    console.log(`url:`, url);
    console.log(`indexConfig:`, indexConfig);
    console.log(`headers:`, headers);
  }
  try {
    const res = await axios({
      method: 'put',
      url,
      headers,
      data: indexConfig,
    });
    reporter.info(`Created index: ${indexConfig.name}`);
    return Promise.resolve(res);
  } catch (e) {
    reporter.error(`Faield to create index: ${e.message}`);
    if (verbose) {
      console.log(`Error response:`, e.response.data);
    }
    return Promise.reject(e);
  }
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
const indexDocuments = async ({ serviceName, apiKey, indexName, docs, verbose }) => {
  const url = `https://${serviceName}.search.windows.net/indexes/${indexName}/docs/index?api-version=${API_VERSION}`;
  const body = {
    value: docs,
  };
  const headers = getHeaders({ apiKey });
  if (verbose) {
    reporter.info(`Input to index document:`);
    console.log(`url:`, url);
    reporter.log(`headers:`, headers);
  }
  try {
    const res = await axios({
      method: 'post',
      url,
      headers,
      data: body,
    });
    reporter.info(`Indexed documents to ${indexName}`);
    if (verbose) {
      reporter.log(`Response data: `, JSON.stringify(res.data));
    }
    return Promise.resolve(res);
  } catch (e) {
    reporter.error(`Faield to index documents: ${e.message}`);
    if (verbose) {
      console.log(`Error response:`, e.response.data);
    }
    return Promise.reject(e);
  }
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
    const errMsg = `Failed to run graphql query`;
    reporter.panic(errMsg, result.errors);
    return Promise.reject(new Error(errMsg));
  }

  reporter.info(`Query ${queryIndex}: running transformer`);
  const docs = await transformer(result);

  reporter.info(`Query ${queryIndex}: generated ${docs.length} documents`);
  reporter.info(`Query ${queryIndex}: indexing documents`);
  return indexDocuments({ serviceName, apiKey, indexName, docs, verbose });
};

// Gatsby API
exports.onPostBuild = async function(
  { graphql },
  { serviceName, apiKey, indexConfig, queries, verbose = false }
  ) {

  const activity = reporter.activityTimer('Index to Azure Search');
  activity.start();

  try {
    reporter.info(`Rebuild index ${indexConfig.name}`);
    await deleteIndex({ serviceName, apiKey, indexConfig, verbose });
    await createIndex({ serviceName, apiKey, indexConfig, verbose });

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

    await Promise.all(jobs);
  } catch (e) {
    reporter.panic(`Failed to index to Azure Search.`);
  } finally {
    activity.end();
  }
};
