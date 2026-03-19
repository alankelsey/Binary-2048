import { readFileSync } from "fs";
import { join } from "path";

describe("fixed egress CloudFormation template", () => {
  const repoRoot = join(__dirname, "..", "..");
  const template = readFileSync(join(repoRoot, "infra", "fixed-egress-vpc-template.yml"), "utf8");

  it("defines the baseline network resources for NAT-backed egress", () => {
    expect(template).toContain("Type: AWS::EC2::VPC");
    expect(template).toContain("Type: AWS::EC2::NatGateway");
    expect(template).toContain("Type: AWS::EC2::EIP");
    expect(template).toContain("Type: AWS::EC2::Subnet");
    expect(template).toContain("Type: AWS::EC2::SecurityGroup");
    expect(template).toContain("NatElasticIp:");
  });
});
