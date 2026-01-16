# HTTP API

## Overview

The `HttpApi*` modules offer a flexible and declarative way to define HTTP APIs.

To define an API, create a set of `HttpEndpoint`s. Each endpoint is described by a path, a method, and schemas for the request and response.

Collections of endpoints are grouped in an `HttpApiGroup`, and multiple groups can be merged into a complete `HttpApi`.

```
HttpApi
├── HttpGroup
│   ├── HttpEndpoint
│   └── HttpEndpoint
└── HttpGroup
    ├── HttpEndpoint
    ├── HttpEndpoint
    └── HttpEndpoint
```

Once your API is defined, the same definition can be reused for multiple purposes:

- **Starting a Server**: Use the API definition to implement and serve endpoints.
- **Generating Documentation**: Create a Swagger page to document the API.
- **Deriving a Client**: Generate a fully-typed client for your API.

Benefits of a Single API Definition:

- **Consistency**: A single definition ensures the server, documentation, and client remain aligned.
- **Reduced Maintenance**: Changes to the API are reflected across all related components.
- **Simplified Workflow**: Avoids duplication by consolidating API details in one place.

## Hello World

### Defining and Implementing an API

This example demonstrates how to define and implement a simple API with a single endpoint that returns a string response. The structure of the API is as follows:

```
HttpApi ("MyApi")
└── HttpGroup ("Greetings")
    └── HttpEndpoint ("hello-world")
```

**Example** (Hello World)

```ts
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer, Schema } from "effect"
import { HttpRouter } from "effect/unstable/http"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { createServer } from "node:http"

// Definition
const Api = HttpApi.make("MyApi").add(
  // Define the API group
  HttpApiGroup.make("Greetings").add(
    // Define the endpoint
    HttpApiEndpoint.get("hello", "/", {
      // Define the success schema
      success: Schema.String
    })
  )
)

// Implementation
const GroupLive = HttpApiBuilder.group(
  Api,
  "Greetings",
  (handlers) => handlers.handle("hello", (_ctx) => Effect.succeed("Hello, World!"))
)

// Server
const ApiLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(GroupLive),
  HttpRouter.serve,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)

// Launch
Layer.launch(ApiLive).pipe(NodeRuntime.runMain)
```

After running the code, open a browser and navigate to http://localhost:3000. The server will respond with:

```
Hello, World!
```

### Serving The Auto Generated Swagger Documentation (TODO)

You can enhance your API by adding auto-generated Swagger documentation using the `HttpApiSwagger` module. This makes it easier for developers to explore and interact with your API.

To include Swagger in your server setup, provide the `HttpApiSwagger.layer` when configuring the server.

**Example** (Serving Swagger Documentation)

```ts TODO
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer, Schema } from "effect"
import { HttpRouter } from "effect/unstable/http"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { createServer } from "node:http"

const Api = HttpApi.make("MyApi").add(
  HttpApiGroup.make("Greetings").add(
    HttpApiEndpoint.get("hello", "/", {
      success: Schema.String
    })
  )
)

const GroupLive = HttpApiBuilder.group(
  Api,
  "Greetings",
  (handlers) => handlers.handle("hello", (_ctx) => Effect.succeed("Hello, World!"))
)

const ApiLive = HttpApiBuilder.layer(Api).pipe(
  // TODO
  // Provide the Swagger layer so clients can access auto-generated docs
  Layer.provide(GroupLive),
  HttpRouter.serve,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)

Layer.launch(ApiLive).pipe(NodeRuntime.runMain)
```

After running the server, open your browser and navigate to http://localhost:3000/docs.

This URL will display the Swagger documentation, allowing you to explore the API's endpoints, request parameters, and response structures interactively.

![Swagger Documentation](./images/swagger-hello-world.png)

### Deriving a Client

Once you have defined your API, you can generate a client to interact with it using the `HttpApiClient` module. This allows you to call your API endpoints without manually handling HTTP requests.

**Example** (Deriving and Using a Client)

```ts
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer, Schema } from "effect"
import { HttpRouter } from "effect/unstable/http"
import { FetchHttpClient } from "effect/unstable/http"
import { HttpApi, HttpApiBuilder, HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { createServer } from "node:http"

const Api = HttpApi.make("MyApi").add(
  HttpApiGroup.make("Greetings").add(
    HttpApiEndpoint.get("hello", "/", {
      success: Schema.String
    })
  )
)

const GroupLive = HttpApiBuilder.group(
  Api,
  "Greetings",
  (handlers) => handlers.handle("hello", (_ctx) => Effect.succeed("Hello, World!"))
)

const ApiLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(GroupLive),
  HttpRouter.serve,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)

Layer.launch(ApiLive).pipe(NodeRuntime.runMain)

// Create a program that derives and uses the client
const program = Effect.gen(function*() {
  // Derive the client
  const client = yield* HttpApiClient.make(Api, {
    baseUrl: "http://localhost:3000"
  })
  // Call the "hello-world" endpoint
  const hello = yield* client.Greetings.hello()
  console.log(hello)
})

// Provide a Fetch-based HTTP client and run the program
Effect.runFork(program.pipe(Effect.provide(FetchHttpClient.layer)))
/*
Output:
[18:55:26.051] INFO (#2): Listening on http://0.0.0.0:3000
[18:55:26.057] INFO (#12) http.span.1=2ms: Sent HTTP response { 'http.method': 'GET', 'http.url': '/', 'http.status': 200 }
Hello, World!
*/
```

## Defining a HttpApiEndpoint

An `HttpApiEndpoint` represents a single endpoint in your API. Each endpoint is defined with a name, path, HTTP method, and optional schemas for requests and responses. This allows you to describe the structure and behavior of your API.

Below is an example of a simple CRUD API for managing users, which includes the following endpoints:

- `GET /users` - Retrieve all users.
- `GET /users/:userId` - Retrieve a specific user by ID.
- `POST /users` - Create a new user.
- `DELETE /users/:userId` - Delete a user by ID.
- `PATCH /users/:userId` - Update a user by ID.

### GET

The `HttpApiEndpoint.get` method allows you to define a GET endpoint by specifying its name, path, and optionally, a schema for the response.

To define the structure of successful responses, use the `success` option or the `.addSuccess` method. If no schema is provided, the default response status is `204 No Content`.

**Example** (Defining a GET Endpoint to Retrieve All Users)

```ts
import { Schema } from "effect"
import { HttpApiEndpoint } from "effect/unstable/httpapi"

// Define a schema representing a User entity
const User = Schema.Struct({
  id: Schema.Finite,
  name: Schema.String,
  createdAt: Schema.DateValid
})

// Define the "getUsers" endpoint, returning a list of users
const getUsers = HttpApiEndpoint
  //      ┌─── Endpoint name
  //      │            ┌─── Endpoint path
  //      ▼            ▼
  .get("getUsers", "/users", {
    // Define the success schema for the response (optional).
    // If no response schema is specified, the default response is `204 No Content`.
    success: Schema.Array(User)
  })
```

The success can also be defined with the `.addSuccess` method.

**Example** (`addSuccess` method)

```ts
import { Schema } from "effect"
import { HttpApiEndpoint } from "effect/unstable/httpapi"

const User = Schema.Struct({
  id: Schema.Finite,
  name: Schema.String,
  createdAt: Schema.DateValid
})

const getUsers = HttpApiEndpoint
  .get("getUsers", "/users")
  // Define the success schema for the response (optional).
  // If no response schema is specified, the default response is `204 No Content`.
  .addSuccess(Schema.Array(User))
```

### Path Parameters

Path parameters allow you to include dynamic segments in your endpoint's path. There are two ways to define path parameters in your API.

#### Using setPath

