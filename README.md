# WannaCry Attack Propagation and Defense Simulator

An educational cybersecurity project that simulates ransomware-style infection propagation across a computer network and demonstrates defensive strategies.

## Features

- Interactive network visualization
- Probabilistic infection propagation
- Patch and isolate defensive controls
- Infection, protection, and vulnerability metrics
- Simulation history and security event log
- CSV report export
- Configurable patch coverage and infection probability

## Technology Stack

- **Frontend:** React, Vite, JavaScript, React Force Graph, Recharts
- **Backend:** Python, Flask, NetworkX

## Project Structure

- `backend/` – Simulation engine, API, metrics, and report generation
- `frontend/` – Interactive dashboard
- `docs/` – Project report and flowchart

## Run Locally

### Backend

From the project root, activate the virtual environment and start Flask:

```powershell
.\venv\Scripts\Activate.ps1
python backend/app.py
```

### Frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL shown by Vite in your browser.

## Disclaimer

This is a simplified educational simulation. It does not execute malware, exploit systems, or encrypt files.

## Author

Darshan Bhangale
