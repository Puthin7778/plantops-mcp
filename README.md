# Advanced Plantops GraphQL MCP Server

**Version:** 1.1.0

This Model Context Protocol (MCP) server provides an advanced interface for AI agents to interact with a Plantops GraphQL endpoint. It enables agents to discover the API structure, execute queries and mutations, preview data, and check service health.

## Features

**Resources:**

- **Plantops GraphQL Schema (`plantops:/schema`)**
  - Provides the full GraphQL schema definition obtained via introspection.

**Tools:**

- `run_graphql_query`: Executes a read-only GraphQL query.
- `run_graphql_mutation`: Executes a GraphQL mutation. **Use with caution.**
- `list_tables`: Lists available data tables.
- `describe_table`: Shows the structure of a specific table.
- `list_root_fields`: Lists top-level query, mutation, or subscription fields.
- `describe_graphql_type`: Provides details about a specific GraphQL type.
- `preview_table_data`: Fetches a limited sample of rows from a table.
- `aggregate_data`: Performs simple aggregations (count, sum, avg, min, max).
- `health_check`: Checks if the Plantops GraphQL endpoint is reachable.

## Setup and Installation

1.  **Install Dependencies:**
    ```bash
    pnpm install
    ```
2.  **Build the Server:**
    ```bash
    pnpm run build
    ```

## Running the Server

Execute the script from your terminal:

```bash
pnpm start <PLANTOPS_GRAPHQL_ENDPOINT> [ADMIN_SECRET]
```
