export const GRAPHQL_QUERIES = {
  getPageLayout: `
    query GetPageLayout($pageId: ID!, $language: String!) {
      item(where: { itemId: $pageId, database: "master", language: $language }) {
        itemId
        name
        path
        fields(ownFields: true, excludeStandardFields: true) {
          nodes {
            name
            value
          }
        }
      }
    }
  `,

  getPagePersonalization: `
    query GetPagePersonalization($pageId: ID!, $language: String!) {
      item(where: { itemId: $pageId, database: "master", language: $language }) {
        itemId
        name
        fields(ownFields: true, excludeStandardFields: true) {
          nodes {
            name
            value
          }
        }
      }
    }
  `,

  getPagePublishState: `
    query GetPagePublishState($pageId: ID!, $language: String!) {
      item(where: { itemId: $pageId, database: "master", language: $language }) {
        itemId
        name
        path
        updated: field(name: "__Updated") { value }
        published: field(name: "__Published") { value }
      }
    }
  `,

  getComponentPersonalization: `
    query GetComponentPersonalization($pageId: ID!, $language: String!) {
      item(where: { itemId: $pageId, database: "master", language: $language }) {
        itemId
        name
        children {
          nodes {
            itemId
            name
            template { name }
            fields(ownFields: true, excludeStandardFields: true) {
              nodes { name value }
            }
          }
        }
      }
    }
  `,

  getPagesForScan: `
    query GetPagesForScan {
      search(
        query: {
          searchStatement: {
            operator: MUST
            subStatements: {
              criteria: [
                { criteriaType: SEARCH, field: "_templatename", value: "Page", operator: EQ }
                { criteriaType: SEARCH, field: "_path", value: "/sitecore/content", operator: CONTAINS }
              ]
            }
          }
          paging: { pageSize: 20 }
        }
      ) {
        results {
          innerItem {
            itemId
            path
            name
          }
        }
      }
    }
  `,
};