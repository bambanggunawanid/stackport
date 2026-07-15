import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  fetchECSClusters,
  fetchECSClusterDetail,
  fetchECSClusterServices,
  fetchECSClusterServiceDetail,
  fetchECSClusterTasks,
  fetchECSClusterTaskDetail,
  fetchECSTaskDefinitionFamilies,
  fetchECSTaskDefinitionRevisions,
  fetchECSTaskDefinitionDetail,
} from '@/lib/api'

const mockFetch = vi.fn()
globalThis.fetch = mockFetch as unknown as typeof fetch

beforeEach(() => {
  mockFetch.mockReset()
})

function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  })
}

function mockError(status: number) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Error',
  })
}

describe('fetchECSClusters', () => {
  it('calls the correct URL', async () => {
    mockOk({ clusters: [] })
    const result = await fetchECSClusters()
    expect(mockFetch).toHaveBeenCalledWith('/api/ecs/clusters')
    expect(result.clusters).toEqual([])
  })

  it('throws on non-ok response', async () => {
    mockError(500)
    await expect(fetchECSClusters()).rejects.toThrow('500')
  })

  it('accepts custom endpoint', async () => {
    mockOk({ clusters: [] })
    await fetchECSClusters('my-endpoint')
    expect(mockFetch).toHaveBeenCalledWith('/api/ecs/clusters?endpoint=my-endpoint')
  })
})

describe('fetchECSClusterDetail', () => {
  it('calls correct URL with encoded cluster name', async () => {
    mockOk({ cluster: { clusterName: 'my-cluster' } })
    await fetchECSClusterDetail('my-cluster')
    expect(mockFetch).toHaveBeenCalledWith('/api/ecs/clusters/my-cluster')
  })

  it('encodes special characters in cluster name', async () => {
    mockOk({ cluster: {} })
    await fetchECSClusterDetail('my cluster/test')
    expect(mockFetch).toHaveBeenCalledWith('/api/ecs/clusters/my%20cluster%2Ftest')
  })

  it('throws on non-ok response', async () => {
    mockError(404)
    await expect(fetchECSClusterDetail('nonexistent')).rejects.toThrow('404')
  })
})

describe('fetchECSClusterServices', () => {
  it('calls correct URL with cluster name', async () => {
    mockOk({ services: [] })
    const result = await fetchECSClusterServices('my-cluster')
    expect(mockFetch).toHaveBeenCalledWith('/api/ecs/clusters/my-cluster/services')
    expect(result.services).toEqual([])
  })

  it('encodes special characters in cluster name', async () => {
    mockOk({ services: [] })
    await fetchECSClusterServices('cluster/test')
    expect(mockFetch).toHaveBeenCalledWith('/api/ecs/clusters/cluster%2Ftest/services')
  })

  it('throws on non-ok response', async () => {
    mockError(404)
    await expect(fetchECSClusterServices('nonexistent')).rejects.toThrow('404')
  })
})

describe('fetchECSClusterServiceDetail', () => {
  it('calls correct URL with cluster and service names', async () => {
    mockOk({ service: { serviceName: 'my-service' } })
    await fetchECSClusterServiceDetail('my-cluster', 'my-service')
    expect(mockFetch).toHaveBeenCalledWith('/api/ecs/clusters/my-cluster/services/my-service')
  })

  it('encodes special characters in both names', async () => {
    mockOk({ service: {} })
    await fetchECSClusterServiceDetail('cluster/test', 'svc/api')
    expect(mockFetch).toHaveBeenCalledWith('/api/ecs/clusters/cluster%2Ftest/services/svc%2Fapi')
  })

  it('throws on non-ok response', async () => {
    mockError(404)
    await expect(fetchECSClusterServiceDetail('cluster', 'service')).rejects.toThrow('404')
  })
})

