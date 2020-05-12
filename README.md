# Gatsby Plugin Azure Search

Gatsby plugin to ingest data into Microsoft Azure Cognitive Search.

## How to use

Install the plugin.

```bash
npm install --save gatsby-plugin-azure-search dotenv
```

Add credentials to an .env file. Do not commit this file.

It is recommended to use this approach to keep the admin key secret. If your Gatsby repository is always private, you may also (at your own risk) hard-code the credentials in gatsby-config.js.

Note that we need the admin key instead of the query key.

```
// .env.development
AZURE_SEARCH_SERVICE_NAME=X
AZURE_SEARCH_ADMIN_KEY=X
```

Add configuration in gatsby-config.js like the following example:

```javascript
require('dotenv').config({
  path: `.env.${process.env.NODE_ENV}`,
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
            allowedOrigins: [], // default: ['*']
            maxAgeInSeconds: 300, // default: 300
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
