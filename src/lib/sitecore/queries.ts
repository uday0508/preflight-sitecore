export const GRAPHQL_QUERIES = {
  /**
   * Item with all inherited fields — used only for tracking check.
   */
  getItemWithFields: `
    query GetItemWithFields($itemId: ID!, $language: String!) {
      item(
        where: { itemId: $itemId, database: "master", language: $language }
      ) {
        itemId
        name
        path
        template { name templateId }
        fields(ownFields: false, excludeStandardFields: false) {
          nodes { name value }
        }
      }
    }
  `,

  /**
   * Publish state — used for render drift check.
   */
  getItemPublishState: `
    query GetItemPublishState($itemId: ID!, $language: String!) {
      item(
        where: { itemId: $itemId, database: "master", language: $language }
      ) {
        itemId
        name
        path
        updated: field(name: "__Updated") { value }
        published: field(name: "__Published") { value }
      }
    }
  `,
};