# Skyron Kubernetes

## Environments
- Dev manifest: `k8s/manifests/dev/skyron.yaml`
- Prod manifest: `k8s/manifests/prod/skyron.yaml`

## Included Features
- Separate namespaces: `skyron-dev`, `skyron-prod`
- ConfigMap and Secret separation
- CPU/memory requests and limits
- Liveness/readiness probes
- HPA (CPU target 70%)

## Step 2 Local Validation (Minikube)
1. Start local infra (outside cluster):
   - `docker compose up -d postgres zookeeper kafka`
2. Build images into Minikube Docker daemon:
   - `minikube docker-env --shell powershell | Invoke-Expression`
   - `docker build -t skyron/backend:0.1.0 ./backend`
   - `docker build -t skyron/worker:0.1.0 ./worker`
   - `docker build -t skyron/frontend:0.1.0 ./frontend`
3. Ensure metrics-server is enabled:
   - `minikube addons enable metrics-server`
   - `kubectl top nodes`
4. Deploy dev environment:
   - `kubectl apply -f k8s/manifests/dev/skyron.yaml`
5. Wait for rollout:
   - `kubectl -n skyron-dev rollout status deployment/skyron-backend`
   - `kubectl -n skyron-dev rollout status deployment/skyron-worker`
   - `kubectl -n skyron-dev rollout status deployment/skyron-frontend`
6. Verify backend API:
   - `kubectl -n skyron-dev port-forward svc/skyron-backend 8000:8000`
   - open `http://localhost:8000/docs`
7. Verify frontend:
   - `kubectl -n skyron-dev port-forward svc/skyron-frontend 5173:80`
   - open `http://localhost:5173`
8. Run HPA validation:
   - `kubectl apply -f k8s/manifests/dev/loadtest-backend.yaml`
   - `kubectl -n skyron-dev get hpa -w`
   - `kubectl -n skyron-dev get deploy skyron-backend skyron-worker -w`
9. Stop load test:
   - `kubectl -n skyron-dev delete -f k8s/manifests/dev/loadtest-backend.yaml`

## Optional One-Command Validation Script
- `powershell -ExecutionPolicy Bypass -File k8s/scripts/verify-dev.ps1`

## Prod Apply
- `kubectl apply -f k8s/manifests/prod/skyron.yaml`

## Notes
- Requires metrics server for HPA:
  - `kubectl top pods -A` must work.
- Replace prod `DATABASE_URL` secret placeholder before deployment.
