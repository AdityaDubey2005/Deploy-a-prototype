const API_URL = 'http://localhost:3001/api/todos';

let todos = [];

// DOM Elements
const todoInput = document.getElementById('todoInput');
const addBtn = document.getElementById('addBtn');
const todoList = document.getElementById('todoList');
const totalTasks = document.getElementById('totalTasks');
const completedTasks = document.getElementById('completedTasks');

// Event Listeners
addBtn.addEventListener('click', addTodo);
todoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTodo();
});

// Initialize
loadTodos();

// Functions
async function loadTodos() {
    try {
        const response = await fetch(API_URL);
        todos = await response.json();
        renderTodos();
    } catch (error) {
        console.error('Error loading todos:', error);
        showError('Failed to load todos');
    }
}

async function addTodo() {
    const text = todoInput.value.trim();

    if (!text) {
        alert('Please enter a task!');
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });

        const newTodo = await response.json();
        todos.push(newTodo);
        todoInput.value = '';
        renderTodos();
    } catch (error) {
        console.error('Error adding todo:', error);
        showError('Failed to add todo');
    }
}

async function toggleTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ completed: !todo.completed })
        });

        const updatedTodo = await response.json();
        const index = todos.findIndex(t => t.id === id);
        todos[index] = updatedTodo;
        renderTodos();
    } catch (error) {
        console.error('Error updating todo:', error);
        showError('Failed to update todo');
    }
}

async function deleteTodo(id) {
    try {
        await fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        });

        todos = todos.filter(t => t.id !== id);
        renderTodos();
    } catch (error) {
        console.error('Error deleting todo:', error);
        showError('Failed to delete todo');
    }
}

function renderTodos() {
    if (todos.length === 0) {
        todoList.innerHTML = '<div class="empty-state">No tasks yet. Add one above!</div>';
    } else {
        todoList.innerHTML = todos.map(todo => `
            <div class="todo-item ${todo.completed ? 'completed' : ''}">
                <input 
                    type="checkbox" 
                    class="todo-checkbox" 
                    ${todo.completed ? 'checked' : ''}
                    onchange="toggleTodo(${todo.id})"
                />
                <span class="todo-text">${todo.text}</span>
                <button class="delete-btn" onclick="deleteTodo(${todo.id})">Delete</button>
            </div>
        `).join('');
    }

    updateStats();
}

function updateStats() {
    const completed = todos.filter(t => t.completed).length;
    totalTasks.textContent = `${todos.length} task${todos.length !== 1 ? 's' : ''}`;
    completedTasks.textContent = `${completed} completed`;
}

function showError(message) {
    alert(message);
}