The `path` option or the `setPath` method allows you to explicitly define path parameters by associating them with a schema.

**Example** (Defining Path Parameters with the `path` option)

```ts
import { Schema } from "effect"
import { HttpApiEndpoint } from "effect/unstable/httpapi"

const User = Schema.Struct({
  id: Schema.Finite,
  name: Schema.String,
  createdAt: Schema.DateValid
})

// Define a GET endpoint with a path parameter ":id"
const getUser = HttpApiEndpoint.get("getUser", "/user/:id", {
  path: {
    // Define a schema for the "id" path parameter
    id: Schema.FiniteFromString
  },
  success: User
})
```

**Example** (`setPath` method)

```ts
import { Schema } from "effect"
import { HttpApiEndpoint } from "effect/unstable/httpapi"

const User = Schema.Struct({
  id: Schema.Finite,
  name: Schema.String,
  createdAt: Schema.DateValid
})

const getUser = HttpApiEndpoint.get("getUser", "/user/:id", {
  success: User
}).setPath(Schema.Struct({
  id: Schema.FiniteFromString
}))
```

#### Using Template Strings

You can also define path parameters by embedding them in a template string with the help of `HttpApiSchema.param`.

**Example** (Defining Parameters using a Template String)

```ts TODO
import { HttpApiEndpoint, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})

// Create a path parameter using HttpApiSchema.param
const idParam = HttpApiSchema.param("id", Schema.FiniteFromString)

// Define the GET endpoint using a template string
const getUser = HttpApiEndpoint.get("getUser")`/user/${idParam}`.addSuccess(
  User
)
```

### POST

The `HttpApiEndpoint.post` method is used to define an endpoint for creating resources. You can specify a schema for the request body (payload) and a schema for the successful response.

**Example** (Defining a POST Endpoint with Payload and Success Schemas)

```ts TODO
import { HttpApiEndpoint } from "@effect/platform"
import { Schema } from "effect"

// Define a schema for the user object
const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})

// Define a POST endpoint for creating a new user
const createUser = HttpApiEndpoint.post("createUser", "/users")
  // Define the request body schema (payload)
  .setPayload(
    Schema.Struct({
      name: Schema.String
    })
  )
  // Define the schema for a successful response
  .addSuccess(User)
```

### DELETE

The `HttpApiEndpoint.del` method is used to define an endpoint for deleting a resource.

**Example** (Defining a DELETE Endpoint with Path Parameters)

```ts TODO
import { HttpApiEndpoint, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

// Define a path parameter for the user ID
const idParam = HttpApiSchema.param("id", Schema.FiniteFromString)

// Define a DELETE endpoint to delete a user by ID
const deleteUser = HttpApiEndpoint.del("deleteUser")`/users/${idParam}`
```

### PATCH

The `HttpApiEndpoint.patch` method is used to define an endpoint for partially updating a resource. This method allows you to specify a schema for the request payload and a schema for the successful response.

**Example** (Defining a PATCH Endpoint for Updating a User)

```ts TODO
import { HttpApiEndpoint, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

// Define a schema for the user object
const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})

// Define a path parameter for the user ID
const idParam = HttpApiSchema.param("id", Schema.FiniteFromString)

// Define a PATCH endpoint to update a user's name by ID
const updateUser = HttpApiEndpoint.patch("updateUser")`/users/${idParam}`
  // Specify the schema for the request payload
  .setPayload(
    Schema.Struct({
      name: Schema.String // Only the name can be updated
    })
  )
  // Specify the schema for a successful response
  .addSuccess(User)
```

### Catch-All Endpoints

The path can also be `"*"` to match any incoming path. This is useful for defining a catch-all endpoint to handle unmatched routes or provide a fallback response.

**Example** (Defining a Catch-All Endpoint)

```ts TODO
import { HttpApiEndpoint } from "@effect/platform"

const catchAll = HttpApiEndpoint.get("catchAll", "*")
```

### Setting URL Parameters

The `setUrlParams` method allows you to define the structure of URL parameters for an endpoint. You can specify the schema for each parameter and include metadata such as descriptions to provide additional context.

**Example** (Defining URL Parameters with Metadata)

```ts TODO
import { HttpApiEndpoint } from "@effect/platform"
import { Schema } from "effect"

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})

const getUsers = HttpApiEndpoint.get("getUsers", "/users")
  // Specify the URL parameters schema
  .setUrlParams(
    Schema.Struct({
      // Parameter "page" for pagination
      page: Schema.FiniteFromString,
      // Parameter "sort" for sorting options with an added description
      sort: Schema.String.annotations({
        description: "Sorting criteria (e.g., 'name', 'date')"
      })
    })
  )
  .addSuccess(Schema.Array(User))
```

#### Defining an Array of Values for a URL Parameter

When defining a URL parameter that accepts multiple values, you can use the `Schema.Array` combinator. This allows the parameter to handle an array of items, with each item adhering to a specified schema.

**Example** (Defining an Array of String Values for a URL Parameter)

```ts TODO
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"

const api = HttpApi.make("myApi").add(
  HttpApiGroup.make("group").add(
    HttpApiEndpoint.get("get", "/")
      .setUrlParams(
        Schema.Struct({
          // Define "a" as an array of strings
          a: Schema.Array(Schema.String)
        })
      )
      .addSuccess(Schema.String)
  )
)
```

You can test this endpoint by passing an array of values in the query string. For example:

```sh
curl "http://localhost:3000/?a=1&a=2"
```

The query string sends two values (`1` and `2`) for the `a` parameter. The server will process and validate these values according to the schema.

### Status Codes

By default, the success status code is `200 OK`. You can change it by annotating the schema with a custom status.

**Example** (Defining a GET Endpoint with a custom status code)

```ts TODO
import { HttpApiEndpoint } from "@effect/platform"
import { Schema } from "effect"

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})

const getUsers = HttpApiEndpoint.get("getUsers", "/users")
  // Override the default success status
  .addSuccess(Schema.Array(User), { status: 206 })
```

### Handling Multipart Requests

To support file uploads, you can use the `HttpApiSchema.Multipart` API. This allows you to define an endpoint's payload schema as a multipart request, specifying the structure of the data, including file uploads, with the `Multipart` module.

**Example** (Defining an Endpoint for File Uploads)

In this example, the `HttpApiSchema.Multipart` function marks the payload as a multipart request. The `files` field uses `Multipart.FilesSchema` to handle uploaded file data automatically.

```ts TODO
import { HttpApiEndpoint, HttpApiSchema, Multipart } from "@effect/platform"
import { Schema } from "effect"

const upload = HttpApiEndpoint.post("upload", "/users/upload").setPayload(
  // Specify that the payload is a multipart request
  HttpApiSchema.Multipart(
    Schema.Struct({
      // Define a "files" field to handle file uploads
      files: Multipart.FilesSchema
    })
  ).addSuccess(Schema.String)
)
```

You can test this endpoint by sending a multipart request with a file upload. For example:

```sh
echo "Sample file content" | curl -X POST -F "files=@-" http://localhost:3000/users/upload
```

### Changing the Request Encoding

By default, API requests are encoded as JSON. If your application requires a different format, you can customize the request encoding using the `HttpApiSchema.withEncoding` method. This allows you to define the encoding type and content type of the request.

**Example** (Customizing Request Encoding)

```ts TODO
import { HttpApiEndpoint, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

const createUser = HttpApiEndpoint.post("createUser", "/users")
  // Set the request payload as a string encoded with URL parameters
  .setPayload(
    Schema.Struct({
      a: Schema.String // Parameter "a" must be a string
    })
      // Specify the encoding as URL parameters
      .pipe(HttpApiSchema.withEncoding({ kind: "UrlParams" }))
  )
```

### Changing the Response Encoding

