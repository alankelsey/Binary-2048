import fs from "node:fs";
import path from "node:path";

type Resource = { Type: string; Properties: Record<string, unknown> };
const template = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "infra/v1/workers.json"), "utf8")
) as { Resources: Record<string, Resource> };

const resources = template.Resources;
const alarmNames = [
  "ComputeErrorsAlarm", "ComputeThrottlesAlarm", "ComputeDurationAlarm",
  "ComputeConcurrencyAlarm", "ComputeQueueAgeAlarm", "ComputeDeadLetterAlarm",
  "TrainingErrorsAlarm", "TrainingThrottlesAlarm", "TrainingDurationAlarm",
  "TrainingConcurrencyAlarm", "TrainingQueueAgeAlarm", "TrainingDeadLetterAlarm"
];

describe("worker isolation infrastructure", () => {
  it.each([
    ["TournamentFunction", "TournamentMapping", "research-compute"],
    ["TrainingFunction", "TrainingMapping", "training"]
  ])("caps %s CPU/time and queue concurrency", (functionId, mappingId, workloadClass) => {
    const fn = resources[functionId].Properties;
    const mapping = resources[mappingId].Properties;
    expect(fn.MemorySize).toBe(2048);
    expect(fn.Timeout).toBe(60);
    expect(fn.ReservedConcurrentExecutions).toBeUndefined();
    expect(fn.Tags).toContainEqual({ Key: "WorkloadClass", Value: workloadClass });
    expect(mapping.BatchSize).toBe(1);
    expect((mapping.ScalingConfig as { MaximumConcurrency: number }).MaximumConcurrency).toBe(2);
  });

  it("installs distinct actionable health, saturation, backlog, and DLQ alarms", () => {
    expect(alarmNames).toHaveLength(12);
    for (const id of alarmNames) {
      const alarm = resources[id];
      expect(alarm.Type).toBe("AWS::CloudWatch::Alarm");
      expect(alarm.Properties.TreatMissingData).toBe("notBreaching");
      expect(alarm.Properties.AlarmActions).toEqual([
        { "Fn::Sub": "arn:aws:sns:${AWS::Region}:${AWS::AccountId}:Default_CloudWatch_Alarms_Topic" }
      ]);
    }
    expect(resources.ComputeDurationAlarm.Properties).toMatchObject({ ExtendedStatistic: "p95", Threshold: 55000 });
    expect(resources.TrainingDurationAlarm.Properties).toMatchObject({ ExtendedStatistic: "p95", Threshold: 55000 });
    expect(resources.ComputeConcurrencyAlarm.Properties).toMatchObject({ Threshold: 2, EvaluationPeriods: 3, DatapointsToAlarm: 3 });
    expect(resources.TrainingConcurrencyAlarm.Properties).toMatchObject({ Threshold: 2, EvaluationPeriods: 3, DatapointsToAlarm: 3 });
    expect(resources.ComputeQueueAgeAlarm.Properties).toMatchObject({ Namespace: "AWS/SQS", Threshold: 300 });
    expect(resources.TrainingQueueAgeAlarm.Properties).toMatchObject({ Namespace: "AWS/SQS", Threshold: 300 });
  });

  it("tags both queues and dead-letter queues for workload cost attribution", () => {
    for (const [id, workloadClass] of [
      ["TournamentQueue", "research-compute"], ["TournamentDLQ", "research-compute"],
      ["TrainingQueue", "training"], ["TrainingDLQ", "training"]
    ]) {
      expect(resources[id].Properties.Tags).toContainEqual({ Key: "WorkloadClass", Value: workloadClass });
    }
  });
});
