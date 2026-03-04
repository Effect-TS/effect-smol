Create an HttpApi server with the following endpoints:

### Todos

- `GET /todos`: Retrieve a list of all todos.
- `POST /todos`: Create a new todo. The request body should contain the todo details (e.g., title, description, completed).
- `GET /todos/{id}`: Retrieve a specific todo by its ID.
- `PUT /todos/{id}`: Update an existing todo by its ID. The request body should contain the updated todo details.
- `DELETE /todos/{id}`: Delete a specific todo by its ID.

A todo should have the following structure:

```json
{
  "id": "string",
  "title": "string",
  "completed": "boolean",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

Todos should be persisted using sqlite.
