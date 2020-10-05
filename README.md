# Gatsby Plugin Azure Search

Gatsby plugin to ingest data into Microsoft Azure Cognitive Search.

## Overview

There are 2 parts of implementing a search feature for your site. The indexing (writing) part and the querying (reading) part. The indexing part push data into some search back end, the querying part reads from the search back end via its APIs then presents the result on the front end.

This plugin handles only the indexing part, using [Azure Cognitive Search](https://azure.microsoft.com/en-us/services/search/) as the back end service.

## How to use

Install the plugin.

```bash
npm install --save gatsby-plugin-azure-search dotenv
```

Create an `.env` file in the root directory of gatsby, same level as `gatsby-config.js`. Do not commit this file.

```
AZURE_SEARCH_SERVICE_NAME=X
AZURE_SEARCH_ADMIN_KEY=X // Note: we need "admin key" instead of "query key"
```

It is recommended to use dotenv for security reasons. If your Gatsby repository is always private, you can hard-code the credentials in `gatsby-config.js` at your own risk.

Add configuration in gatsby-config.js:

```javascript
require('dotenv').config({
  path: `.env`,
});

module.exports = {
  plugins: [
    {
      resolve: `gatsby-plugin-azure-search`,
      options: {
        verbose: false, // default: false
        serviceName: process.env.AZURE_SEARCH_SERVICE_NAME, // required
        apiKey: process.env.AZURE_SEARCH_ADMIN_KEY, // required
        indexConfig: { // required. refer to azure documentation
          name: ``, // required. the plugin upserts the index, no need to create it in advance
          fields: [], // required
          suggesters: [], // optional
          scoringProfiles: [], // optional
          analyzers: [], // optional
          charFilters: [], // optional
          tokenizers: [], // optional
          tokenFilters: [], // optional
          defaultScoringProfile: '', // optional
          corsOptions: { // optional
            allowedOrigins: [], 
            maxAgeInSeconds: 300, 
          },
          encryptionKey: {}, // optional
        },
        queries: [], // required. details in next section.
      },
    }
  ]
}
```

For `indexConfig`, refer to the official Azure [documentation](https://docs.microsoft.com/en-us/azure/search/search-what-is-an-index#index-attributes).

You may also refer to `example` folder for how I configured the plugin in my blog.

Assume the configuration is correct, your gatsby site should be indexed to Azure search every time it is built. You can verify the generated search index in Azure console.

### Query Configuration

You can provide multiple graphql queries for ingestion, but for now all generated documents will be ingested into the same index.

Each query object specifies a required graphql `query` and an optional `transformer` function.

The transformer function operates on the raw graphql query output as an array, and returns the transformed indexable documents as an array.

The transformed document must match exactly as defined in the index's `fields` configuration. Including extra keys will result in bad request errors from Azure.

Sample query:

```javascript
const sampleQuery = {
  query: `{
    allWordpressPost(
      filter: {
        status: { eq: "publish" }
      }
    ) {
      edges {
        node {
          slug
          date
          title
          content
          excerpt
          categories {
            name
          }
          tags {
            name
          }
        }
      }
    }
  }`,
  transformer: ({ data }) => {
    return data.allWordpressPost.edges.map(edge => {
      return {
        ...edge.node,
        permalink: `https://artifact.me/${edge.node.slug}`,
        content: (edge.node.content || '').replace(/(<([^>]+)>)/ig,""),
        excerpt: (edge.node.excerpt || '').replace(/(<([^>]+)>)/ig,"").substring(0, 200) + '...',
        categories: (edge.node.categories || []).map(c => c.name),
        tags: (edge.node.tags || []).map(t => t.name),
      };
    });
  },
};
```