By default, API responses are encoded as JSON. If your application requires a different format, you can customize the encoding using the `HttpApiSchema.withEncoding` API. This method lets you define the type and content type of the response.

**Example** (Returning Data as `text/csv`)

```ts TODO
import { HttpApiEndpoint, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

const csv = HttpApiEndpoint.get("csv")`/users/csv`
  // Set the success response as a string with CSV encoding
  .addSuccess(
    Schema.String.pipe(
      HttpApiSchema.withEncoding({
        // Specify the type of the response
        kind: "Text",
        // Define the content type as text/csv
        contentType: "text/csv"
      })
    )
  )
```

### Setting Request Headers

Use `HttpApiEndpoint.setHeaders` to declare a single, cumulative schema that describes all expected request headers.
Provide one struct schema where each header name maps to its validator, and you can attach metadata such as descriptions.

> [!IMPORTANT]
> All headers are normalized to lowercase. Always use lowercase keys in the headers schema.

**Example** (Describe and validate custom headers)

```ts TODO
import { HttpApiEndpoint } from "@effect/platform"
import { Schema } from "effect"

// Model for successful responses
const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})

const getUsers = HttpApiEndpoint.get("getUsers", "/users")
  // Describe the headers the endpoint expects
  .setHeaders(
    // Declare a single struct schema for all headers
    // Header keys MUST be lowercase in the schema
    Schema.Struct({
      // This header must be a string
      "x-api-key": Schema.String,

      // A human-friendly description is useful for generated docs (e.g. OpenAPI)
      "x-request-id": Schema.String.annotations({
        description: "Unique identifier for the request"
      })
    })
  )
  // Successful response: an array of User
  .addSuccess(Schema.Array(User))
```

You can test the endpoint by sending the headers:

```sh
curl -H "X-API-Key: 1234567890" -H "X-Request-ID: 1234567890" http://localhost:3000/users
```

The server validates these headers against the declared schema before handling the request.

## Defining a HttpApiGroup

You can group related endpoints under a single entity by using `HttpApiGroup.make`. This can help organize your code and provide a clearer structure for your API.

**Example** (Creating a Group for User-Related Endpoints)

```ts TODO
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})

const idParam = HttpApiSchema.param("id", Schema.FiniteFromString)

const getUsers = HttpApiEndpoint.get("getUsers", "/users").addSuccess(
  Schema.Array(User)
)

const getUser = HttpApiEndpoint.get("getUser")`/user/${idParam}`.addSuccess(
  User
)

const createUser = HttpApiEndpoint.post("createUser", "/users")
  .setPayload(
    Schema.Struct({
      name: Schema.String
    })
  )
  .addSuccess(User)

const deleteUser = HttpApiEndpoint.del("deleteUser")`/users/${idParam}`

const updateUser = HttpApiEndpoint.patch("updateUser")`/users/${idParam}`
  .setPayload(
    Schema.Struct({
      name: Schema.String
    })
  )
  .addSuccess(User)

// Group all user-related endpoints
const usersGroup = HttpApiGroup.make("users")
  .add(getUsers)
  .add(getUser)
  .add(createUser)
  .add(deleteUser)
  .add(updateUser)
```

If you would like to create a more opaque type for the group, you can extend `HttpApiGroup` with a class.

**Example** (Creating a Group with an Opaque Type)

```ts TODO
// Create an opaque class extending HttpApiGroup
class UsersGroup extends HttpApiGroup.make("users").add(getUsers).add(getUser) {
  // Additional endpoints or methods can be added here
}
```

## Creating the Top-Level HttpApi

After defining your groups, you can combine them into one `HttpApi` representing your entire set of endpoints.

**Example** (Combining Groups into a Top-Level API)

```ts TODO
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})

const idParam = HttpApiSchema.param("id", Schema.FiniteFromString)

const getUsers = HttpApiEndpoint.get("getUsers", "/users").addSuccess(
  Schema.Array(User)
)

const getUser = HttpApiEndpoint.get("getUser")`/user/${idParam}`.addSuccess(
  User
)

const createUser = HttpApiEndpoint.post("createUser", "/users")
  .setPayload(
    Schema.Struct({
      name: Schema.String
    })
  )
  .addSuccess(User)

const deleteUser = HttpApiEndpoint.del("deleteUser")`/users/${idParam}`

const updateUser = HttpApiEndpoint.patch("updateUser")`/users/${idParam}`
  .setPayload(
    Schema.Struct({
      name: Schema.String
    })
  )
  .addSuccess(User)

const usersGroup = HttpApiGroup.make("users")
  .add(getUsers)
  .add(getUser)
  .add(createUser)
  .add(deleteUser)
  .add(updateUser)

// Combine the groups into one API
const api = HttpApi.make("myApi").add(usersGroup)

// Alternatively, create an opaque class for your API
class MyApi extends HttpApi.make("myApi").add(usersGroup) {}
```

## Adding errors

Error responses allow your API to handle different failure scenarios. These responses can be defined at various levels:

- **Endpoint-level errors**: Use `HttpApiEndpoint.addError` to add errors specific to an endpoint.
- **Group-level errors**: Use `HttpApiGroup.addError` to add errors applicable to all endpoints in a group.
- **API-level errors**: Use `HttpApi.addError` to define errors that apply to every endpoint in the API.

Group-level and API-level errors are useful for handling shared issues like authentication failures, especially when managed through middleware.

**Example** (Defining Error Responses for Endpoints and Groups)

```ts TODO
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})

const idParam = HttpApiSchema.param("id", Schema.FiniteFromString)

// Define error schemas
class UserNotFound extends Schema.TaggedError<UserNotFound>()(
  "UserNotFound",
  {}
) {}

class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {}
) {}

const getUsers = HttpApiEndpoint.get("getUsers", "/users").addSuccess(
  Schema.Array(User)
)

const getUser = HttpApiEndpoint.get("getUser")`/user/${idParam}`
  .addSuccess(User)
  // Add a 404 error response for this endpoint
  .addError(UserNotFound, { status: 404 })

const usersGroup = HttpApiGroup.make("users")
  .add(getUsers)
  .add(getUser)
  // ...etc...
  // Add a 401 error response for the entire group
  .addError(Unauthorized, { status: 401 })
```

You can assign multiple error responses to a single endpoint by calling `HttpApiEndpoint.addError` multiple times. This is useful when different types of errors might occur for a single operation.

**Example** (Adding Multiple Errors to an Endpoint)

```ts TODO
const deleteUser = HttpApiEndpoint.del("deleteUser")`/users/${idParam}`
  // Add a 404 error response for when the user is not found
  .addError(UserNotFound, { status: 404 })
  // Add a 401 error response for unauthorized access
  .addError(Unauthorized, { status: 401 })
```

### Predefined Empty Error Types

The `HttpApiError` module provides a set of predefined empty error types that you can use in your endpoints. These error types help standardize common HTTP error responses, such as `404 Not Found` or `401 Unauthorized`. Using these predefined types simplifies error handling and ensures consistency across your API.

**Example** (Adding a Predefined Error to an Endpoint)

```ts TODO
import { HttpApiEndpoint, HttpApiError, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})

const idParam = HttpApiSchema.param("id", Schema.FiniteFromString)

const getUser = HttpApiEndpoint.get("getUser")`/user/${idParam}`
  .addSuccess(User)
  .addError(HttpApiError.NotFound)
```

