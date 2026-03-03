Param(
  [string]$Namespace = "skyron-dev"
)

$ErrorActionPreference = "Stop"

Write-Host "[1/7] Checking kubectl connectivity..."
kubectl cluster-info | Out-Null

Write-Host "[2/7] Checking metrics-server (required for HPA)..."
kubectl top nodes | Out-Null

Write-Host "[3/7] Deploying Skyron dev manifests..."
kubectl apply -f k8s/manifests/dev/skyron.yaml | Out-Null

Write-Host "[4/7] Waiting for core deployments..."
kubectl -n $Namespace rollout status deployment/skyron-backend --timeout=180s | Out-Null
kubectl -n $Namespace rollout status deployment/skyron-worker --timeout=180s | Out-Null
kubectl -n $Namespace rollout status deployment/skyron-frontend --timeout=180s | Out-Null

Write-Host "[5/7] Starting backend load generator..."
kubectl apply -f k8s/manifests/dev/loadtest-backend.yaml | Out-Null
Start-Sleep -Seconds 20

Write-Host "[6/7] Current HPA state:"
kubectl -n $Namespace get hpa

Write-Host "[7/7] Current pod replica counts:"
kubectl -n $Namespace get deploy skyron-backend skyron-worker

Write-Host "Done."
Write-Host "To stop load generation: kubectl -n $Namespace delete -f k8s/manifests/dev/loadtest-backend.yaml"
Write-Host "To view live scaling: kubectl -n $Namespace get hpa -w"
