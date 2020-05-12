# gatsby-plugin-azure-search

Gatsby plugin to ingest data into Microsoft Azure search.

## Configuration

Add configuration in gatsby-config.js like the following example:

```ecmascript 6
module.exports = {
  plugins: [
    {
      resolve: `gatsby-plugin-azure-search`,
      options: {
        verbose: false, // default: false
        serviceName: ``, // required
        apiKey: ``, // required. use the admin key, not query key
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

### Queries Configuration

Each query object must specify a graphql `query` and a `transformer`. 

The output from the transformer function must match exactly as defined in the index's `fields` configuration. For example, including extra properties will result in bad request errors from Azure.

Sample query:

```ecmascript 6
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