| Name                  | Status | Description                                                                                        |
| --------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| `HttpApiDecodeError`  | 400    | Represents an error where the request did not match the expected schema. Includes detailed issues. |
| `BadRequest`          | 400    | Indicates that the request was malformed or invalid.                                               |
| `Unauthorized`        | 401    | Indicates that authentication is required but missing or invalid.                                  |
| `Forbidden`           | 403    | Indicates that the client does not have permission to access the requested resource.               |
| `NotFound`            | 404    | Indicates that the requested resource could not be found.                                          |
| `MethodNotAllowed`    | 405    | Indicates that the HTTP method used is not allowed for the requested resource.                     |
| `NotAcceptable`       | 406    | Indicates that the requested resource cannot be delivered in a format acceptable to the client.    |
| `RequestTimeout`      | 408    | Indicates that the server timed out waiting for the client request.                                |
| `Conflict`            | 409    | Indicates a conflict in the request, such as conflicting data.                                     |
| `Gone`                | 410    | Indicates that the requested resource is no longer available and will not return.                  |
| `InternalServerError` | 500    | Indicates an unexpected server error occurred.                                                     |
| `NotImplemented`      | 501    | Indicates that the requested functionality is not implemented on the server.                       |
| `ServiceUnavailable`  | 503    | Indicates that the server is temporarily unavailable, often due to maintenance or overload.        |

## Prefixing

Prefixes can be added to endpoints, groups, or an entire API to simplify the management of common paths. This is especially useful when defining multiple related endpoints that share a common base URL.

**Example** (Using Prefixes for Common Path Management)

```ts TODO
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"

const api = HttpApi.make("api")
  .add(
    HttpApiGroup.make("group")
      .add(
        HttpApiEndpoint.get("getRoot", "/")
          .addSuccess(Schema.String)
          // Prefix for this endpoint
          .prefix("/endpointPrefix")
      )
      .add(HttpApiEndpoint.get("getA", "/a").addSuccess(Schema.String))
      // Prefix for all endpoints in the group
      .prefix("/groupPrefix")
  )
  // Prefix for the entire API
  .prefix("/apiPrefix")
```

## Implementing a Server

After defining your API, you can implement a server to handle its endpoints. The `HttpApiBuilder` module provides tools to help you connect your API's structure to the logic that serves requests.

Here, we will create a simple example with a `getUser` endpoint organized within a `users` group.

**Example** (Defining the `users` Group and API)

```ts TODO
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})

const idParam = HttpApiSchema.param("id", Schema.FiniteFromString)

const usersGroup = HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("getUser")`/user/${idParam}`.addSuccess(User)
)

const api = HttpApi.make("myApi").add(usersGroup)
```

### Implementing a HttpApiGroup

The `HttpApiBuilder.group` API is used to implement a specific group of endpoints within an `HttpApi` definition. It requires the following inputs:

| Input                             | Description                                                             |
| --------------------------------- | ----------------------------------------------------------------------- |
| The complete `HttpApi` definition | The overall API structure that includes the group you are implementing. |
| The name of the group             | The specific group you are focusing on within the API.                  |
| A function to add handlers        | A function that defines how each endpoint in the group is handled.      |

Each endpoint in the group is connected to its logic using the `HttpApiBuilder.handle` method, which maps the endpoint's definition to its corresponding implementation.

The `HttpApiBuilder.group` API produces a `Layer` that can later be provided to the server implementation.

**Example** (Implementing a Group with Endpoint Logic)

```ts TODO
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { DateTime, Effect, Schema } from "effect"

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})

const idParam = HttpApiSchema.param("id", Schema.FiniteFromString)

const usersGroup = HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("getUser")`/user/${idParam}`.addSuccess(User)
)

const api = HttpApi.make("myApi").add(usersGroup)

// --------------------------------------------
// Implementation
// --------------------------------------------

//      ┌─── Layer<HttpApiGroup.ApiGroup<"myApi", "users">>
//      ▼
const usersGroupLive =
  //                    ┌─── The Whole API
  //                    │      ┌─── The Group you are implementing
  //                    ▼      ▼
  HttpApiBuilder.group(api, "users", (handlers) =>
    handlers.handle(
      //  ┌─── The Endpoint you are implementing
      //  ▼
      "getUser",
      // Provide the handler logic for the endpoint.
      // The parameters & payload are passed to the handler function.
      ({ path: { id } }) =>
        Effect.succeed(
          // Return a mock user object with the provided ID
          {
            id,
            name: "John Doe",
            createdAt: DateTime.unsafeNow()
          }
        )
    ))
```

Using `HttpApiBuilder.group`, you connect the structure of your API to its logic, enabling you to focus on each endpoint's functionality in isolation. Each handler receives the parameters and payload for the request, making it easy to process input and generate a response.

### Using Services Inside a HttpApiGroup

If your handlers need to use services, you can easily integrate them because the `HttpApiBuilder.group` API allows you to return an `Effect`. This ensures that external services can be accessed and utilized directly within your handlers.

**Example** (Using Services in a Group Implementation)

```ts TODO
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { Context, Effect, Schema } from "effect"

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})

const idParam = HttpApiSchema.param("id", Schema.FiniteFromString)

const usersGroup = HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("getUser")`/user/${idParam}`.addSuccess(User)
)

const api = HttpApi.make("myApi").add(usersGroup)

// --------------------------------------------
// Implementation
// --------------------------------------------

type User = typeof User.Type

// Define the UsersRepository service
class UsersRepository extends Context.Tag("UsersRepository")<
  UsersRepository,
  {
    readonly findById: (id: number) => Effect.Effect<User>
  }
>() {}

// Implement the `users` group with access to the UsersRepository service
//
//      ┌─── Layer<HttpApiGroup.ApiGroup<"myApi", "users">, never, UsersRepository>
//      ▼
const usersGroupLive = HttpApiBuilder.group(api, "users", (handlers) =>
  Effect.gen(function*() {
    // Access the UsersRepository service
    const repository = yield* UsersRepository
    return handlers.handle("getUser", ({ path: { id } }) => repository.findById(id))
  }))
```

### Implementing a HttpApi

Once all your groups are implemented, you can create a top-level implementation to combine them into a unified API. This is done using the `HttpApiBuilder.api` API, which generates a `Layer`. You then use `Layer.provide` to include the implementations of all the groups into the top-level `HttpApi`.

**Example** (Combining Group Implementations into a Top-Level API)

```ts TODO
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "@effect/platform"
import { DateTime, Effect, Layer, Schema } from "effect"

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})

const idParam = HttpApiSchema.param("id", Schema.FiniteFromString)

const usersGroup = HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("getUser")`/user/${idParam}`.addSuccess(User)
)

const api = HttpApi.make("myApi").add(usersGroup)

const usersGroupLive = HttpApiBuilder.group(
  api,
  "users",
  (handlers) =>
    handlers.handle("getUser", ({ path: { id } }) =>
      Effect.succeed({
        id,
        name: "John Doe",
        createdAt: DateTime.unsafeNow()
      }))
)

// Combine all group implementations into the top-level API
//
//      ┌─── Layer<HttpApi.Api, never, never>
//      ▼
const MyApiLive = HttpApiBuilder.api(api).pipe(Layer.provide(usersGroupLive))
```

### Serving the API

You can serve your API using the `HttpApiBuilder.serve` function. This utility builds an `HttpApp` from an `HttpApi` instance and uses an `HttpServer` to handle requests. Middleware can be added to customize or enhance the server's behavior.

**Example** (Setting Up and Serving an API with Middleware)

