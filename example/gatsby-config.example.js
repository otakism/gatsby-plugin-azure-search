require('dotenv').config({
  path: `.env`,
});

const gatsbyPluginAzureSearch = {
  resolve: `gatsby-plugin-azure-search`,
  options: {
    verbose: true,
    serviceName: process.env.AZURE_SEARCH_SERVICE_NAME,
    apiKey: process.env.AZURE_SEARCH_ADMIN_KEY,
    indexConfig: {
      name: `otakism`,
      corsOptions: {
        allowedOrigins: ['*'],
        maxAgeInSeconds: 300,
      },
      fields: [
        {
          name: 'slug',
          type: 'Edm.String',
          searchable: false,
          filterable: false,
          retrievable: true,
          sortable: true,
          facetable: false,
          key: true,
        },
        {
          name: 'title',
          type: 'Edm.String',
          searchable: true,
          filterable: false,
          retrievable: true,
          sortable: true,
          facetable: false,
          key: false,
          analyzer: 'zh-Hans.lucene',
        },
        {
          name: 'date',
          type: 'Edm.DateTimeOffset',
          searchable: false,
          filterable: false,
          retrievable: true,
          sortable: true,
          facetable: false,
          key: false,
        },
        {
          name: 'content',
          type: 'Edm.String',
          searchable: true,
          filterable: false,
          retrievable: true,
          sortable: false,
          facetable: false,
          key: false,
          analyzer: 'zh-Hans.lucene',
        },
        {
          name: 'excerpt',
          type: 'Edm.String',
          searchable: true,
          filterable: false,
          retrievable: true,
          sortable: false,
          facetable: false,
          key: false,
          analyzer: 'zh-Hans.lucene',
        },
        {
          name: 'permalink',
          type: 'Edm.String',
          searchable: false,
          filterable: false,
          retrievable: true,
          sortable: false,
          facetable: false,
          key: false,
        },
        {
          name: 'categories',
          type: 'Collection(Edm.String)',
          searchable: true,
          filterable: true,
          retrievable: true,
          sortable: false,
          facetable: false,
          key: false,
        },
        {
          name: 'tags',
          type: 'Collection(Edm.String)',
          searchable: true,
          filterable: true,
          retrievable: true,
          sortable: false,
          facetable: false,
          key: false,
        },
      ],
    },
    queries: [
      {
        query: `{
            allWordpressPage(
              filter: {
                status: { eq: "publish" }
              }
            ) {
              edges {
                node {
                  slug
                  title
                  date
                  content
                  excerpt
                }
              }
            }
          }`,
        transformer: ({ data }) => {
          return data.allWordpressPage.edges.map((edge, index) => {
            return {
              ...edge.node,
              permalink: `${siteMetadata.siteUrl}/${edge.node.slug}`,
              content: (edge.node.content || '').replace(/(<([^>]+)>)/gi, ''),
              excerpt: (edge.node.excerpt || edge.node.content || '')
                .replace(/(<([^>]+)>)/gi, '')
                .substring(0, 200),
              categories: [],
              tags: [],
            };
          });
        },
      },
      {
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
          return data.allWordpressPost.edges.map((edge) => {
            return {
              ...edge.node,
              permalink: `${siteMetadata.siteUrl}/${edge.node.slug}`,
              content: (edge.node.content || '').replace(/(<([^>]+)>)/gi, ''),
              excerpt: (edge.node.content || '')
                .replace(/(<([^>]+)>)/gi, '')
                .substring(0, 200),
              categories: (edge.node.categories || []).map((c) => c.name),
              tags: (edge.node.tags || []).map((t) => t.name),
            };
          });
        },
      },
    ],
  },
};

module.exports = {
  plugins: [
    gatsbyPluginAzureSearch,
  ],
};
