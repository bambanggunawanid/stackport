"""ECS (Elastic Container Service) routes for cluster, service, task, and task definition management."""

from typing import Any

from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException, Query

from backend.aws_client import get_client
from backend.routes.common import EndpointInfo, get_endpoint_info

router = APIRouter()


def _get_cluster_name_from_arn(arn: str) -> str:
    """Extract cluster name from ARN."""
    # arn:aws:ecs:region:account-id:cluster/cluster-name
    if "/" in arn:
        return arn.split("/")[-1]
    return arn


def _get_service_name_from_arn(arn: str) -> str:
    """Extract service name from ARN."""
    # arn:aws:ecs:region:account-id:service/cluster-name/service-name
    parts = arn.split("/")
    if len(parts) >= 3:
        return parts[-1]
    return arn


def _get_task_definition_family_revision(arn: str) -> tuple[str, str]:
    """Extract family and revision from task definition ARN."""
    # arn:aws:ecs:region:account-id:task-definition/family:revision
    if "/" in arn and ":" in arn.split("/")[-1]:
        parts = arn.split("/")
        family_rev = parts[-1]
        family, revision = family_rev.rsplit(":", 1)
        return family, revision
    return "", ""


@router.get("/clusters")
def list_clusters(ep: EndpointInfo = Depends(get_endpoint_info)) -> dict[str, Any]:
    """List all ECS clusters with enriched metadata."""
    try:
        client = get_client("ecs", **ep.client_kwargs())

        # List all clusters
        list_response = client.list_clusters()
        cluster_arns = list_response.get("clusterArns", [])

        if not cluster_arns:
            return {"clusters": []}

        # Describe all clusters
        describe_response = client.describe_clusters(clusters=cluster_arns, include=["SETTINGS", "STATISTICS"])
        clusters = []

        for cluster_data in describe_response.get("clusters", []):
            cluster_name = cluster_data.get("clusterName", "")
            statistics = {stat["name"]: stat["value"] for stat in cluster_data.get("statistics", [])}
            settings = {s["name"]: s["value"] for s in cluster_data.get("settings", [])}

            clusters.append({
                "clusterArn": cluster_data.get("clusterArn"),
                "clusterName": cluster_name,
                "status": cluster_data.get("status", "UNKNOWN"),
                "registeredContainerInstancesCount": cluster_data.get("registeredContainerInstancesCount", 0),
                "runningTasksCount": cluster_data.get("runningTasksCount", 0),
                "pendingTasksCount": cluster_data.get("pendingTasksCount", 0),
                "activeServicesCount": cluster_data.get("activeServicesCount", 0),
                "statistics": statistics,
                "settings": settings,
                "tags": cluster_data.get("tags", []),
            })

        return {"clusters": clusters}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/clusters/{cluster_name}")