```ts TODO
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  HttpMiddleware,
  HttpServer
} from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { DateTime, Effect, Layer, Schema } from "effect"
import { createServer } from "node:http"

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})

const idParam = HttpApiSchema.param("id", Schema.FiniteFromString)

const usersGroup = HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("getUser")`/user/${idParam}`.addSuccess(User)
)

const api = HttpApi.make("myApi").add(usersGroup)

const usersGroupLive = HttpApiBuilder.group(
  api,
  "users",
  (handlers) =>
    handlers.handle("getUser", ({ path: { id } }) =>
      Effect.succeed({
        id,
        name: "John Doe",
        createdAt: DateTime.unsafeNow()
      }))
)

const MyApiLive = HttpApiBuilder.api(api).pipe(Layer.provide(usersGroupLive))

// Configure and serve the API
const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  // Add CORS middleware to handle cross-origin requests
  Layer.provide(HttpApiBuilder.middlewareCors()),
  // Provide the API implementation
  Layer.provide(MyApiLive),
  // Log the server's listening address
  HttpServer.withLogAddress,
  // Set up the Node.js HTTP server
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)

// Launch the server
Layer.launch(HttpLive).pipe(NodeRuntime.runMain)
```

### Accessing the HttpServerRequest

In some cases, you may need to access details about the incoming `HttpServerRequest` within an endpoint handler. The HttpServerRequest module provides access to the request object, allowing you to inspect properties such as the HTTP method or headers.

**Example** (Accessing the Request Object in a GET Endpoint)

```ts TODO
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpMiddleware, HttpServer } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer, Schema } from "effect"
import { createServer } from "node:http"

const api = HttpApi.make("myApi").add(
  HttpApiGroup.make("group").add(
    HttpApiEndpoint.get("get", "/").addSuccess(Schema.String)
  )
)

const groupLive = HttpApiBuilder.group(
  api,
  "group",
  (handlers) =>
    handlers.handle("get", ({ request }) =>
      Effect.gen(function*() {
        // Log the HTTP method for demonstration purposes
        console.log(request.method)

        // Return a response
        return "Hello, World!"
      }))
)

const MyApiLive = HttpApiBuilder.api(api).pipe(Layer.provide(groupLive))

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(MyApiLive),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)

Layer.launch(HttpLive).pipe(NodeRuntime.runMain)
```

### Streaming Requests

Streaming requests allow you to send large or continuous data streams to the server. In this example, we define an API that accepts a stream of binary data and decodes it into a string.

**Example** (Handling Streaming Requests)

```ts TODO
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  HttpMiddleware,
  HttpServer
} from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer, Schema } from "effect"
import { createServer } from "node:http"

const api = HttpApi.make("myApi").add(
  HttpApiGroup.make("group").add(
    HttpApiEndpoint.post("acceptStream", "/stream")
      // Define the payload as a Uint8Array with a specific encoding
      .setPayload(
        Schema.Uint8ArrayFromSelf.pipe(
          HttpApiSchema.withEncoding({
            kind: "Uint8Array",
            contentType: "application/octet-stream"
          })
        )
      )
      .addSuccess(Schema.String)
  )
)

const groupLive = HttpApiBuilder.group(api, "group", (handlers) =>
  handlers.handle("acceptStream", (req) =>
    // Decode the incoming binary data into a string
    Effect.succeed(new TextDecoder().decode(req.payload))))

const MyApiLive = HttpApiBuilder.api(api).pipe(Layer.provide(groupLive))

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(MyApiLive),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)

Layer.launch(HttpLive).pipe(NodeRuntime.runMain)
```

You can test the streaming request using `curl` or any tool that supports sending binary data. For example:

```sh
echo "abc" | curl -X POST 'http://localhost:3000/stream' --data-binary @- -H "Content-Type: application/octet-stream"
# Output: abc
```

### Streaming Responses

To handle streaming responses in your API, you can return a raw `HttpServerResponse`. The `HttpServerResponse.stream` function is designed to return a continuous stream of data as the response.

**Example** (Implementing a Streaming Endpoint)

```ts TODO
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  HttpMiddleware,
  HttpServer,
  HttpServerResponse
} from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Layer, Schedule, Schema, Stream } from "effect"
import { createServer } from "node:http"

// Define the API with a single streaming endpoint
const api = HttpApi.make("myApi").add(
  HttpApiGroup.make("group").add(
    HttpApiEndpoint.get("getStream", "/stream").addSuccess(
      Schema.String.pipe(
        HttpApiSchema.withEncoding({
          kind: "Text",
          contentType: "application/octet-stream"
        })
      )
    )
  )
)

// Simulate a stream of data
const stream = Stream.make("a", "b", "c").pipe(
  Stream.schedule(Schedule.spaced("500 millis")),
  Stream.map((s) => new TextEncoder().encode(s))
)

const groupLive = HttpApiBuilder.group(
  api,
  "group",
  (handlers) => handlers.handle("getStream", () => HttpServerResponse.stream(stream))
)

const MyApiLive = HttpApiBuilder.api(api).pipe(Layer.provide(groupLive))

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(MyApiLive),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)

Layer.launch(HttpLive).pipe(NodeRuntime.runMain)
```

You can test the streaming response using `curl` or any similar HTTP client that supports streaming:

```sh
curl 'http://localhost:3000/stream' --no-buffer
```

The response will stream data (`a`, `b`, `c`) with a 500ms interval between each item.

## Middlewares

### Defining Middleware

The `HttpApiMiddleware` module allows you to add middleware to your API. Middleware can enhance your API by introducing features like logging, authentication, or additional error handling.

You can define middleware using the `HttpApiMiddleware.Tag` class, which lets you specify:

| Option     | Description                                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `failure`  | A schema that describes any errors the middleware might return.                                                                                                                                                                 |
| `provides` | A `Context.Tag` representing the resource or data the middleware will provide to subsequent handlers.                                                                                                                           |
| `security` | Definitions from `HttpApiSecurity` that the middleware will implement, such as authentication mechanisms.                                                                                                                       |
| `optional` | A boolean indicating whether the request should continue if the middleware fails with an expected error. When `optional` is set to `true`, the `provides` and `failure` options do not affect the final error type or handlers. |

**Example** (Defining a Logger Middleware)

```ts TODO
import { HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware, HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

// Define a schema for errors returned by the logger middleware
class LoggerError extends Schema.TaggedError<LoggerError>()(
  "LoggerError",
  {}
) {}

// Extend the HttpApiMiddleware.Tag class to define the logger middleware tag
class Logger extends HttpApiMiddleware.Tag<Logger>()("Http/Logger", {
  // Optionally define the error schema for the middleware
  failure: LoggerError
}) {}

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})

const idParam = HttpApiSchema.param("id", Schema.FiniteFromString)

const usersGroup = HttpApiGroup.make("users")
  .add(
    HttpApiEndpoint.get("getUser")`/user/${idParam}`
      .addSuccess(User)
      // Apply the middleware to a single endpoint
      .middleware(Logger)
  )
  // Or apply the middleware to the entire group
  .middleware(Logger)
```

### Implementing HttpApiMiddleware

Once you have defined your `HttpApiMiddleware`, you can implement it as a `Layer`. This allows the middleware to be applied to specific API groups or endpoints, enabling modular and reusable behavior.

**Example** (Implementing and Using Logger Middleware)

```ts TODO
import { HttpApiMiddleware, HttpServerRequest } from "@effect/platform"
import { Effect, Layer } from "effect"

class Logger extends HttpApiMiddleware.Tag<Logger>()("Http/Logger") {}

const LoggerLive = Layer.effect(
  Logger,
  Effect.gen(function*() {
    yield* Effect.log("creating Logger middleware")

    // Middleware implementation as an Effect
    // that can access the `HttpServerRequest` context.
    return Effect.gen(function*() {
      const request = yield* HttpServerRequest.HttpServerRequest
      yield* Effect.log(`Request: ${request.method} ${request.url}`)
    })
  })
)
```

After implementing the middleware, you can attach it to your API groups or specific endpoints using the `Layer` APIs.

