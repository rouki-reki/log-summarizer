# Log Summarizer

This project implements a system that receives logs, stores them, and automatically creates hierarchical summaries based on a predefined threshold (5 nodes trigger a summary of the next level). It also provides a web-based GUI to visualize the log/summary structure in real-time.

## Features

*   **Log Ingestion**: Accepts new log entries via an HTTP API.
*   **Hierarchical Summarization**: Automatically creates summary nodes when 5 nodes of the same level accumulate.
*   **Real-time GUI**: Visualizes the log and summary node structure using a graph representation. Allows adding logs manually through the interface.
*   **WebSocket Updates**: Uses WebSockets to push real-time updates to the GUI when new logs or summaries are created.

## Technology Stack

*   **Backend**: Node.js, Express, TypeScript, ws (WebSocket library)
*   **Frontend**: React, TypeScript, axios, @xyflow/react (React Flow)
*   **Database**: Simple In-Memory store (for demonstration purposes)

## Getting Started

### Prerequisites

*   Node.js (v16 or later recommended)
*   npm (usually comes with Node.js)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/rouki-reki/log-summarizer.git
    cd log-summarizer
    ```
2.  Install backend dependencies:
    ```bash
    npm install
    ```
3.  Install frontend dependencies:
    ```bash
    cd client
    npm install
    cd ..
    ```

### Running the Application

You need to run both the backend server and the frontend development server.

1.  **Start the Backend Server (API + WebSocket):**
    Open a terminal in the root directory (`log-summarizer`) and run:
    ```bash
    npx ts-node src/server.ts
    ```
    The backend server will start on `http://localhost:52381`.

2.  **Start the Frontend Development Server (GUI):**
    Open another terminal in the `client` directory (`log-summarizer/client`) and run:
    ```bash
    npm start
    ```
    The frontend development server will start, and it should automatically open the GUI in your default browser at `http://localhost:3005`. If it doesn't open automatically, navigate to that URL manually.

### Using the GUI

*   The GUI will connect to the backend WebSocket automatically. The status should show "Connected".
*   Enter log messages in the input field and click "Add Log".
*   The graph display will update in real-time, showing log nodes (green) and summary nodes (orange) as they are created.
*   You can pan and zoom the graph using the controls or your mouse/trackpad.

### Using the API (Optional)

You can also interact with the backend API directly:

*   **Add Log (POST /logs):**
    ```bash
    curl -X POST http://localhost:52381/logs -H "Content-Type: application/json" -d '{"content": "Log message from API"}'
    ```
*   **Get All Nodes (GET /logs):**
    ```bash
    curl http://localhost:52381/logs
    ```
*   **Get Node by ID (GET /logs/:id):**
    ```bash
    curl http://localhost:52381/logs/<node_id>
    ```

## Project Structure

```
log-summarizer/
├── client/         # Frontend React application
│   ├── public/
│   └── src/
├── coverage/       # Test coverage reports
├── node_modules/   # Backend dependencies
├── src/            # Backend source code
│   ├── controllers/
│   ├── database/
│   ├── models/
│   ├── routes/
│   └── services/
├── tests/          # Backend tests
├── .gitignore
├── jest.config.js
├── package-lock.json
├── package.json
├── README.md       # This file
├── REQUIREMENTS.md # System requirements definition
├── TEST_PLAN.md    # Test plan definition
└── tsconfig.json   # Backend TypeScript configuration
```