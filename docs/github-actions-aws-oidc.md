# Binary-2048 GitHub Actions AWS OIDC Setup

## Purpose

This document gives the exact AWS-side trust policy and the GitHub-side values needed for the `Amplify Deploy Watch` workflow to authenticate without long-lived AWS access keys.

The repository-side workflow already supports this path.

## What You Will Configure

You will create:

- one IAM OIDC identity provider for GitHub Actions, if it does not already exist
- one IAM role that GitHub Actions can assume
- one repository secret in GitHub:
  - `AWS_ROLE_TO_ASSUME`

You will not need these repo secrets once OIDC is in place:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

## Repository Values

These values are specific to this repo:

- GitHub owner: `alankelsey`
- GitHub repo: `Binary-2048`
- branch: `main`
- workflow using OIDC: `.github/workflows/amplify-deploy-watch.yml`
- AWS account: `750629424234`
- AWS region: `us-east-2`

## Step 1: Create GitHub OIDC Provider In AWS

Run this once per AWS account if it does not already exist:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

If it already exists, AWS will return an error and you can continue.

## Step 2: Create The IAM Trust Policy

Save this as `github-actions-oidc-trust-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::750629424234:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:alankelsey/Binary-2048:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

This restricts access to:

- this AWS account
- this GitHub repository
- the `main` branch only

## Step 3: Create The IAM Role

Recommended role name:

- `GitHubActionsAmplifyDeployWatchRole`

Create it:

```bash
aws iam create-role \
  --role-name GitHubActionsAmplifyDeployWatchRole \
  --assume-role-policy-document file://github-actions-oidc-trust-policy.json
```

## Step 4: Attach The Minimum Policy For This Workflow

Save this as `github-actions-amplify-watch-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AmplifyReadDeployStatus",
      "Effect": "Allow",
      "Action": [
        "amplify:GetApp",
        "amplify:GetBranch",
        "amplify:GetDomainAssociation",
        "amplify:GetJob",
        "amplify:ListApps",
        "amplify:ListBranches",
        "amplify:ListDomainAssociations",
        "amplify:ListJobs",
        "amplify:StartJob"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ReadSsmParametersForAmplifyVerification",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ],
      "Resource": [
        "arn:aws:ssm:us-east-2:750629424234:parameter/amplify/dzxvs1esr22z9/*"
      ]
    },
    {
      "Sid": "ReadCloudWatchLogsForTroubleshooting",
      "Effect": "Allow",
      "Action": [
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:GetLogEvents",
        "logs:FilterLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

Attach it as an inline policy:

```bash
aws iam put-role-policy \
  --role-name GitHubActionsAmplifyDeployWatchRole \
  --policy-name GitHubActionsAmplifyDeployWatchPolicy \
  --policy-document file://github-actions-amplify-watch-policy.json
```

## Step 5: Add The GitHub Secret

In GitHub:

- Repo -> Settings -> Secrets and variables -> Actions -> New repository secret

Create:

- `AWS_ROLE_TO_ASSUME`

Value:

```text
arn:aws:iam::750629424234:role/GitHubActionsAmplifyDeployWatchRole
```

That is the only GitHub Actions secret needed for AWS auth on this workflow once OIDC is set up.

## Step 6: Re-Run The Workflow

After the role and secret are in place:

1. open Actions in GitHub
2. run `Amplify Deploy Watch` manually

Or push a small commit to `main`.

## Expected Behavior

The workflow will now:

- use OIDC automatically when `AWS_ROLE_TO_ASSUME` is set
- skip the static access-key path
- continue to watch Amplify deploys and run production verification

## Optional Hardening

Later, if you want tighter restrictions, you can narrow the trust policy further:

- restrict to the workflow file using `job_workflow_ref`
- restrict to a GitHub environment if you move deploys behind environments

For now, branch restriction to `main` is the cleanest practical setup.

## Quick Verification

Once configured, the old credential-loading error should disappear.

If it still fails, the likely causes are:

- wrong repo secret value for `AWS_ROLE_TO_ASSUME`
- missing GitHub OIDC provider in AWS
- typo in repo/branch name inside the trust policy
- role policy missing `amplify:GetJob` or `amplify:StartJob`