```ts TODO
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpServerRequest
} from "@effect/platform"
import { DateTime, Effect, Layer, Schema } from "effect"

// Define a schema for errors returned by the logger middleware
class LoggerError extends Schema.TaggedError<LoggerError>()(
  "LoggerError",
  {}
) {}

// Extend the HttpApiMiddleware.Tag class to define the logger middleware tag
class Logger extends HttpApiMiddleware.Tag<Logger>()("Http/Logger", {
  // Optionally define the error schema for the middleware
  failure: LoggerError
}) {}

const LoggerLive = Layer.effect(
  Logger,
  Effect.gen(function*() {
    yield* Effect.log("creating Logger middleware")

    // Middleware implementation as an Effect
    // that can access the `HttpServerRequest` context.
    return Effect.gen(function*() {
      const request = yield* HttpServerRequest.HttpServerRequest
      yield* Effect.log(`Request: ${request.method} ${request.url}`)
    })
  })
)

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})

const idParam = HttpApiSchema.param("id", Schema.FiniteFromString)

const usersGroup = HttpApiGroup.make("users")
  .add(
    HttpApiEndpoint.get("getUser")`/user/${idParam}`
      .addSuccess(User)
      // Apply the middleware to a single endpoint
      .middleware(Logger)
  )
  // Or apply the middleware to the entire group
  .middleware(Logger)

const api = HttpApi.make("myApi").add(usersGroup)

const usersGroupLive = HttpApiBuilder.group(
  api,
  "users",
  (handlers) =>
    handlers.handle("getUser", (req) =>
      Effect.succeed({
        id: req.path.id,
        name: "John Doe",
        createdAt: DateTime.unsafeNow()
      }))
).pipe(
  // Provide the Logger middleware to the group
  Layer.provide(LoggerLive)
)
```

### Defining security middleware

The `HttpApiSecurity` module enables you to add security annotations to your API. These annotations specify the type of authorization required to access specific endpoints.

Supported authorization types include:

| Authorization Type       | Description                                                      |
| ------------------------ | ---------------------------------------------------------------- |
| `HttpApiSecurity.apiKey` | API key authorization via headers, query parameters, or cookies. |
| `HttpApiSecurity.basic`  | HTTP Basic authentication.                                       |
| `HttpApiSecurity.bearer` | Bearer token authentication.                                     |

These security annotations can be used alongside `HttpApiMiddleware` to create middleware that protects your API endpoints.

**Example** (Defining Security Middleware)

```ts TODO
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity
} from "@effect/platform"
import { Context, Schema } from "effect"

// Define a schema for the "User"
class User extends Schema.Class<User>("User")({ id: Schema.Number }) {}

// Define a schema for the "Unauthorized" error
class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  // Specify the HTTP status code for unauthorized errors
  HttpApiSchema.annotations({ status: 401 })
) {}

// Define a Context.Tag for the authenticated user
class CurrentUser extends Context.Tag("CurrentUser")<CurrentUser, User>() {}

// Create the Authorization middleware
class Authorization extends HttpApiMiddleware.Tag<Authorization>()(
  "Authorization",
  {
    // Define the error schema for unauthorized access
    failure: Unauthorized,
    // Specify the resource this middleware will provide
    provides: CurrentUser,
    // Add security definitions
    security: {
      // ┌─── Custom name for the security definition
      // ▼
      myBearer: HttpApiSecurity.bearer
      // Additional security definitions can be added here.
      // They will attempt to be resolved in the order they are defined.
    }
  }
) {}

const api = HttpApi.make("api")
  .add(
    HttpApiGroup.make("group")
      .add(
        HttpApiEndpoint.get("get", "/")
          .addSuccess(Schema.String)
          // Apply the middleware to a single endpoint
          .middleware(Authorization)
      )
      // Or apply the middleware to the entire group
      .middleware(Authorization)
  )
  // Or apply the middleware to the entire API
  .middleware(Authorization)
```

### Implementing HttpApiSecurity middleware

When using `HttpApiSecurity` in your middleware, the implementation involves creating a `Layer` with security handlers tailored to your requirements. Below is an example demonstrating how to implement middleware for `HttpApiSecurity.bearer` authentication.

**Example** (Implementing Bearer Token Authentication Middleware)

```ts TODO
import { HttpApiMiddleware, HttpApiSchema, HttpApiSecurity } from "@effect/platform"
import { Context, Effect, Layer, Redacted, Schema } from "effect"

class User extends Schema.Class<User>("User")({ id: Schema.Number }) {}

class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  HttpApiSchema.annotations({ status: 401 })
) {}

class CurrentUser extends Context.Tag("CurrentUser")<CurrentUser, User>() {}

class Authorization extends HttpApiMiddleware.Tag<Authorization>()(
  "Authorization",
  {
    failure: Unauthorized,
    provides: CurrentUser,
    security: {
      myBearer: HttpApiSecurity.bearer
    }
  }
) {}

const AuthorizationLive = Layer.effect(
  Authorization,
  Effect.gen(function*() {
    yield* Effect.log("creating Authorization middleware")

    // Return the security handlers for the middleware
    return {
      // Define the handler for the Bearer token
      // The Bearer token is redacted for security
      myBearer: (bearerToken) =>
        Effect.gen(function*() {
          yield* Effect.log(
            "checking bearer token",
            Redacted.value(bearerToken)
          )
          // Return a mock User object as the CurrentUser
          return new User({ id: 1 })
        })
    }
  })
)
```

### Adding Descriptions to Security Definitions

The `HttpApiSecurity.annotate` function allows you to add metadata, such as a description, to your security definitions. This metadata is displayed in the Swagger documentation, making it easier for developers to understand your API's security requirements.

**Example** (Adding a Description to a Bearer Token Security Definition)

```ts TODO
import { HttpApiMiddleware, HttpApiSchema, HttpApiSecurity, OpenApi } from "@effect/platform"
import { Context, Schema } from "effect"

class User extends Schema.Class<User>("User")({ id: Schema.Number }) {}

class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  HttpApiSchema.annotations({ status: 401 })
) {}

class CurrentUser extends Context.Tag("CurrentUser")<CurrentUser, User>() {}

class Authorization extends HttpApiMiddleware.Tag<Authorization>()(
  "Authorization",
  {
    failure: Unauthorized,
    provides: CurrentUser,
    security: {
      myBearer: HttpApiSecurity.bearer.pipe(
        // Add a description to the security definition
        HttpApiSecurity.annotate(OpenApi.Description, "my description")
      )
    }
  }
) {}
```

### Setting HttpApiSecurity cookies

To set a security cookie from within a handler, you can use the `HttpApiBuilder.securitySetCookie` API. This method sets a cookie with default properties, including the `HttpOnly` and `Secure` flags, ensuring the cookie is not accessible via JavaScript and is transmitted over secure connections.

**Example** (Setting a Security Cookie in a Login Handler)

```ts TODO
// Define the security configuration for an API key stored in a cookie
const security = HttpApiSecurity.apiKey({
   // Specify that the API key is stored in a cookie
  in: "cookie"
   // Define the cookie name,
  key: "token"
})

const UsersApiLive = HttpApiBuilder.group(MyApi, "users", (handlers) =>
  handlers.handle("login", () =>
    // Set the security cookie with a redacted value
    HttpApiBuilder.securitySetCookie(security, Redacted.make("keep me secret"))
  )
)
```

## Serving Swagger documentation

You can add Swagger documentation to your API using the `HttpApiSwagger` module. This integration provides an interactive interface for developers to explore and test your API. To enable Swagger, you simply provide the `HttpApiSwagger.layer` to your server implementation.

**Example** (Adding Swagger Documentation to an API)

