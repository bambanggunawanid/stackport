"""Tests for ECS routes."""

from unittest.mock import patch, MagicMock
import pytest
from fastapi import status
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


@pytest.fixture
def mock_ecs_client():
    """Create a mock ECS client for patching."""
    with patch("backend.routes.ecs.get_client") as mock_get_client:
        mock_ecs = MagicMock()
        mock_get_client.return_value = mock_ecs

        # Setup paginator mock
        mock_paginator = MagicMock()
        mock_ecs.get_paginator.return_value = mock_paginator
        mock_paginator.paginate.return_value = []

        yield mock_ecs


@pytest.fixture
def mock_logs_client():
    """Create a mock Logs client for patching."""
    with patch("backend.routes.ecs.get_client") as mock_get_client:
        mock_logs = MagicMock()
        def get_client_side_effect(service, **kwargs):
            if service == "logs":
                return mock_logs
            return MagicMock()
        mock_get_client.side_effect = get_client_side_effect
        yield mock_logs


class TestListClusters:
    """Tests for GET /api/ecs/clusters."""

    def test_list_clusters_empty(self, mock_ecs_client):
        """Test listing clusters when none exist."""
        mock_ecs_client.list_clusters.return_value = {"clusterArns": []}

        response = client.get("/api/ecs/clusters")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "clusters" in data
        assert len(data["clusters"]) == 0

    def test_list_clusters(self, mock_ecs_client):
        """Test listing clusters with data."""
        cluster_arns = [
            "arn:aws:ecs:us-east-1:123456789012:cluster/test-cluster-0",
            "arn:aws:ecs:us-east-1:123456789012:cluster/test-cluster-1",
        ]
        mock_ecs_client.list_clusters.return_value = {"clusterArns": cluster_arns}
        mock_ecs_client.describe_clusters.return_value = {
            "clusters": [
                {
                    "clusterArn": arn,
                    "clusterName": arn.split("/")[-1],
                    "status": "ACTIVE",
                    "registeredContainerInstancesCount": 0,
                    "runningTasksCount": 0,
                    "pendingTasksCount": 0,
                    "activeServicesCount": 0,
                }
                for arn in cluster_arns
            ]
        }

        response = client.get("/api/ecs/clusters")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "clusters" in data
        assert len(data["clusters"]) == 2

    def test_cluster_has_required_fields(self, mock_ecs_client):
        """Test that clusters have all required fields."""
        mock_ecs_client.list_clusters.return_value = {
            "clusterArns": ["arn:aws:ecs:us-east-1:123456789012:cluster/test-cluster"]
        }
        mock_ecs_client.describe_clusters.return_value = {
            "clusters": [
                {
                    "clusterArn": "arn:aws:ecs:us-east-1:123456789012:cluster/test-cluster",
                    "clusterName": "test-cluster",
                    "status": "ACTIVE",
                    "registeredContainerInstancesCount": 0,
                    "runningTasksCount": 0,
                    "pendingTasksCount": 0,
                    "activeServicesCount": 0,
                }
            ]
        }

        response = client.get("/api/ecs/clusters")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data["clusters"]) > 0
        cluster = data["clusters"][0]

        required_fields = [
            "clusterArn",
            "clusterName",
            "status",
            "registeredContainerInstancesCount",
            "runningTasksCount",
            "pendingTasksCount",
            "activeServicesCount",
        ]
        for field in required_fields:
            assert field in cluster, f"Missing field: {field}"


