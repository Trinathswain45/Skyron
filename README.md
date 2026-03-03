# Skyron

Cloud-Native Real-Time Task Processing Platform.

## What is implemented now
- FastAPI backend + worker + React frontend
- Kafka async processing with retry + DLQ
- WebSocket task status updates with polling fallback
- DLQ inspection APIs (`/dlq`, `/dlq/{task_id}`)
- Production-oriented Dockerization:
  - multi-stage builds
  - non-root containers
  - image version build args
  - healthchecks
  - reduced runtime footprint
- Production-grade Kubernetes manifests:
  - separate `dev` and `prod` namespaces
  - ConfigMaps + Secrets
  - resource requests/limits
  - readiness/liveness probes
  - HPA for worker (and backend in prod)
- CI/CD workflow scaffold (`.github/workflows/ci-cd.yml`):
  - lint/static checks + frontend build
  - image build/push to Docker Hub
  - Kubernetes deploy step

## Local Run
1. Copy env:
   - PowerShell: `Copy-Item .env.example .env`
2. Start:
   - `docker compose up --build`
3. Open:
   - Frontend: `http://localhost:5173`
   - Backend docs: `http://localhost:8000/docs`

## Failure Simulation
- Submit payload like `fail:test` to test retries and DLQ.

## Kubernetes
- Read: `k8s/README.md`

## CI/CD Secrets Needed
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `KUBECONFIG_B64`