```ts TODO
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  HttpApiSwagger,
  HttpMiddleware,
  HttpServer
} from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { DateTime, Effect, Layer, Schema } from "effect"
import { createServer } from "node:http"

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})

const idParam = HttpApiSchema.param("id", Schema.FiniteFromString)

const usersGroup = HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("getUser")`/user/${idParam}`.addSuccess(User)
)

const api = HttpApi.make("myApi").add(usersGroup)

const usersGroupLive = HttpApiBuilder.group(
  api,
  "users",
  (handlers) =>
    handlers.handle("getUser", ({ path: { id } }) =>
      Effect.succeed({
        id,
        name: "John Doe",
        createdAt: DateTime.unsafeNow()
      }))
)

const MyApiLive = HttpApiBuilder.api(api).pipe(Layer.provide(usersGroupLive))

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  // Add the Swagger documentation layer
  Layer.provide(
    HttpApiSwagger.layer({
      // Specify the Swagger documentation path.
      // "/docs" is the default path.
      path: "/docs"
    })
  ),
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(MyApiLive),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)

Layer.launch(HttpLive).pipe(NodeRuntime.runMain)
```

![Swagger Documentation](./images/swagger-myapi.png)

### Adding OpenAPI Annotations

You can add OpenAPI annotations to your API to include metadata such as titles, descriptions, and more. These annotations help generate richer API documentation.

#### HttpApi

Below is a list of available annotations for a top-level `HttpApi`. They can be added using the `.annotate` method:

| Annotation                  | Description                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `HttpApi.AdditionalSchemas` | Adds custom schemas to the final OpenAPI specification. Only schemas with an `identifier` annotation are included. |
| `OpenApi.Description`       | Sets a general description for the API.                                                                            |
| `OpenApi.License`           | Defines the license used by the API.                                                                               |
| `OpenApi.Summary`           | Provides a brief summary of the API.                                                                               |
| `OpenApi.Servers`           | Lists server URLs and optional metadata such as variables.                                                         |
| `OpenApi.Override`          | Merges the supplied fields into the resulting specification.                                                       |
| `OpenApi.Transform`         | Allows you to modify the final specification with a custom function.                                               |

**Example** (Annotating the Top-Level API)

```ts TODO
import { HttpApi, OpenApi } from "@effect/platform"
import { Schema } from "effect"

const api = HttpApi.make("api")
  // Provide additional schemas
  .annotate(HttpApi.AdditionalSchemas, [
    Schema.String.annotations({ identifier: "MyString" })
  ])
  // Add a description
  .annotate(OpenApi.Description, "my description")
  // Set license information
  .annotate(OpenApi.License, { name: "MIT", url: "http://example.com" })
  // Provide a summary
  .annotate(OpenApi.Summary, "my summary")
  // Define servers
  .annotate(OpenApi.Servers, [
    {
      url: "http://example.com",
      description: "example",
      variables: { a: { default: "b", enum: ["c"], description: "d" } }
    }
  ])
  // Override parts of the generated specification
  .annotate(OpenApi.Override, {
    tags: [{ name: "a", description: "a-description" }]
  })
  // Apply a transform function to the final specification
  .annotate(OpenApi.Transform, (spec) => ({
    ...spec,
    tags: [...spec.tags, { name: "b", description: "b-description" }]
  }))

// Generate the OpenAPI specification from the annotated API
const spec = OpenApi.fromApi(api)

console.log(JSON.stringify(spec, null, 2))
/*
Output:
{
  "openapi": "3.1.0",
  "info": {
    "title": "Api",
    "version": "0.0.1",
    "description": "my description",
    "license": {
      "name": "MIT",
      "url": "http://example.com"
    },
    "summary": "my summary"
  },
  "paths": {},
  "tags": [
    { "name": "a", "description": "a-description" },
    { "name": "b", "description": "b-description" }
  ],
  "components": {
    "schemas": {
      "MyString": {
        "type": "string"
      }
    },
    "securitySchemes": {}
  },
  "security": [],
  "servers": [
    {
      "url": "http://example.com",
      "description": "example",
      "variables": {
        "a": {
          "default": "b",
          "enum": [
            "c"
          ],
          "description": "d"
        }
      }
    }
  ]
}
*/
```

#### HttpApiGroup

The following annotations can be added to an `HttpApiGroup`:

| Annotation             | Description                                                           |
| ---------------------- | --------------------------------------------------------------------- |
| `OpenApi.Description`  | Sets a description for this group.                                    |
| `OpenApi.ExternalDocs` | Provides external documentation links for the group.                  |
| `OpenApi.Override`     | Merges specified fields into the resulting specification.             |
| `OpenApi.Transform`    | Lets you modify the final group specification with a custom function. |
| `OpenApi.Exclude`      | Excludes the group from the final OpenAPI specification.              |

**Example** (Annotating a Group)

```ts TODO
import { HttpApi, HttpApiGroup, OpenApi } from "@effect/platform"

const api = HttpApi.make("api")
  .add(
    HttpApiGroup.make("group")
      // Add a description for the group
      .annotate(OpenApi.Description, "my description")
      // Provide external documentation links
      .annotate(OpenApi.ExternalDocs, {
        url: "http://example.com",
        description: "example"
      })
      // Override parts of the final output
      .annotate(OpenApi.Override, { name: "my name" })
      // Transform the final specification for this group
      .annotate(OpenApi.Transform, (spec) => ({
        ...spec,
        name: spec.name + "-transformed"
      }))
  )
  .add(
    HttpApiGroup.make("excluded")
      // Exclude the group from the final specification
      .annotate(OpenApi.Exclude, true)
  )

// Generate the OpenAPI spec
const spec = OpenApi.fromApi(api)

console.log(JSON.stringify(spec, null, 2))
/*
Output:
{
  "openapi": "3.1.0",
  "info": {
    "title": "Api",
    "version": "0.0.1"
  },
  "paths": {},
  "tags": [
    {
      "name": "my name-transformed",
      "description": "my description",
      "externalDocs": {
        "url": "http://example.com",
        "description": "example"
      }
    }
  ],
  "components": {
    "schemas": {},
    "securitySchemes": {}
  },
  "security": []
}
*/
```

#### HttpApiEndpoint

For an `HttpApiEndpoint`, you can use the following annotations:

| Annotation             | Description                                                                 |
| ---------------------- | --------------------------------------------------------------------------- |
| `OpenApi.Description`  | Adds a description for this endpoint.                                       |
| `OpenApi.Summary`      | Provides a short summary of the endpoint's purpose.                         |
| `OpenApi.Deprecated`   | Marks the endpoint as deprecated.                                           |
| `OpenApi.ExternalDocs` | Supplies external documentation links for the endpoint.                     |
| `OpenApi.Override`     | Merges specified fields into the resulting specification for this endpoint. |
| `OpenApi.Transform`    | Lets you modify the final endpoint specification with a custom function.    |
| `OpenApi.Exclude`      | Excludes the endpoint from the final OpenAPI specification.                 |

**Example** (Annotating an Endpoint)

```ts TODO
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import { Schema } from "effect"

const api = HttpApi.make("api").add(
  HttpApiGroup.make("group")
    .add(
      HttpApiEndpoint.get("get", "/")
        .addSuccess(Schema.String)
        // Add a description
        .annotate(OpenApi.Description, "my description")
        // Provide a summary
        .annotate(OpenApi.Summary, "my summary")
        // Mark the endpoint as deprecated
        .annotate(OpenApi.Deprecated, true)
        // Provide external documentation
        .annotate(OpenApi.ExternalDocs, {
          url: "http://example.com",
          description: "example"
        })
    )
    .add(
      HttpApiEndpoint.get("excluded", "/excluded")
        .addSuccess(Schema.String)
        // Exclude this endpoint from the final specification
        .annotate(OpenApi.Exclude, true)
    )
)

// Generate the OpenAPI spec
const spec = OpenApi.fromApi(api)

console.log(JSON.stringify(spec, null, 2))
/*
Output:
{
  "openapi": "3.1.0",
  "info": {
    "title": "Api",
    "version": "0.0.1"
  },
  "paths": {
    "/": {
      "get": {
        "tags": [
          "group"
        ],
        "operationId": "my operationId-transformed",
        "parameters": [],
        "security": [],
        "responses": {
          "200": {
            "description": "a string",
            "content": {
              "application/json": {
                "schema": {
                  "type": "string"
                }
              }
            }
          },
          "400": {
            "description": "The request did not match the expected schema",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HttpApiDecodeError"
                }
              }
            }
          }
        },
        "description": "my description",
        "summary": "my summary",
        "deprecated": true,
        "externalDocs": {
          "url": "http://example.com",
          "description": "example"
        }
      }
    }
  },
  ...
}
*/
```

