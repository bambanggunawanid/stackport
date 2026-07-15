import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ECSBrowser } from '@/components/service-views/ECSBrowser'
import { TooltipProvider } from '@/components/ui/tooltip'

const sampleCluster = {
  clusterArn: 'arn:aws:ecs:us-east-1:123456789012:cluster/my-cluster',
  clusterName: 'my-cluster',
  status: 'ACTIVE',
  activeServicesCount: 2,
  runningTasksCount: 5,
  pendingTasksCount: 1,
  registeredContainerInstancesCount: 3,
}

const sampleService = {
  serviceArn: 'arn:aws:ecs:us-east-1:123456789012:service/my-cluster/my-service',
  serviceName: 'my-service',
  status: 'ACTIVE',
  launchType: 'FARGATE',
  taskDefinition: 'arn:aws:ecs:us-east-1:123456789012:task-definition/web-app:1',
  desiredCount: 3,
  runningCount: 3,
  pendingCount: 0,
}

const sampleTask = {
  taskArn: 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/task-123',
  taskId: 'task-123',
  taskDefinitionArn: 'arn:aws:ecs:us-east-1:123456789012:task-definition/web-app:1',
  lastStatus: 'RUNNING',
  group: 'service:my-service',
  containers: [
    {
      containerArn: 'arn:aws:ecs:us-east-1:123456789012:container/task-123/container-1',
      name: 'web',
      image: 'nginx:latest',
      lastStatus: 'RUNNING',
      healthStatus: 'HEALTHY',
      cpu: '0.25',
      memory: '512',
      logConfiguration: {
        logDriver: 'awslogs',
        options: {
          'awslogs-group': '/ecs/my-cluster',
          'awslogs-region': 'us-east-1',
          'awslogs-stream-prefix': 'ecs',
        },
      },
    },
  ],
  attachments: [],
  startedAt: '2024-01-15T10:30:00Z',
}

const sampleTaskDef = {
  taskDefinitionArn: 'arn:aws:ecs:us-east-1:123456789012:task-definition/web-app:1',
  family: 'web-app',
  revision: '1',
  status: 'ACTIVE',
  networkMode: 'awsvpc',
  containerDefinitions: [
    {
      name: 'web',
      image: 'nginx:latest',
      cpu: 256,
      memory: 512,
      memoryReservation: 256,
      essential: true,
      portMappings: [
        { containerPort: 80, hostPort: 80, protocol: 'tcp' },
      ],
      environment: [
        { name: 'NODE_ENV', value: 'production' },
        { name: 'PORT', value: '80' },
      ],
      logConfiguration: {
        logDriver: 'awslogs',
        options: {
          'awslogs-group': '/ecs/web-app',
          'awslogs-region': 'us-east-1',
        },
      },
    },
  ],
  cpu: '256',
  memory: '512',
  requiresCompatibilities: ['FARGATE'],
}

