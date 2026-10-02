#!/usr/bin/env python3
"""Activate approved V1 shared stores and on-demand workers in Amplify.

Existing branch variables are preserved and no values are printed. This script
does not configure an operator subject; that identity must be supplied by the
owner and is managed separately.
"""
import json
import subprocess

APP_ID = "dzxvs1esr22z9"
BRANCH = "main"
REGION = "us-east-2"
STACK = "binary2048-v1-workers"


def aws(*args):
    result = subprocess.run(
        ["aws", *args, "--region", REGION, "--output", "json"],
        capture_output=True,
        text=True,
    )
    if result.returncode:
        raise RuntimeError("AWS operation failed: " + " ".join(args[:2]))
    return json.loads(result.stdout or "{}")


def main():
    stack = aws("cloudformation", "describe-stacks", "--stack-name", STACK)["Stacks"][0]
    if stack["StackStatus"] != "CREATE_COMPLETE" and stack["StackStatus"] != "UPDATE_COMPLETE":
        raise RuntimeError("Worker stack is not ready")
    outputs = {item["OutputKey"]: item["OutputValue"] for item in stack.get("Outputs", [])}
    branch = aws("amplify", "get-branch", "--app-id", APP_ID, "--branch-name", BRANCH)["branch"]
    environment = dict(branch.get("environmentVariables", {}))
    environment.update(
        {
            "BINARY2048_INVENTORY_STORE": "mongo",
            "BINARY2048_SESSION_STORE": "mongo",
            "BINARY2048_OPS_STORE": "mongo",
            "BINARY2048_WORKER_MODE": "sqs",
            "BINARY2048_WORKER_REGION": REGION,
            "BINARY2048_TOURNAMENT_QUEUE_URL": outputs["TournamentQueueUrl"],
            "BINARY2048_TRAINING_QUEUE_URL": outputs["TrainingQueueUrl"],
        }
    )
    aws(
        "amplify",
        "update-branch",
        "--app-id",
        APP_ID,
        "--branch-name",
        BRANCH,
        "--environment-variables",
        json.dumps(environment, separators=(",", ":")),
    )
    print(
        json.dumps(
            {
                "branch": BRANCH,
                "inventory": "mongo",
                "sessions": "mongo",
                "ops": "mongo",
                "workers": "sqs",
                "operatorSubjectChanged": False,
            }
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error) if isinstance(error, RuntimeError) else "Production configuration failed; sensitive details suppressed.")
        raise SystemExit(1)