The default response description is "Success". You can override this by annotating the schema.

**Example** (Defining a custom response description)

```ts TODO
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import { Schema } from "effect"

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
}).annotations({ identifier: "User" })

const api = HttpApi.make("api").add(
  HttpApiGroup.make("group").add(
    HttpApiEndpoint.get("getUsers", "/users").addSuccess(
      Schema.Array(User).annotations({
        description: "Returns an array of users"
      })
    )
  )
)

const spec = OpenApi.fromApi(api)

console.log(JSON.stringify(spec.paths, null, 2))
/*
Output:
{
  "/users": {
    "get": {
      "tags": [
        "group"
      ],
      "operationId": "group.getUsers",
      "parameters": [],
      "security": [],
      "responses": {
        "200": {
          "description": "Returns an array of users",
          "content": {
            "application/json": {
              "schema": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/User"
                },
                "description": "Returns an array of users"
              }
            }
          }
        },
        "400": {
          "description": "The request did not match the expected schema",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/HttpApiDecodeError"
              }
            }
          }
        }
      }
    }
  }
}
*/
```

### Top Level Groups

When a group is marked as `topLevel`, the operation IDs of its endpoints do not include the group name as a prefix. This is helpful when you want to group endpoints under a shared tag without adding a redundant prefix to their operation IDs.

**Example** (Using a Top-Level Group)

```ts TODO
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "@effect/platform"
import { Schema } from "effect"

const api = HttpApi.make("api").add(
  // Mark the group as top-level
  HttpApiGroup.make("group", { topLevel: true }).add(
    HttpApiEndpoint.get("get", "/").addSuccess(Schema.String)
  )
)

// Generate the OpenAPI spec
const spec = OpenApi.fromApi(api)

console.log(JSON.stringify(spec.paths, null, 2))
/*
Output:
{
  "/": {
    "get": {
      "tags": [
        "group"
      ],
      "operationId": "get", // The operation ID is not prefixed with "group"
      "parameters": [],
      "security": [],
      "responses": {
        "200": {
          "description": "a string",
          "content": {
            "application/json": {
              "schema": {
                "type": "string"
              }
            }
          }
        },
        "400": {
          "description": "The request did not match the expected schema",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/HttpApiDecodeError"
              }
            }
          }
        }
      }
    }
  }
}
*/
```

## Deriving a Client

After defining your API, you can derive a client that interacts with the server. The `HttpApiClient` module simplifies the process by providing tools to generate a client based on your API definition.

**Example** (Deriving and Using a Client)

This example demonstrates how to create a client for an API and use it to call an endpoint.

```ts TODO
import {
  FetchHttpClient,
  HttpApi,
  HttpApiBuilder,
  HttpApiClient,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  HttpApiSwagger,
  HttpMiddleware,
  HttpServer
} from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { DateTime, Effect, Layer, Schema } from "effect"
import { createServer } from "node:http"

const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  createdAt: Schema.DateTimeUtc
})

const idParam = HttpApiSchema.param("id", Schema.FiniteFromString)

const usersGroup = HttpApiGroup.make("users").add(
  HttpApiEndpoint.get("getUser")`/user/${idParam}`.addSuccess(User)
)

const api = HttpApi.make("myApi").add(usersGroup)

const usersGroupLive = HttpApiBuilder.group(
  api,
  "users",
  (handlers) =>
    handlers.handle("getUser", ({ path: { id } }) =>
      Effect.succeed({
        id,
        name: "John Doe",
        createdAt: DateTime.unsafeNow()
      }))
)

const MyApiLive = HttpApiBuilder.api(api).pipe(Layer.provide(usersGroupLive))

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(MyApiLive),
  HttpServer.withLogAddress,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)

Layer.launch(HttpLive).pipe(NodeRuntime.runMain)

// Create a program that derives and uses the client
const program = Effect.gen(function*() {
  // Derive the client
  const client = yield* HttpApiClient.make(api, {
    baseUrl: "http://localhost:3000"
  })
  // Call the `getUser` endpoint
  const user = yield* client.users.getUser({ path: { id: 1 } })
  console.log(user)
})

// Provide a Fetch-based HTTP client and run the program
Effect.runFork(program.pipe(Effect.provide(FetchHttpClient.layer)))
/*
Example Output:
User {
  id: 1,
  name: 'John Doe',
  createdAt: DateTime.Utc(2025-01-04T15:14:49.562Z)
}
*/
```

### Top Level Groups

When a group is marked as `topLevel`, the methods on the client are not nested under the group name. This can simplify client usage by providing direct access to the endpoint methods.

**Example** (Using a Top-Level Group in the Client)

```ts TODO
import { HttpApi, HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Effect, Schema } from "effect"

const api = HttpApi.make("api").add(
  // Mark the group as top-level
  HttpApiGroup.make("group", { topLevel: true }).add(
    HttpApiEndpoint.get("get", "/").addSuccess(Schema.String)
  )
)

const program = Effect.gen(function*() {
  const client = yield* HttpApiClient.make(api, {
    baseUrl: "http://localhost:3000"
  })
  // The `get` method is not nested under the "group" name
  const user = yield* client.get()
  console.log(user)
})
```

## Converting to a Web Handler

You can convert your `HttpApi` implementation into a web handler using the `HttpApiBuilder.toWebHandler` API. This approach enables you to serve your API through a custom server setup.

**Example** (Creating and Serving a Web Handler)

```ts TODO
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup, HttpApiSwagger, HttpServer } from "@effect/platform"
import { Effect, Layer, Schema } from "effect"
import * as http from "node:http"

const api = HttpApi.make("myApi").add(
  HttpApiGroup.make("group").add(
    HttpApiEndpoint.get("get", "/").addSuccess(Schema.String)
  )
)

const groupLive = HttpApiBuilder.group(
  api,
  "group",
  (handlers) => handlers.handle("get", () => Effect.succeed("Hello, world!"))
)

const MyApiLive = HttpApiBuilder.api(api).pipe(Layer.provide(groupLive))

const SwaggerLayer = HttpApiSwagger.layer().pipe(Layer.provide(MyApiLive))

// Convert the API to a web handler
const { dispose, handler } = HttpApiBuilder.toWebHandler(
  Layer.mergeAll(MyApiLive, SwaggerLayer, HttpServer.layerContext)
)

// Serving the handler using a custom HTTP server
http
  .createServer(async (req, res) => {
    const url = `http://${req.headers.host}${req.url}`
    const init: RequestInit = {
      method: req.method!
    }

    const response = await handler(new Request(url, init))

    res.writeHead(
      response.status,
      response.statusText,
      Object.fromEntries(response.headers.entries())
    )
    const responseBody = await response.arrayBuffer()
    res.end(Buffer.from(responseBody))
  })
  .listen(3000, () => {
    console.log("Server running at http://localhost:3000/")
  })
  .on("close", () => {
    dispose()
  })
```
