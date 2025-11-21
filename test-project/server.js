const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage for todos
let todos = [
    { id: 1, text: 'Learn DevOps', completed: false },
    { id: 2, text: 'Test AI Agent', completed: false },
    { id: 3, text: 'Deploy to production', completed: false }
];

let nextId = 4;

// Routes
// Get all todos
app.get('/api/todos', (req, res) => {
    res.json(todos);
});

// Get single todo
app.get('/api/todos/:id', (req, res) => {
    const todo = todos.find(t => t.id === parseInt(req.params.id));
    if (!todo) {
        return res.status(404).json({ error: 'Todo not found' });
    }
    res.json(todo);
});

// Create new todo
app.post('/api/todos', (req, res) => {
    const { text } = req.body;

    if (!text || text.trim() === '') {
        return res.status(400).json({ error: 'Todo text is required' });
    }

    const newTodo = {
        id: nextId++,
        text: text.trim(),
        completed: false
    };

    todos.push(newTodo);
    res.status(201).json(newTodo);
});

// Update todo
app.put('/api/todos/:id', (req, res) => {
    const todo = todos.find(t => t.id === parseInt(req.params.id));

    if (!todo) {
        return res.status(404).json({ error: 'Todo not found' });
    }

    if (req.body.text !== undefined) {
        todo.text = req.body.text;
    }

    if (req.body.completed !== undefined) {
        todo.completed = req.body.completed;
    }

    res.json(todo);
});

// Delete todo
app.delete('/api/todos/:id', (req, res) => {
    const index = todos.findIndex(t => t.id === parseInt(req.params.id));

    if (index === -1) {
        return res.status(404).json({ error: 'Todo not found' });
    }

    todos.splice(index, 1);
    res.status(204).send();
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', todos: todos.length });
});

app.listen(PORT, () => {
    console.log(`Todo API server running on http://localhost:${PORT}`);
});

module.exports = app;
