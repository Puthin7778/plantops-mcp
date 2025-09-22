# Advanced Plantops GraphQL MCP Server

**Version:** 1.1.0

This Model Context Protocol (MCP) server provides an advanced interface for AI agents to interact with a Plantops GraphQL endpoint. It enables agents to discover the API structure and execute queries.

## Features

**Resources:**

* **Plantops GraphQL Schema (`plantops:/schema`)**
    * Provides the full GraphQL schema definition obtained via introspection.

**Tools:**

* **`listFields`**: List all top-level GraphQL query fields with descriptions.
* **`listMutations`**: List all top-level GraphQL mutation fields with descriptions.
* **`describeField`**: Return the argument schema and return type for a top-level field.
* **`describeComplexField`**: Describes a top-level query or mutation field, its arguments, and its immediate sub-fields if it returns a complex object.
* **`introspectType`**: Discover the available fields for a complex GraphQL object type.
* **`executeQuery`**: Execute a GraphQL query string (and optional variables) and return JSON.

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
