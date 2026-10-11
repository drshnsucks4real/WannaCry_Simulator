
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
import networkx as nx
import random

from report import generate_csv_report

app = Flask(__name__)
CORS(app)

TOTAL_COMPUTERS = 30
DEFAULT_PATCH_PERCENT = 20
DEFAULT_INFECTION_CHANCE = 0.35

PATCHED_PERCENT = DEFAULT_PATCH_PERCENT
INFECTION_CHANCE = DEFAULT_INFECTION_CHANCE

network = None
step_count = 0
rng = random.Random(42)
history = []
events = []

MAX_EVENTS = 100


def record_event(event_type, computer, message):
    events.insert(0, {
        "id": len(events) + 1,
        "step": step_count,
        "type": event_type,
        "computer": f"PC-{computer + 1}" if computer is not None else "NETWORK",
        "message": message
    })

    del events[MAX_EVENTS:]


def get_counts():
    statuses = ["vulnerable", "infected", "patched", "isolated"]

    return {
        status: sum(
            network.nodes[computer]["status"] == status
            for computer in network.nodes
        )
        for status in statuses
    }


def record_history():
    counts = get_counts()

    history.append({
        "step": step_count,
        "infected": counts["infected"],
        "vulnerable": counts["vulnerable"],
        "patched": counts["patched"],
        "isolated": counts["isolated"]
    })


def create_network():
    global network, step_count, rng, history, events

    rng = random.Random(42)
    history = []
    events = []

    network = nx.watts_strogatz_graph(
        n=TOTAL_COMPUTERS,
        k=4,
        p=0.15,
        seed=42
    )

    for computer in network.nodes:
        network.nodes[computer]["status"] = "vulnerable"

    computers = list(network.nodes)
    rng.shuffle(computers)

    patched_count = round(
        TOTAL_COMPUTERS * PATCHED_PERCENT / 100
    )

    for computer in computers[:patched_count]:
        network.nodes[computer]["status"] = "patched"

    initial_infected = None

    for computer in computers:
        if network.nodes[computer]["status"] == "vulnerable":
            network.nodes[computer]["status"] = "infected"
            initial_infected = computer
            break

    step_count = 0
    record_history()

    if initial_infected is not None:
        record_event(
            "infection",
            initial_infected,
            f"{computer_name(initial_infected)} is the initial infected host."
        )

    record_event(
        "system",
        None,
        "A new simulation has started."
    )


def computer_name(computer):
    return f"PC-{computer + 1}"


def get_network_data():
    nodes = [
        {
            "id": str(computer),
            "status": network.nodes[computer]["status"]
        }
        for computer in network.nodes
    ]

    links = [
        {
            "source": str(source),
            "target": str(target)
        }
        for source, target in network.edges
    ]

    return {
        "nodes": nodes,
        "links": links,
        "counts": get_counts(),
        "step": step_count,
        "total": TOTAL_COMPUTERS,
        "patch_coverage": PATCHED_PERCENT,
        "infection_chance": INFECTION_CHANCE,
        "history": history,
        "events": events
    }


def get_computer_id(computer_id):
    try:
        computer = int(computer_id)
    except (ValueError, TypeError):
        return None

    if computer not in network.nodes:
        return None

    return computer


@app.get("/")
def home():
    return jsonify({
        "message": "WannaCry Simulator API is running",
        "status": "ok"
    })


@app.get("/api/network")
def get_network():
    return jsonify(get_network_data())


@app.get("/api/events")
def get_events():
    return jsonify({"events": events})


@app.post("/api/step")
def next_step():
    global step_count

    newly_infected = set()

    for computer in network.nodes:
        if network.nodes[computer]["status"] != "infected":
            continue

        for neighbor in network.neighbors(computer):
            if network.nodes[neighbor]["status"] != "vulnerable":
                continue

            if rng.random() < INFECTION_CHANCE:
                newly_infected.add(neighbor)

    for computer in newly_infected:
        network.nodes[computer]["status"] = "infected"

        record_event(
            "infection",
            computer,
            f"{computer_name(computer)} became infected during propagation."
        )

    step_count += 1
    record_history()

    if not newly_infected:
        record_event(
            "simulation",
            None,
            "Propagation round completed. No new infections occurred."
        )

    return jsonify(get_network_data())


@app.post("/api/reset")
def reset():
    create_network()
    return jsonify(get_network_data())


@app.post("/api/patch/<computer_id>")
def patch_computer(computer_id):
    computer = get_computer_id(computer_id)

    if computer is None:
        return jsonify({"error": "Computer not found"}), 404

    if network.nodes[computer]["status"] != "vulnerable":
        return jsonify({
            "error": "Only vulnerable computers can be patched",
            "status": network.nodes[computer]["status"]
        }), 409

    network.nodes[computer]["status"] = "patched"

    record_history()
    record_event(
        "patch",
        computer,
        f"{computer_name(computer)} was patched successfully."
    )

    return jsonify({
        "message": f"{computer_name(computer)} patched successfully.",
        "network": get_network_data()
    })


@app.post("/api/isolate/<computer_id>")
def isolate_computer(computer_id):
    computer = get_computer_id(computer_id)

    if computer is None:
        return jsonify({"error": "Computer not found"}), 404

    if network.nodes[computer]["status"] == "isolated":
        return jsonify({
            "error": "Computer is already isolated."
        }), 409

    network.nodes[computer]["status"] = "isolated"

    record_history()
    record_event(
        "isolation",
        computer,
        f"{computer_name(computer)} was isolated from propagation."
    )

    return jsonify({
        "message": f"{computer_name(computer)} isolated successfully.",
        "network": get_network_data()
    })


@app.post("/api/config")
def update_config():
    global PATCHED_PERCENT, INFECTION_CHANCE

    data = request.get_json(silent=True) or {}

    try:
        new_patch_percent = float(
            data.get("patch_percent", PATCHED_PERCENT)
        )
        new_infection_chance = float(
            data.get("infection_chance", INFECTION_CHANCE)
        )
    except (ValueError, TypeError):
        return jsonify({
            "error": "Configuration values must be numbers."
        }), 400

    if not 0 <= new_patch_percent <= 100:
        return jsonify({
            "error": "Patch coverage must be between 0 and 100."
        }), 400

    if not 0 <= new_infection_chance <= 1:
        return jsonify({
            "error": "Infection probability must be between 0 and 1."
        }), 400

    PATCHED_PERCENT = new_patch_percent
    INFECTION_CHANCE = new_infection_chance

    create_network()

    return jsonify({
        "message": "Configuration updated. A new simulation has started.",
        **get_network_data()
    })


@app.get("/api/report")
def download_report():
    csv_data = generate_csv_report(get_network_data())

    return Response(
        csv_data,
        mimetype="text/csv; charset=utf-8",
        headers={
            "Content-Disposition":
                'attachment; filename="wannacry_simulation_report.csv"'
        }
    )


create_network()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