const {
  fetchECSClustersMock,
  fetchECSClusterDetailMock,
  fetchECSClusterServicesMock,
  fetchECSClusterServiceDetailMock,
  fetchECSClusterTasksMock,
  fetchECSClusterTaskDetailMock,
  fetchECSTaskDefinitionFamiliesMock,
  fetchECSTaskDefinitionRevisionsMock,
  fetchECSTaskDefinitionDetailMock,
} = vi.hoisted(() => ({
  fetchECSClustersMock: vi.fn<() => Promise<{ clusters: typeof sampleCluster[] }>>(),
  fetchECSClusterDetailMock: vi.fn(),
  fetchECSClusterServicesMock: vi.fn<() => Promise<{ services: typeof sampleService[] }>>(),
  fetchECSClusterServiceDetailMock: vi.fn(),
  fetchECSClusterTasksMock: vi.fn<() => Promise<{ tasks: typeof sampleTask[] }>>(),
  fetchECSClusterTaskDetailMock: vi.fn(),
  fetchECSTaskDefinitionFamiliesMock: vi.fn<() => Promise<{ families: string[] }>>(),
  fetchECSTaskDefinitionRevisionsMock: vi.fn<() => Promise<{ revisions: { revision: string; arn: string; family: string }[]; family: string }>>(),
  fetchECSTaskDefinitionDetailMock: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

vi.mock('@/lib/api', () => ({
  fetchECSClusters: fetchECSClustersMock,
  fetchECSClusterDetail: fetchECSClusterDetailMock,
  fetchECSClusterServices: fetchECSClusterServicesMock,
  fetchECSClusterServiceDetail: fetchECSClusterServiceDetailMock,
  fetchECSClusterTasks: fetchECSClusterTasksMock,
  fetchECSClusterTaskDetail: fetchECSClusterTaskDetailMock,
  fetchECSTaskDefinitionFamilies: fetchECSTaskDefinitionFamiliesMock,
  fetchECSTaskDefinitionRevisions: fetchECSTaskDefinitionRevisionsMock,
  fetchECSTaskDefinitionDetail: fetchECSTaskDefinitionDetailMock,
  fetchResourceTags: vi.fn(() => Promise.resolve({ tags: {} })),
}))

function renderECSBrowser(search = '') {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[`/resources/ecs${search}`]}>
        <Routes>
          <Route path="/resources/ecs" element={<ECSBrowser />} />
        </Routes>
      </MemoryRouter>
    </TooltipProvider>,
  )
}

beforeEach(() => {
  fetchECSClustersMock.mockReset()
  fetchECSClusterDetailMock.mockReset()
  fetchECSClusterServicesMock.mockReset()
  fetchECSClusterTasksMock.mockReset()
  fetchECSClusterTaskDetailMock.mockReset()
  fetchECSTaskDefinitionFamiliesMock.mockReset()
  fetchECSTaskDefinitionRevisionsMock.mockReset()
  fetchECSTaskDefinitionDetailMock.mockReset()
})

describe('ECSBrowser - API Integration', () => {
  it('fetches clusters on mount', async () => {
    fetchECSClustersMock.mockResolvedValue({ clusters: [sampleCluster] })
    renderECSBrowser()

    await waitFor(() => {
      expect(fetchECSClustersMock).toHaveBeenCalled()
    })
  })

  it('fetches services when cluster is selected', async () => {
    fetchECSClustersMock.mockResolvedValue({ clusters: [sampleCluster] })
    fetchECSClusterServicesMock.mockResolvedValue({ services: [sampleService] })

    renderECSBrowser('?cluster=my-cluster')

    await waitFor(() => {
      expect(fetchECSClusterServicesMock).toHaveBeenCalledWith('my-cluster', null)
    })
  })

  it('fetches tasks when cluster is selected', async () => {
    fetchECSClustersMock.mockResolvedValue({ clusters: [sampleCluster] })
    fetchECSClusterTasksMock.mockResolvedValue({ tasks: [sampleTask] })

    renderECSBrowser('?cluster=my-cluster')

    await waitFor(() => {
      expect(fetchECSClusterTasksMock).toHaveBeenCalledWith('my-cluster', 'RUNNING', null)
    })
  })

  it('fetches task definition families on mount', async () => {
    fetchECSTaskDefinitionFamiliesMock.mockResolvedValue({ families: ['web-app'] })
    renderECSBrowser()

    await waitFor(() => {
      expect(fetchECSTaskDefinitionFamiliesMock).toHaveBeenCalled()
    })
  })
})

describe('ECSBrowser - Log Link Generation', () => {
  it('generates log group link for containers with awslogs driver', async () => {
    fetchECSClustersMock.mockResolvedValue({ clusters: [sampleCluster] })
    fetchECSClusterTasksMock.mockResolvedValue({ tasks: [sampleTask] })
    fetchECSClusterTaskDetailMock.mockResolvedValue({
      task: {
        ...sampleTask,
        containers: [
          {
            ...sampleTask.containers[0],
            logConfiguration: {
              logDriver: 'awslogs',
              options: {
                'awslogs-group': '/ecs/my-cluster/web',
                'awslogs-region': 'us-east-1',
              },
            },
          },
        ],
      },
    })

    renderECSBrowser('?cluster=my-cluster&task=task-123')

    await waitFor(() => {
      const link = screen.getByText('View Logs →')
      expect(link).toHaveAttribute('href', '/resources/logs?group=%2Fecs%2Fmy-cluster%2Fweb')
    })
  })
})

describe('ECSBrowser - Task Definition Details', () => {
  it('displays task definition container image', async () => {
    fetchECSTaskDefinitionFamiliesMock.mockResolvedValue({ families: ['web-app'] })
    fetchECSTaskDefinitionRevisionsMock.mockResolvedValue({
      revisions: [{ revision: '1', arn: sampleTaskDef.taskDefinitionArn, family: 'web-app' }],
      family: 'web-app',
    })
    fetchECSTaskDefinitionDetailMock.mockResolvedValue({
      taskDefinition: sampleTaskDef,
    })

    renderECSBrowser('?taskdef-family=web-app&taskdef-revision=1')

    await waitFor(() => {
      expect(screen.getByText('nginx:latest')).toBeInTheDocument()
    })
  })

  it('shows environment variables in container definition', async () => {
    fetchECSTaskDefinitionDetailMock.mockResolvedValue({
      taskDefinition: {
        ...sampleTaskDef,
        containerDefinitions: [
          {
            ...sampleTaskDef.containerDefinitions[0],
            environment: [
              { name: 'NODE_ENV', value: 'production' },
            ],
          },
        ],
      },
    })

    renderECSBrowser('?taskdef-family=web-app&taskdef-revision=1')

    await waitFor(() => {
      expect(screen.getByText('NODE_ENV=production')).toBeInTheDocument()
    })
  })

  it('shows container CPU and memory', async () => {
    fetchECSTaskDefinitionDetailMock.mockResolvedValue({
      taskDefinition: {
        ...sampleTaskDef,
        containerDefinitions: [
          {
            ...sampleTaskDef.containerDefinitions[0],
            cpu: 256,
            memory: 512,
          },
        ],
      },
    })

    renderECSBrowser('?taskdef-family=web-app&taskdef-revision=1')

    await waitFor(() => {
      expect(screen.getByText('256 vCPU')).toBeInTheDocument()
    })
  })
})