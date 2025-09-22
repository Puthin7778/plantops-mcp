import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GraphQLClient, gql, ClientError } from 'graphql-request';
import {
    getIntrospectionQuery,
    IntrospectionQuery,
    IntrospectionObjectType,
    IntrospectionSchema,
    IntrospectionField,
    IntrospectionInputValue,
    IntrospectionInterfaceType,
    IntrospectionInputObjectType,
    IntrospectionEnumType,
    IntrospectionUnionType
} from 'graphql';

const SERVER_NAME = "mcp-servers/plantops-advanced";
const SERVER_VERSION = "1.1.0";
const SCHEMA_RESOURCE_URI = "plantops:/schema";
const SCHEMA_RESOURCE_NAME = "Plantops GraphQL Schema (via Introspection)";
const SCHEMA_MIME_TYPE = "application/json";

// The main server logic is now wrapped in this exported function.
export default function createServer() {
    // --- Hardcoded values for testing ---
    // Replace this with your actual endpoint URL.
    const endpointUrl = "https://aspen.plantops.co/plantopsapi/graphql";
    // ---

    const PLANTOPS_ENDPOINT = endpointUrl;

    console.error(`[INFO] Initializing server for Plantops Endpoint: ${PLANTOPS_ENDPOINT}`);

    const server = new McpServer({
        name: SERVER_NAME,
        version: SERVER_VERSION,
        capabilities: {
            resources: {},
            tools: {},
        },
    });

    const headers: Record<string, string> = {}; // Headers object is kept in case you need to add other headers later
    const gqlClient = new GraphQLClient(PLANTOPS_ENDPOINT, { headers });

    async function makeGqlRequest<
        T = any,
        V extends Record<string, any> = Record<string, any>
    >(
        query: string,
        variables?: V,
        requestHeaders?: Record<string, string>
    ): Promise<T> {
        try {
            const combinedHeaders = { ...headers, ...requestHeaders };
            return await gqlClient.request<T>(query, variables, combinedHeaders);
        } catch (error) {
            if (error instanceof ClientError) {
                const gqlErrors = error.response?.errors?.map(e => e.message).join(', ') || 'Unknown GraphQL error';
                console.error(`[ERROR] GraphQL Request Failed: ${gqlErrors}`, error.response);
                throw new Error(`GraphQL operation failed: ${gqlErrors}`);
            }
            console.error("[ERROR] Unexpected error during GraphQL request:", error);
            throw error;
        }
    }

    let introspectionSchema: IntrospectionSchema | null = null;

    async function getIntrospectionSchema(): Promise<IntrospectionSchema> {
        if (introspectionSchema) {
            return introspectionSchema;
        }
        console.error("[INFO] Fetching GraphQL schema via introspection...");
        const introspectionQuery = getIntrospectionQuery();
        try {
            const result = await makeGqlRequest<IntrospectionQuery>(introspectionQuery);
            if (!result.__schema) {
                throw new Error("Introspection query did not return a __schema object.");
            }
            introspectionSchema = result.__schema;
            console.error("[INFO] Introspection successful, schema cached.");
            return introspectionSchema;
        } catch (error) {
            console.error("[ERROR] Failed to fetch or cache introspection schema:", error);
            introspectionSchema = null;
            throw new Error(`Failed to get GraphQL schema: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    server.resource(
        SCHEMA_RESOURCE_NAME,
        SCHEMA_RESOURCE_URI,
        { mimeType: SCHEMA_MIME_TYPE },
        async () => {
            console.error(`[INFO] Handling read request for resource: ${SCHEMA_RESOURCE_URI}`);
            const schema = await getIntrospectionSchema();
            return {
                contents: [{
                    uri: SCHEMA_RESOURCE_URI,
                    text: JSON.stringify(schema, null, 2),
                    mimeType: SCHEMA_MIME_TYPE
                }]
            };
        }
    );

    server.tool(
        "listFields",
        "List all top-level GraphQL query fields with descriptions.",
        {},
        async () => {
            console.error(`[INFO] Executing tool 'listFields'`);
            const schema = await getIntrospectionSchema();
            if (schema.queryType) {
                const queryRoot = schema.types.find(t => t.name === schema.queryType?.name) as IntrospectionObjectType | undefined;
                const fields = queryRoot?.fields?.map(f => ({ name: f.name, description: f.description || "No description." })) || [];
                return { content: [{ type: "text", text: JSON.stringify({ fields }, null, 2) }] };
            }
            return { content: [{ type: "text", text: JSON.stringify({ fields: [] }, null, 2) }] };
        });

    server.tool(
        "listMutations",
        "List all top-level GraphQL mutation fields with descriptions.",
        {},
        async () => {
            console.error(`[INFO] Executing tool 'listMutations'`);
            const schema = await getIntrospectionSchema();
            if (schema.mutationType) {
                const mutationRoot = schema.types.find(t => t.name === schema.mutationType?.name) as IntrospectionObjectType | undefined;
                const mutations = mutationRoot?.fields?.map(f => ({ name: f.name, description: f.description || "No description." })) || [];
                return { content: [{ type: "text", text: JSON.stringify({ mutations }, null, 2) }] };
            }
            return { content: [{ type: "text", text: JSON.stringify({ mutations: [], info: "No mutations defined in the schema." }, null, 2) }] };
        });


    server.tool(
        "describeField",
        "Return the argument schema and return type for a top-level field. IMPORTANT: This does not show sub-fields of complex types. To discover the fields of a complex return type (e.g., 'Users'), use the 'introspectType' tool.",
        {
            fieldName: z.string().describe("Name of the top-level field to describe."),
        },
        async ({ fieldName }) => {
            console.error(`[INFO] Executing tool 'describeField' for field: ${fieldName}`);
            const schema = await getIntrospectionSchema();
            const queryRoot = schema.types.find(t => t.name === schema.queryType?.name) as IntrospectionObjectType | undefined;
            const field = queryRoot?.fields.find(f => f.name === fieldName);

            if (!field) {
                throw new Error(`Field '${fieldName}' not found.`);
            }

            const argsSchema = field.args.map(arg => ({
                name: arg.name,
                description: arg.description,
                type: JSON.stringify(arg.type),
            }));

            const payload = {
                field: fieldName,
                description: field.description || null,
                returnType: JSON.stringify(field.type),
                argsSchema,
            };
            return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
        });

    server.tool(
        "describeComplexField",
        "Describes a top-level query or mutation field, its arguments, and its immediate sub-fields if it returns a complex object.",
        {
            fieldName: z.string().describe("Name of the top-level field to describe."),
            operationType: z.enum(["query", "mutation"]).optional().default("query").describe("The type of operation: 'query' or 'mutation'. Defaults to 'query'."),
        },
        async ({ fieldName, operationType }) => {
            console.error(`[INFO] Executing tool 'describeComplexField' for field: ${fieldName}`);
            const schema = await getIntrospectionSchema();
            let rootTypeName = '';
            if (operationType === 'query') rootTypeName = schema.queryType?.name || '';
            if (operationType === 'mutation') rootTypeName = schema.mutationType?.name || '';

            const rootType = schema.types.find(t => t.name === rootTypeName) as IntrospectionObjectType | undefined;
            const field = rootType?.fields.find(f => f.name === fieldName);

            if (!field) {
                throw new Error(`Field '${fieldName}' not found in '${operationType}'.`);
            }

            let currentType = field.type;
            while ('ofType' in currentType && currentType.ofType) {
                currentType = currentType.ofType;
            }

            let nestedFields: any[] | undefined = undefined;
            if ('name' in currentType && currentType.name) {
                const returnType = schema.types.find(t => t.name === currentType.name)
                if (returnType?.kind === 'OBJECT') {
                    nestedFields = (returnType as IntrospectionObjectType).fields.map(f => ({
                        name: f.name,
                        description: f.description,
                        arguments: f.args.map(a => ({ name: a.name, description: a.description, type: JSON.stringify(a.type) })),
                        returns: JSON.stringify(f.type)
                    }));
                }
            }


            const payload = {
                name: field.name,
                description: field.description,
                arguments: field.args.map(a => ({ name: a.name, description: a.description, type: JSON.stringify(a.type) })),
                returns: JSON.stringify(field.type),
                nested_fields: nestedFields
            };

            return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
        }
    );

    server.tool(
        "introspectType",
        "Discover the available fields for a complex GraphQL object type. Use this when a type name is returned from another tool (like 'describeField') and you need to know its internal structure.",
        {
            typeName: z.string().describe("The name of the complex type to inspect (e.g., 'Users', 'UsersResult')."),
        },
        async ({ typeName }) => {
            console.error(`[INFO] Executing tool 'introspectType' for type: ${typeName}`);
            const schema = await getIntrospectionSchema();
            const typeInfo = schema.types.find(t => t.name === typeName);
            if (!typeInfo) {
                throw new Error(`Type '${typeName}' not found in the schema.`);
            }

            if (typeInfo.kind !== 'OBJECT' && typeInfo.kind !== 'INTERFACE') {
                return { content: [{ type: "text", text: JSON.stringify({ info: `Type '${typeName}' is a ${typeInfo.kind} and has no fields.` }, null, 2) }] };
            }

            const fieldsInfo = (typeInfo as IntrospectionObjectType | IntrospectionInterfaceType).fields.map(f => ({
                name: f.name,
                type: JSON.stringify(f.type),
                description: f.description || null,
            }));

            return { content: [{ type: "text", text: JSON.stringify({ fields: fieldsInfo }, null, 2) }] };
        }
    );

    server.tool(
        "executeQuery",
        "Execute a GraphQL query string (and optional variables) and return JSON.",
        {
            query: z.string().describe("GraphQL query string."),
            variables: z.record(z.unknown()).optional().describe("Optional GraphQL variables object."),
        },
        async ({ query, variables }) => {
            console.error(`[INFO] Executing tool 'executeQuery'`);
            try {
                const result = await makeGqlRequest(query, variables);
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            } catch (error: any) {
                return { content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }] };
            }
        }
    );


    return server;
}
