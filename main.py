
import networkx as nx
import random

random.seed(42)

# Create 60 simulated computers
network = nx.barabasi_albert_graph(
    n=60,
    m=2,
    seed=42
)

# Initially, all computers are vulnerable
for computer in network.nodes:
    network.nodes[computer]["status"] = "vulnerable"

# Patch 12 computers
computers = list(network.nodes)
random.shuffle(computers)

for computer in computers[:12]:
    network.nodes[computer]["status"] = "patched"

# Infect one vulnerable computer
for computer in computers:
    if network.nodes[computer]["status"] == "vulnerable":
        network.nodes[computer]["status"] = "infected"
        break


def count_status(status):
    return sum(
        network.nodes[computer]["status"] == status
        for computer in network.nodes
    )


def simulate_step():
    newly_infected = []

    # Check the neighbors of currently infected computers
    for computer in network.nodes:
        if network.nodes[computer]["status"] != "infected":
            continue

        for neighbor in network.neighbors(computer):
            if network.nodes[neighbor]["status"] == "vulnerable":
                if random.random() < 0.35:
                    newly_infected.append(neighbor)

    # Update statuses after checking the whole network
    for computer in set(newly_infected):
        network.nodes[computer]["status"] = "infected"


print("WannaCry Network Simulator")
print("--------------------------")

for step in range(6):
    print(
        f"Step {step}: "
        f"Infected = {count_status('infected')}, "
        f"Vulnerable = {count_status('vulnerable')}, "
        f"Patched = {count_status('patched')}"
    )

    simulate_step()

print("\nSimulation completed!")
