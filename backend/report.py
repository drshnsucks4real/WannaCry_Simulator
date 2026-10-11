
from datetime import datetime
import csv
import io


def generate_csv_report(data):
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["WannaCry Propagation Simulator Report"])
    writer.writerow(["Generated At", datetime.now().isoformat(timespec="seconds")])
    writer.writerow(["Total Computers", data["total"]])
    writer.writerow(["Simulation Step", data["step"]])
    writer.writerow(["Patch Coverage", data["patch_coverage"]])
    writer.writerow([
        "Infection Probability",
        data["infection_chance"]
    ])

    writer.writerow([])
    writer.writerow(["Status", "Count"])

    for status, count in data["counts"].items():
        writer.writerow([status.title(), count])

    writer.writerow([])
    writer.writerow([
        "Computer ID",
        "Status"
    ])

    for node in data["nodes"]:
        writer.writerow([
            f"PC-{int(node['id']) + 1}",
            node["status"]
        ])

    writer.writerow([])
    writer.writerow([
        "Step",
        "Infected",
        "Vulnerable",
        "Patched",
        "Isolated"
    ])

    for entry in data["history"]:
        writer.writerow([
            entry["step"],
            entry["infected"],
            entry["vulnerable"],
            entry["patched"],
            entry["isolated"]
        ])

    return output.getvalue()