def get_cluster_detail(cluster_name: str, ep: EndpointInfo = Depends(get_endpoint_info)) -> dict[str, Any]:
    """Get detailed information for a specific cluster."""
    try:
        client = get_client("ecs", **ep.client_kwargs())

        # Describe cluster with all details
        response = client.describe_clusters(
            clusters=[cluster_name],
            include=["SETTINGS", "STATISTICS", "CONFIGURATIONS"]
        )

        clusters = response.get("clusters", [])
        if not clusters:
            raise HTTPException(status_code=404, detail=f"Cluster '{cluster_name}' not found")

        cluster_data = clusters[0]
        cluster_arn = cluster_data.get("clusterArn", "")
        statistics = {stat["name"]: stat["value"] for stat in cluster_data.get("statistics", [])}
        settings = {s["name"]: s["value"] for s in cluster_data.get("settings", [])}
        configurations = cluster_data.get("configurations", [])

        return {
            "cluster": {
                "clusterArn": cluster_arn,
                "clusterName": cluster_data.get("clusterName"),
                "status": cluster_data.get("status"),
                "registeredContainerInstancesCount": cluster_data.get("registeredContainerInstancesCount", 0),
                "runningTasksCount": cluster_data.get("runningTasksCount", 0),
                "pendingTasksCount": cluster_data.get("pendingTasksCount", 0),
                "activeServicesCount": cluster_data.get("activeServicesCount", 0),
                "statistics": statistics,
                "settings": settings,
                "configurations": configurations,
                "tags": cluster_data.get("tags", []),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/clusters/{cluster_name}/services")
def list_cluster_services(cluster_name: str, ep: EndpointInfo = Depends(get_endpoint_info)) -> dict[str, Any]:
    """List all services in a cluster with enriched metadata."""
    try:
        client = get_client("ecs", **ep.client_kwargs())

        # List services
        list_response = client.list_services(cluster=cluster_name)
        service_arns = list_response.get("serviceArns", [])

        if not service_arns:
            return {"services": []}

        # Describe services (max 10 at a time per AWS API)
        services = []
        for i in range(0, len(service_arns), 10):
            batch = service_arns[i:i+10]
            describe_response = client.describe_services(cluster=cluster_name, services=batch, include=["TAGS"])

            for svc in describe_response.get("services", []):
                service_arn = svc.get("serviceArn", "")
                service_name = _get_service_name_from_arn(service_arn)

                # Parse deployment status
                deployments = svc.get("deployments", [])
                deployment_status = "UNKNOWN"
                for dep in deployments:
                    if dep.get("status") == "PRIMARY":
                        deployment_status = "RUNNING"
                        break
                    elif dep.get("status") == "ACTIVE":
                        deployment_status = "ACTIVE"

                services.append({
                    "serviceArn": service_arn,
                    "serviceName": service_name,
                    "clusterArn": svc.get("clusterArn"),
                    "status": svc.get("status", "UNKNOWN"),
                    "desiredCount": svc.get("desiredCount", 0),
                    "runningCount": svc.get("runningCount", 0),
                    "pendingCount": svc.get("pendingCount", 0),
                    "launchType": svc.get("launchType", "EC2"),
                    "platformVersion": svc.get("platformVersion"),
                    "taskDefinition": svc.get("taskDefinition"),
                    "deploymentStatus": deployment_status,
                    "deployments": deployments,
                    "loadBalancers": svc.get("loadBalancers", []),
                    "networkConfiguration": svc.get("networkConfiguration", {}),
                    "healthCheckGracePeriodSeconds": svc.get("healthCheckGracePeriodSeconds"),
                    "schedulingStrategy": svc.get("schedulingStrategy", "REPLICA"),
                    "capacityProviderStrategy": svc.get("capacityProviderStrategy", []),
                    "tags": svc.get("tags", []),
                })

        return {"services": services}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/clusters/{cluster_name}/services/{service_name}")
def get_service_detail(cluster_name: str, service_name: str, ep: EndpointInfo = Depends(get_endpoint_info)) -> dict[str, Any]:
    """Get detailed information for a specific service."""
    try:
        client = get_client("ecs", **ep.client_kwargs())

        response = client.describe_services(
            cluster=cluster_name,
            services=[service_name],
            include=["TAGS"]
        )

        services = response.get("services", [])
        if not services:
            raise HTTPException(status_code=404, detail=f"Service '{service_name}' not found in cluster '{cluster_name}'")

        svc = services[0]
        service_arn = svc.get("serviceArn", "")

        return {
            "service": {
                "serviceArn": service_arn,
                "serviceName": _get_service_name_from_arn(service_arn),
                "clusterArn": svc.get("clusterArn"),
                "clusterName": cluster_name,
                "status": svc.get("status"),
                "desiredCount": svc.get("desiredCount", 0),
                "runningCount": svc.get("runningCount", 0),
                "pendingCount": svc.get("pendingCount", 0),
                "launchType": svc.get("launchType"),
                "platformVersion": svc.get("platformVersion"),
                "taskDefinition": svc.get("taskDefinition"),
                "deployments": svc.get("deployments", []),
                "loadBalancers": svc.get("loadBalancers", []),
                "networkConfiguration": svc.get("networkConfiguration", {}),
                "healthCheckGracePeriodSeconds": svc.get("healthCheckGracePeriodSeconds"),
                "schedulingStrategy": svc.get("schedulingStrategy"),
                "capacityProviderStrategy": svc.get("capacityProviderStrategy", []),
                "placementConstraints": svc.get("placementConstraints", []),
                "placementStrategy": svc.get("placementStrategy", []),
                "serviceConnectConfiguration": svc.get("serviceConnectConfiguration"),
                "serviceRegistries": svc.get("serviceRegistries", []),
                "propagateTags": svc.get("propagateTags"),
                "enableECSManagedTags": svc.get("enableECSManagedTags"),
                "enableExecuteCommand": svc.get("enableExecuteCommand"),
                "tags": svc.get("tags", []),
                "events": svc.get("events", [])[:20],  # Last 20 events
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/clusters/{cluster_name}/tasks")
def list_cluster_tasks(
    cluster_name: str,
    status: str = Query(default="RUNNING", description="Filter by task status: RUNNING, STOPPED, or ALL"),
    ep: EndpointInfo = Depends(get_endpoint_info),
) -> dict[str, Any]:
    """List tasks in a cluster with enriched metadata."""
    try:
        client = get_client("ecs", **ep.client_kwargs())

        # Determine which statuses to query
        if status.upper() == "ALL":
            statuses = ["RUNNING", "STOPPED"]
        else:
            statuses = [status.upper()]

        all_task_arns = []
        for task_status in statuses:
            list_response = client.list_tasks(cluster=cluster_name, desiredStatus=task_status)
            all_task_arns.extend(list_response.get("taskArns", []))

        if not all_task_arns:
            return {"tasks": []}

        # Describe tasks (max 100 at a time per AWS API)
        tasks = []
        for i in range(0, len(all_task_arns), 100):
            batch = all_task_arns[i:i+100]
            describe_response = client.describe_tasks(cluster=cluster_name, tasks=batch, include=["TAGS"])

            for task in describe_response.get("tasks", []):
                task_arn = task.get("taskArn", "")
                task_id = task_arn.split("/")[-1] if "/" in task_arn else task_arn
                containers = task.get("containers", [])

                # Extract container summaries
                container_summaries = []
                for c in containers:
                    container_summaries.append({
                        "containerArn": c.get("containerArn"),
                        "name": c.get("name"),
                        "image": c.get("image"),
                        "lastStatus": c.get("lastStatus"),
                        "healthStatus": c.get("healthStatus", "UNKNOWN"),
                        "cpu": c.get("cpu"),
                        "memory": c.get("memory"),
                        "managedAgents": c.get("managedAgents", []),
                    })

                task_obj = {
                    "taskArn": task_arn,
                    "taskId": task_id,
                    "clusterArn": task.get("clusterArn"),
                    "taskDefinitionArn": task.get("taskDefinitionArn"),
                    "containerInstanceArn": task.get("containerInstanceArn"),
                    "lastStatus": task.get("lastStatus", "UNKNOWN"),
                    "desiredStatus": task.get("desiredStatus"),
                    "startedAt": task.get("startedAt").isoformat() if task.get("startedAt") else None,
                    "stoppedAt": task.get("stoppedAt").isoformat() if task.get("stoppedAt") else None,
                    "stoppedReason": task.get("stoppedReason"),
                    "stopCode": task.get("stopCode"),
                    "launchType": task.get("launchType"),
                    "platformVersion": task.get("platformVersion"),
                    "group": task.get("group"),
                    "containers": container_summaries,
                    "attachments": task.get("attachments", []),
                    "tags": task.get("tags", []),
                }

                # Add health status summary
                unhealthy_count = sum(1 for c in container_summaries if c.get("healthStatus") == "UNHEALTHY")
                task_obj["unhealthyContainers"] = unhealthy_count

                tasks.append(task_obj)

        return {"tasks": tasks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/clusters/{cluster_name}/tasks/{task_id}")
def get_task_detail(cluster_name: str, task_id: str, ep: EndpointInfo = Depends(get_endpoint_info)) -> dict[str, Any]:
    """Get detailed information for a specific task."""
    try:
        client = get_client("ecs", **ep.client_kwargs())

        # Describe task
        describe_response = client.describe_tasks(cluster=cluster_name, tasks=[task_id], include=["TAGS"])
        tasks = describe_response.get("tasks", [])

        if not tasks:
            raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found in cluster '{cluster_name}'")

        task = tasks[0]
        containers = task.get("containers", [])

        # Enrich container details
        enriched_containers = []
        for c in containers:
            network_bindings = c.get("networkBindings", [])
            network_interfaces = c.get("networkInterfaces", [])

            enriched_containers.append({
                "containerArn": c.get("containerArn"),
                "name": c.get("name"),
                "image": c.get("image"),
                "lastStatus": c.get("lastStatus"),
                "healthStatus": c.get("healthStatus", "UNKNOWN"),
                "cpu": c.get("cpu"),
                "memory": c.get("memory"),
                "memoryReservation": c.get("memoryReservation"),
                "gpuIds": c.get("gpuIds", []),
                "networkBindings": network_bindings,
                "networkInterfaces": network_interfaces,
                "logConfiguration": c.get("logConfiguration"),
                "reason": c.get("reason"),
                "exitCode": c.get("exitCode"),
                "managedAgents": c.get("managedAgents", []),
            })

        return {
            "task": {
                "taskArn": task.get("taskArn"),
                "taskId": task_id,
                "clusterArn": task.get("clusterArn"),
                "clusterName": cluster_name,
                "taskDefinitionArn": task.get("taskDefinitionArn"),
                "containerInstanceArn": task.get("containerInstanceArn"),
                "lastStatus": task.get("lastStatus"),
                "desiredStatus": task.get("desiredStatus"),
                "startedAt": task.get("startedAt").isoformat() if task.get("startedAt") else None,
                "startedBy": task.get("startedBy"),
                "stoppedAt": task.get("stoppedAt").isoformat() if task.get("stoppedAt") else None,
                "stoppedReason": task.get("stoppedReason"),
                "stopCode": task.get("stopCode"),
                "launchType": task.get("launchType"),
                "platformVersion": task.get("platformVersion"),
                "group": task.get("group"),
                "family": task.get("group", "").split(":")[0] if task.get("group") else None,
                "containers": enriched_containers,
                "attachments": task.get("attachments", []),
                "capacityProviderName": task.get("capacityProviderName"),
                "tags": task.get("tags", []),
                "pullStartedAt": task.get("pullStartedAt").isoformat() if task.get("pullStartedAt") else None,
                "pullStoppedAt": task.get("pullStoppedAt").isoformat() if task.get("pullStoppedAt") else None,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/task-definitions")
def list_task_definition_families(ep: EndpointInfo = Depends(get_endpoint_info)) -> dict[str, Any]:
    """List all task definition families."""
    try:
        client = get_client("ecs", **ep.client_kwargs())

        # List all families
        families = []
        paginator = client.get_paginator("list_task_definition_families")
        for page in paginator.paginate():
            families.extend(page.get("families", []))

        return {"families": sorted(families)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/task-definitions/{family}")
def list_task_definition_revisions(family: str, ep: EndpointInfo = Depends(get_endpoint_info)) -> dict[str, Any]:
    """List all revisions for a task definition family."""
    try:
        client = get_client("ecs", **ep.client_kwargs())

        # List all revisions for this family
        arns = []
        paginator = client.get_paginator("list_task_definitions")
        for page in paginator.paginate(familyPrefix=family):
            arns.extend(page.get("taskDefinitionArns", []))

        # Parse family and revision from ARNs
        revisions = []
        for arn in arns:
            fam, rev = _get_task_definition_family_revision(arn)
            if fam == family:
                revisions.append({
                    "revision": rev,
                    "arn": arn,
                    "family": fam,
                })

        # Sort by revision number descending
        revisions.sort(key=lambda x: int(x["revision"]) if x["revision"].isdigit() else 0, reverse=True)

        return {"revisions": revisions, "family": family}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/task-definitions/{family}/{revision}")
def get_task_definition_detail(family: str, revision: str, ep: EndpointInfo = Depends(get_endpoint_info)) -> dict[str, Any]:
    """Get detailed information for a specific task definition."""
    try:
        client = get_client("ecs", **ep.client_kwargs())

        # Describe task definition
        response = client.describe_task_definition(
            taskDefinition=f"{family}:{revision}",
            include=["TAGS", "TAGS"]
        )

        if not response:
            raise HTTPException(status_code=404, detail=f"Task definition '{family}:{revision}' not found")

        task_def = response.get("taskDefinition", {})
        container_definitions = task_def.get("containerDefinitions", [])

        # Enrich container definitions with log group links
        enriched_containers = []
        for cd in container_definitions:
            log_config = cd.get("logConfiguration", {})
            log_options = log_config.get("options", {})
            log_group = log_options.get("awslogs-group")

            enriched_containers.append({
                "name": cd.get("name"),
                "image": cd.get("image"),
                "cpu": cd.get("cpu", 0),
                "memory": cd.get("memory"),
                "memoryReservation": cd.get("memoryReservation"),
                "essential": cd.get("essential", False),
                "command": cd.get("command", []),
                "entryPoint": cd.get("entryPoint", []),
                "environment": cd.get("environment", []),
                "secrets": cd.get("secrets", []),
                "portMappings": cd.get("portMappings", []),
                "volumesFrom": cd.get("volumesFrom", []),
                "mountPoints": cd.get("mountPoints", []),
                "logConfiguration": log_config,
                "logGroup": log_group,
                "logDriver": log_config.get("logDriver"),
                "healthCheck": cd.get("healthCheck"),
                "dependsOn": cd.get("dependsOn", []),
                "repositoryCredentials": cd.get("repositoryCredentials"),
                "linuxParameters": cd.get("linuxParameters"),
                "dockerSecurityOptions": cd.get("dockerSecurityOptions", []),
                "ulimits": cd.get("ulimits", []),
                "dnsServers": cd.get("dnsServers", []),
                "dnsSearchDomains": cd.get("dnsSearchDomains", []),
                "extraHosts": cd.get("extraHosts", []),
                "interactive": cd.get("interactive", False),
                "pseudoTerminal": cd.get("pseudoTerminal", False),
            })

        return {
            "taskDefinition": {
                "taskDefinitionArn": task_def.get("taskDefinitionArn"),
                "family": task_def.get("family"),
                "revision": task_def.get("revision"),
                "status": task_def.get("status"),
                "taskRoleArn": task_def.get("taskRoleArn"),
                "executionRoleArn": task_def.get("executionRoleArn"),
                "networkMode": task_def.get("networkMode", "bridge"),
                "containerDefinitions": enriched_containers,
                "volumes": task_def.get("volumes", []),
                "placementConstraints": task_def.get("placementConstraints", []),
                "requiresCompatibilities": task_def.get("requiresCompatibilities", []),
                "cpu": task_def.get("cpu"),
                "memory": task_def.get("memory"),
                "runtimePlatform": task_def.get("runtimePlatform"),
                "pidMode": task_def.get("pidMode"),
                "ipcMode": task_def.get("ipcMode"),
                "proxyConfiguration": task_def.get("proxyConfiguration"),
                "inferenceAccelerators": task_def.get("inferenceAccelerators", []),
                "ephemeralStorage": task_def.get("ephemeralStorage"),
                "tags": task_def.get("tags", []),
                "registeredAt": task_def.get("registeredAt").isoformat() if task_def.get("registeredAt") else None,
                "registeredBy": task_def.get("registeredBy"),
            }
        }
    except HTTPException:
        raise
    except client.exceptions.ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code in ("ClientException", "ClusterNotFoundException", "ServiceNotFoundException", "TaskNotFoundException", "TaskDefinitionNotFoundException"):
            raise HTTPException(status_code=404, detail=f"Task definition '{family}:{revision}' not found")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
