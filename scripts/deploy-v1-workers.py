#!/usr/bin/env python3
"""Deploy the approved V1 workers, preserving credentials outside logs and Git.
Usage: python3 scripts/deploy-v1-workers.py
Activates queues/workers/15-minute aggregation only; app cutover is separate.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import zipfile

REGION = 'us-east-2'
APP = 'dzxvs1esr22z9'
STACK = 'binary2048-v1-workers'

def aws(*args):
    result = subprocess.run(['aws', *args, '--region', REGION, '--output', 'json'], capture_output=True, text=True)
    if result.returncode:
        # Never echo AWS arguments or environment values.
        raise RuntimeError('AWS operation failed: ' + ' '.join(args[:2]))
    return json.loads(result.stdout or '{}')

def main():
    subprocess.run(['node', 'scripts/build-v1-workers.mjs'], check=True)
    with tempfile.TemporaryDirectory(prefix='binary2048-workers-') as tmp:
        artifact = Path(tmp) / 'workers.zip'
        with zipfile.ZipFile(artifact, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name in ['index.js', 'telemetry.js']:
                archive.write(Path('/tmp/binary2048-v1-workers') / name, name)
        digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
        key = f'infra/v1-workers/{digest}.zip'
        aws('s3api', 'put-object', '--bucket', 'binary2048', '--key', key, '--body', str(artifact), '--server-side-encryption', 'AES256')
        app = aws('amplify', 'get-app', '--app-id', APP)['app']
        branch = aws('amplify', 'get-branch', '--app-id', APP, '--branch-name', 'main')['branch']
        env = {**app.get('environmentVariables', {}), **branch.get('environmentVariables', {})}
        if not env.get('BINARY2048_MONGO_URI'):
            raise RuntimeError('Existing database configuration is missing')
        request = {
            'StackName': STACK,
            'TemplateBody': Path('infra/v1/workers.json').read_text(),
            'Parameters': [
                {'ParameterKey': 'MongoUri', 'ParameterValue': env['BINARY2048_MONGO_URI']},
                {'ParameterKey': 'ArtifactBucket', 'ParameterValue': 'binary2048'},
                {'ParameterKey': 'ArtifactKey', 'ParameterValue': key},
            ],
            'Capabilities': ['CAPABILITY_IAM'],
            'Tags': [{'Key': 'Project', 'Value': 'Binary2048'}, {'Key': 'Stage', 'Value': 'v1'}],
        }
        path = Path(tmp) / 'request.json'
        path.write_text(json.dumps(request)); os.chmod(path, 0o600)
        try:
            existing = aws('cloudformation', 'describe-stacks', '--stack-name', STACK)['Stacks'][0]
            if existing['StackStatus'] == 'ROLLBACK_COMPLETE':
                aws('cloudformation', 'delete-stack', '--stack-name', STACK)
                for _ in range(12):
                    time.sleep(5)
                    try: aws('cloudformation', 'describe-stacks', '--stack-name', STACK)
                    except RuntimeError: break
                else: raise RuntimeError('Failed stack cleanup still running; retry deployment later')
                action = 'create-stack'
            elif existing['StackStatus'].endswith('_IN_PROGRESS'):
                raise RuntimeError('Stack operation still in progress; retry deployment later')
            else:
                action = 'update-stack'
        except RuntimeError as error:
            if str(error) != 'AWS operation failed: cloudformation describe-stacks': raise
            action = 'create-stack'
        response = aws('cloudformation', action, '--cli-input-json', 'file://' + str(path))
        print(json.dumps({'stack': STACK, 'action': action, 'artifactSHA256': digest, 'stackId': response.get('StackId')}))

if __name__ == '__main__':
    try: main()
    except Exception as error:
        print(str(error) if isinstance(error, RuntimeError) else 'Worker deployment failed; sensitive details suppressed.')
        raise SystemExit(1)
