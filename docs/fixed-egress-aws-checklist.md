# Binary-2048 Fixed Egress AWS Checklist

## Purpose

This checklist covers the AWS resources we can prepare before the live cutover.

It pairs with:

- [Fixed Egress Migration Runbook](./fixed-egress-migration-runbook.md)
- [Production Egress Decision](./production-egress-decision.md)

## What This Stack Creates

The template in `infra/fixed-egress-vpc-template.yml` creates:

- one VPC
- one public subnet
- two private subnets
- one Internet Gateway
- one NAT Gateway
- one Elastic IP for stable outbound traffic
- one workload security group
- route tables for public and private egress

This is the minimum AWS network baseline needed for a NAT-backed fixed-egress workload.

## What This Stack Does Not Create

This template intentionally does not create:

- Lambda functions
- ECS services
- ALB or API Gateway
- Secrets Manager values
- IAM execution roles for the migrated workload
- CloudWatch alarms
- Atlas network allowlist entries

Those are separate cutover concerns.

## Deployment Inputs

Required:

- AWS account with permission to create VPC/NAT/EC2 networking resources
- target region
- chosen stack name

Optional:

- custom CIDR blocks if the defaults conflict with existing networks

## Deploy Command

Example:

```bash
aws cloudformation deploy \
  --template-file infra/fixed-egress-vpc-template.yml \
  --stack-name binary2048-fixed-egress \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-2 \
  --parameter-overrides ProjectName=binary2048
```

## Post-Deploy Outputs To Capture

After stack creation, record:

- `VpcId`
- `PublicSubnetId`
- `PrivateSubnetAId`
- `PrivateSubnetBId`
- `WorkloadSecurityGroupId`
- `NatElasticIp`
- `NatGatewayId`

The most important value for Atlas cutover is:

- `NatElasticIp`

## Next Steps After Stack Creation

1. deploy the Mongo-backed runtime in the private subnets
2. attach the workload security group
3. confirm outbound internet access through the NAT path
4. add the NAT Elastic IP to Atlas Network Access
5. run storage and replay verification against the new runtime
6. remove the temporary broad Atlas allowlist only after successful verification

## Safety Notes

- do not remove the broad Atlas allowlist before the migrated runtime is verified
- start with a shadow path or direct-runtime smoke tests before production cutover
- expect a monthly NAT cost floor as soon as this stack exists

## Definition Of Ready

The AWS side is ready for cutover when:

- the CloudFormation stack is deployed successfully
- the NAT Elastic IP is known and stable
- private-subnet compute can reach Atlas and S3
- migrated route handlers are already packaged and deployable
