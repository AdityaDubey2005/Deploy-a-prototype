# DevOps Todo App 🚀

A simple to-do list application for testing the DevOps AI Agent capabilities.

## Features

- ✅ Create, read, update, and delete todos
- ✅ Mark todos as complete/incomplete
- ✅ RESTful API
- ✅ Modern, responsive UI
- ✅ Docker support

## Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start the server
npm start

# Or run in development mode with auto-reload
npm run dev
```

The app will be available at `http://localhost:3001`

## API Endpoints

- `GET /api/todos` - Get all todos
- `GET /api/todos/:id` - Get a specific todo
- `POST /api/todos` - Create a new todo
- `PUT /api/todos/:id` - Update a todo
- `DELETE /api/todos/:id` - Delete a todo
- `GET /health` - Health check

## Docker Deployment

```bash
# Build the Docker image
docker build -t todo-app .

# Run the container
docker run -p 3001:3001 todo-app
```

## Testing with DevOps Agent

This project is designed to test various DevOps agent capabilities:

1. **Code Review**: Ask the agent to review `server.js`
2. **Generate Tests**: Request test generation for API endpoints
3. **Analyze Logs**: Test log analysis features
4. **Docker Deployment**: Test containerization commands
5. **PR Creation**: Test GitHub integration features

## Project Structure

```
test-project/
├── server.js          # Express API server
├── public/
│   ├── index.html     # Frontend HTML
│   ├── style.css      # Styling
│   └── app.js         # Frontend JavaScript
├── Dockerfile         # Docker configuration
├── package.json       # Dependencies
└── README.md          # This file
```

## Example Usage

### Using the UI
1. Open `http://localhost:3001` in your browser
2. Add tasks using the input field
3. Click checkboxes to mark tasks as complete
4. Click Delete to remove tasks

### Using the API (curl examples)

```bash
# Get all todos
curl http://localhost:3001/api/todos

# Create a new todo
curl -X POST http://localhost:3001/api/todos \
  -H "Content-Type: application/json" \
  -d '{"text":"My new task"}'

# Update a todo
curl -X PUT http://localhost:3001/api/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"completed":true}'

# Delete a todo
curl -X DELETE http://localhost:3001/api/todos/1
```

## License

MIT