class TestGetClusterDetail:
    """Tests for GET /api/ecs/clusters/{cluster_name}."""

    def test_get_cluster_detail_not_found(self, mock_ecs_client):
        """Test getting non-existent cluster."""
        mock_ecs_client.describe_clusters.return_value = {"clusters": [], "failures": [{"reason": "MISSING"}]}

        response = client.get("/api/ecs/clusters/non-existent-cluster")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_cluster_detail(self, mock_ecs_client):
        """Test getting cluster detail."""
        cluster_name = "test-cluster"
        mock_ecs_client.describe_clusters.return_value = {
            "clusters": [
                {
                    "clusterArn": f"arn:aws:ecs:us-east-1:123456789012:cluster/{cluster_name}",
                    "clusterName": cluster_name,
                    "status": "ACTIVE",
                    "registeredContainerInstancesCount": 0,
                    "runningTasksCount": 5,
                    "pendingTasksCount": 1,
                    "activeServicesCount": 2,
                }
            ]
        }

        response = client.get(f"/api/ecs/clusters/{cluster_name}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "cluster" in data
        assert data["cluster"]["clusterName"] == cluster_name

    def test_cluster_detail_has_required_fields(self, mock_ecs_client):
        """Test that cluster detail has all required fields."""
        cluster_name = "test-cluster"
        mock_ecs_client.describe_clusters.return_value = {
            "clusters": [
                {
                    "clusterArn": f"arn:aws:ecs:us-east-1:123456789012:cluster/{cluster_name}",
                    "clusterName": cluster_name,
                    "status": "ACTIVE",
                    "registeredContainerInstancesCount": 0,
                    "runningTasksCount": 5,
                    "pendingTasksCount": 1,
                    "activeServicesCount": 2,
                }
            ]
        }

        response = client.get(f"/api/ecs/clusters/{cluster_name}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        cluster = data["cluster"]
        required_fields = [
            "clusterArn",
            "clusterName",
            "status",
            "registeredContainerInstancesCount",
            "runningTasksCount",
            "pendingTasksCount",
            "activeServicesCount",
        ]
        for field in required_fields:
            assert field in cluster, f"Missing field: {field}"


class TestListClusterServices:
    """Tests for GET /api/ecs/clusters/{cluster_name}/services."""

    def test_list_services_empty(self, mock_ecs_client):
        """Test listing services when none exist."""
        mock_ecs_client.list_services.return_value = {"serviceArns": []}

        response = client.get("/api/ecs/clusters/test-cluster/services")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "services" in data
        assert len(data["services"]) == 0

    def test_list_services(self, mock_ecs_client):
        """Test listing services."""
        service_arns = [
            "arn:aws:ecs:us-east-1:123456789012:service/test-cluster/test-service-0",
            "arn:aws:ecs:us-east-1:123456789012:service/test-cluster/test-service-1",
        ]
        mock_ecs_client.list_services.return_value = {"serviceArns": service_arns}
        mock_ecs_client.describe_services.return_value = {
            "services": [
                {
                    "serviceArn": arn,
                    "serviceName": arn.split("/")[-1],
                    "status": "ACTIVE",
                    "launchType": "FARGATE",
                    "taskDefinition": "arn:aws:ecs:us-east-1:123456789012:task-definition/web-app:1",
                    "desiredCount": 2,
                    "runningCount": 2,
                    "pendingCount": 0,
                }
                for arn in service_arns
            ]
        }

        response = client.get("/api/ecs/clusters/test-cluster/services")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "services" in data
        assert len(data["services"]) == 2


class TestGetServiceDetail:
    """Tests for GET /api/ecs/clusters/{cluster_name}/services/{service_name}."""

    def test_get_service_not_found(self, mock_ecs_client):
        """Test getting non-existent service."""
        mock_ecs_client.describe_services.return_value = {"services": [], "failures": [{"reason": "MISSING"}]}

        response = client.get("/api/ecs/clusters/test-cluster/services/non-existent-service")
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestListClusterTasks:
    """Tests for GET /api/ecs/clusters/{cluster_name}/tasks."""

    def test_list_tasks_empty(self, mock_ecs_client):
        """Test listing tasks when none exist."""
        mock_ecs_client.list_tasks.return_value = {"taskArns": []}

        response = client.get("/api/ecs/clusters/test-cluster/tasks")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "tasks" in data
        assert len(data["tasks"]) == 0

    def test_list_tasks_with_status_filter(self, mock_ecs_client):
        """Test listing tasks with status filter."""
        mock_ecs_client.list_tasks.return_value = {"taskArns": []}

        # Test RUNNING filter
        response = client.get("/api/ecs/clusters/test-cluster/tasks?status=RUNNING")
        assert response.status_code == status.HTTP_200_OK

        # Test STOPPED filter
        response = client.get("/api/ecs/clusters/test-cluster/tasks?status=STOPPED")
        assert response.status_code == status.HTTP_200_OK

        # Test ALL filter
        response = client.get("/api/ecs/clusters/test-cluster/tasks?status=ALL")
        assert response.status_code == status.HTTP_200_OK


class TestGetTaskDetail:
    """Tests for GET /api/ecs/clusters/{cluster_name}/tasks/{task_id}."""

    def test_get_task_not_found(self, mock_ecs_client):
        """Test getting non-existent task."""
        mock_ecs_client.describe_tasks.return_value = {"tasks": [], "failures": [{"reason": "MISSING"}]}

        response = client.get("/api/ecs/clusters/test-cluster/tasks/non-existent-task")
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestListTaskDefinitionFamilies:
    """Tests for GET /api/ecs/task-definitions."""

    def test_list_families_empty(self, mock_ecs_client):
        """Test listing families when none exist."""
        mock_paginator = mock_ecs_client.get_paginator.return_value
        mock_paginator.paginate.return_value = []

        response = client.get("/api/ecs/task-definitions")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "families" in data
        assert len(data["families"]) == 0

    def test_list_families(self, mock_ecs_client):
        """Test listing task definition families."""
        families = ["web-app", "api-service", "worker"]
        mock_paginator = mock_ecs_client.get_paginator.return_value
        mock_paginator.paginate.return_value = [{"families": families}]

        response = client.get("/api/ecs/task-definitions")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "families" in data

        for family in families:
            assert family in data["families"]


class TestListTaskDefinitionRevisions:
    """Tests for GET /api/ecs/task-definitions/{family}."""

    def test_list_revisions_not_found(self, mock_ecs_client):
        """Test listing revisions for non-existent family."""
        mock_ecs_client.list_task_definitions.return_value = {"taskDefinitionArns": []}

        response = client.get("/api/ecs/task-definitions/non-existent-family")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "revisions" in data
        assert len(data["revisions"]) == 0
        assert data["family"] == "non-existent-family"

    def test_list_revisions(self, mock_ecs_client):
        """Test listing task definition revisions."""
        family = "web-app"
        arns = [
            f"arn:aws:ecs:us-east-1:123456789012:task-definition/{family}:1",
            f"arn:aws:ecs:us-east-1:123456789012:task-definition/{family}:2",
        ]
        mock_paginator = mock_ecs_client.get_paginator.return_value
        mock_paginator.paginate.return_value = [{"taskDefinitionArns": arns}]

        response = client.get(f"/api/ecs/task-definitions/{family}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "revisions" in data
        assert "family" in data
        assert data["family"] == family
        assert len(data["revisions"]) == 2


class TestGetTaskDefinitionDetail:
    """Tests for GET /api/ecs/task-definitions/{family}/{revision}."""

    def test_get_task_definition_not_found(self, mock_ecs_client):
        """Test getting non-existent task definition."""
        mock_ecs_client.describe_task_definition.return_value = None

        response = client.get("/api/ecs/task-definitions/non-existent-family/1")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_task_definition_detail(self, mock_ecs_client):
        """Test getting task definition detail."""
        family = "web-app"
        revision = "1"
        mock_ecs_client.describe_task_definition.return_value = {
            "taskDefinition": {
                "taskDefinitionArn": f"arn:aws:ecs:us-east-1:123456789012:task-definition/{family}:{revision}",
                "family": family,
                "revision": int(revision),
                "status": "ACTIVE",
                "networkMode": "awsvpc",
                "containerDefinitions": [
                    {
                        "name": "web",
                        "image": "nginx:latest",
                        "cpu": 256,
                        "memory": 512,
                        "essential": True,
                    }
                ],
            }
        }

        response = client.get(f"/api/ecs/task-definitions/{family}/{revision}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "taskDefinition" in data

        task_def = data["taskDefinition"]
        assert task_def["family"] == family
        assert str(task_def["revision"]) == revision

    def test_task_definition_has_container_definitions(self, mock_ecs_client):
        """Test that task definition has container definitions with required fields."""
        family = "web-app"
        revision = "1"
        mock_ecs_client.describe_task_definition.return_value = {
            "taskDefinition": {
                "taskDefinitionArn": f"arn:aws:ecs:us-east-1:123456789012:task-definition/{family}:{revision}",
                "family": family,
                "revision": int(revision),
                "status": "ACTIVE",
                "networkMode": "awsvpc",
                "containerDefinitions": [
                    {
                        "name": "web",
                        "image": "nginx:latest",
                        "cpu": 256,
                        "memory": 512,
                        "essential": True,
                    }
                ],
            }
        }

        response = client.get(f"/api/ecs/task-definitions/{family}/{revision}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        task_def = data["taskDefinition"]
        assert "containerDefinitions" in task_def
        assert len(task_def["containerDefinitions"]) > 0

        container = task_def["containerDefinitions"][0]
        required_fields = ["name", "image", "cpu", "memory", "essential"]
        for field in required_fields:
            assert field in container, f"Missing field: {field}"

    def test_task_definition_log_configuration(self, mock_ecs_client):
        """Test that task definition includes log configuration with log group."""
        family = "web-app"
        revision = "1"
        mock_ecs_client.describe_task_definition.return_value = {
            "taskDefinition": {
                "taskDefinitionArn": f"arn:aws:ecs:us-east-1:123456789012:task-definition/{family}:{revision}",
                "family": family,
                "revision": int(revision),
                "status": "ACTIVE",
                "networkMode": "awsvpc",
                "containerDefinitions": [
                    {
                        "name": "web",
                        "image": "nginx:latest",
                        "cpu": 256,
                        "memory": 512,
                        "essential": True,
                        "logConfiguration": {
                            "logDriver": "awslogs",
                            "options": {
                                "awslogs-group": "/ecs/web-app",
                                "awslogs-region": "us-east-1",
                                "awslogs-stream-prefix": "ecs",
                            }
                        },
                    }
                ],
            }
        }

        response = client.get(f"/api/ecs/task-definitions/{family}/{revision}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        task_def = data["taskDefinition"]
        container = task_def["containerDefinitions"][0]

        # Check log configuration fields
        assert "logConfiguration" in container
        assert "logGroup" in container
        assert "logDriver" in container