describe('fetchECSClusterTasks', () => {
  it('calls correct URL with default RUNNING status', async () => {
    mockOk({ tasks: [] })
    const result = await fetchECSClusterTasks('my-cluster')
    expect(mockFetch).toHaveBeenCalledWith('/api/ecs/clusters/my-cluster/tasks?status=RUNNING')
    expect(result.tasks).toEqual([])
  })

  it('accepts custom status filter', async () => {
    mockOk({ tasks: [] })
    await fetchECSClusterTasks('my-cluster', 'STOPPED')
    expect(mockFetch).toHaveBeenCalledWith('/api/ecs/clusters/my-cluster/tasks?status=STOPPED')
  })

  it('accepts ALL status filter', async () => {
    mockOk({ tasks: [] })
    await fetchECSClusterTasks('my-cluster', 'ALL')
    expect(mockFetch).toHaveBeenCalledWith('/api/ecs/clusters/my-cluster/tasks?status=ALL')
  })

  it('encodes special characters in cluster name', async () => {
    mockOk({ tasks: [] })
    await fetchECSClusterTasks('cluster/test')
    expect(mockFetch).toHaveBeenCalledWith('/api/ecs/clusters/cluster%2Ftest/tasks?status=RUNNING')
  })

  it('throws on non-ok response', async () => {
    mockError(404)
    await expect(fetchECSClusterTasks('nonexistent')).rejects.toThrow('404')
  })
})

describe('fetchECSClusterTaskDetail', () => {
  it('calls correct URL with cluster and task IDs', async () => {
    mockOk({ task: { taskId: 'task-123' } })
    await fetchECSClusterTaskDetail('my-cluster', 'task-123')
    expect(mockFetch).toHaveBeenCalledWith('/api/ecs/clusters/my-cluster/tasks/task-123')
  })

  it('encodes special characters in task ID', async () => {
    mockOk({ task: {} })
    await fetchECSClusterTaskDetail('cluster', 'task/abc')
    expect(mockFetch).toHaveBeenCalledWith('/api/ecs/clusters/cluster/tasks/task%2Fabc')
  })

  it('throws on non-ok response', async () => {
    mockError(404)
    await expect(fetchECSClusterTaskDetail('cluster', 'nonexistent')).rejects.toThrow('404')
  })
})

describe('fetchECSTaskDefinitionFamilies', () => {
  it('calls the correct URL', async () => {
    mockOk({ families: [] })
    const result = await fetchECSTaskDefinitionFamilies()
    expect(mockFetch).toHaveBeenCalledWith('/api/ecs/task-definitions')
    expect(result.families).toEqual([])
  })

  it('throws on non-ok response', async () => {
    mockError(500)
    await expect(fetchECSTaskDefinitionFamilies()).rejects.toThrow('500')
  })
})

describe('fetchECSTaskDefinitionRevisions', () => {
  it('calls correct URL with family name', async () => {
    mockOk({ revisions: [], family: 'my-family' })
    const result = await fetchECSTaskDefinitionRevisions('my-family')
    expect(mockFetch).toHaveBeenCalledWith('/api/ecs/task-definitions/my-family')
    expect(result.family).toBe('my-family')
  })

  it('encodes special characters in family name', async () => {
    mockOk({ revisions: [] })
    await fetchECSTaskDefinitionRevisions('family/test')
    expect(mockFetch).toHaveBeenCalledWith('/api/ecs/task-definitions/family%2Ftest')
  })

  it('throws on non-ok response', async () => {
    mockError(404)
    await expect(fetchECSTaskDefinitionRevisions('nonexistent')).rejects.toThrow('404')
  })
})

describe('fetchECSTaskDefinitionDetail', () => {
  it('calls correct URL with family and revision', async () => {
    mockOk({ taskDefinition: { family: 'my-family', revision: '1' } })
    await fetchECSTaskDefinitionDetail('my-family', '1')
    expect(mockFetch).toHaveBeenCalledWith('/api/ecs/task-definitions/my-family/1')
  })

  it('encodes special characters in family and revision', async () => {
    mockOk({ taskDefinition: {} })
    await fetchECSTaskDefinitionDetail('family/test', 'rev/1')
    expect(mockFetch).toHaveBeenCalledWith('/api/ecs/task-definitions/family%2Ftest/rev%2F1')
  })

  it('throws on non-ok response', async () => {
    mockError(404)
    await expect(fetchECSTaskDefinitionDetail('family', '1')).rejects.toThrow('404')
  })
})