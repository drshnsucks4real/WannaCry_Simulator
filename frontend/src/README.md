# WannaCry Attack Propagation and Defense Simulator

An educational cybersecurity project that simulates ransomware-style infection propagation across a computer network and demonstrates defensive measures.

## Features

- Interactive computer network visualization
- Probabilistic infection propagation
- Computer patching and isolation
- Infection and protection metrics
- Simulation history and security event log
- CSV report export
- Configurable patch coverage and infection probability

## Technology Stack

**Frontend:** React, Vite, JavaScript, React Force Graph, Recharts

**Backend:** Python, Flask, NetworkX

## Project Structure

- `backend/` – Simulation engine, API endpoints, metrics and CSV reporting
- `frontend/` – Interactive dashboard
- `docs/` – Project report and flowchart

## Run Locally

### 1. Start the backend

From the project root, open a terminal:

```powershell
.\venv\Scripts\Activate.ps1
python backend/app.py
```

### 2. Start the frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite in your browser.

## Disclaimer

This project is a simplified educational simulation. It does not execute malware, exploit systems, or encrypt files.

## Author

Darshan Bhangale
