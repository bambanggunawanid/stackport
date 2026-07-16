import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Breadcrumb, createHomeSegment } from '@/components/Breadcrumb'
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
  fetchResourceTags,
} from '@/lib/api'
import { useEndpoint } from '@/hooks/useEndpoint'
import type {
  ECSCluster,
  ECSClusterDetail,
  ECSService,
  ECSServiceDetail,
  ECSTask,
  ECSTaskDetail,
  ECSTaskDefinitionDetail,
} from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/EmptyState'
import { ExportDropdown } from '@/components/ExportDropdown'
import { JsonViewer } from '@/components/JsonViewer'
import { getServiceIcon } from '@/lib/service-icons'
import { useFetch } from '@/hooks/useFetch'
import { Input } from '@/components/ui/input'
import {
  Container,
  Server,
  Boxes,
  ClipboardList,
  RefreshCw,
  Search,
  Clock,
  Cpu,
  MemoryStick,
  FileText,
  Settings,
  List,
  Tags,
} from 'lucide-react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return `${diffSecs}s ago`
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

function getStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toUpperCase()) {
    case "ACTIVE":
    case "RUNNING":
      return "default"
    case "INACTIVE":
    case "STOPPED":
      return "destructive"
    case "PENDING":
    case "PROVISIONING":
    case "STAGING":
      return "secondary"
    default:
      return "outline"
  }
}

function EntityCard({
  icon: Icon,
  title,
  value,
}: {
  icon: typeof Container
  title: string
  value: string | number
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// Tags Tab Component
function TagsTab({
  service,
  resourceType,
  resourceId,
  endpoint,
}: {
  service: string
  resourceType: string
  resourceId: string
  endpoint: string | null
}) {
  const fetcher = useCallback(
    () => fetchResourceTags(service, resourceType, resourceId, endpoint),
    [service, resourceType, resourceId, endpoint]
  )
  const { data, loading } = useFetch<{ tags: Record<string, string> }>(fetcher, 10000)
  const tags = data?.tags

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (!tags || Object.keys(tags).length === 0) {
    return (
      <EmptyState
        icon={Tags}
        title="No Tags"
        description="No tags configured for this resource"
      />
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-2">
          {Object.entries(tags).map(([key, value]) => (
            <div key={key} className="flex justify-between items-center border-b pb-2 last:border-0">
              <span className="font-mono text-sm font-medium">{key}</span>
              <span className="text-sm text-muted-foreground">{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Cluster Detail Sheet
function ClusterDetailSheet({
  clusterName,
  open,
  onOpenChange,
}: {
  clusterName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { activeEndpoint } = useEndpoint()
  const fetcher = useCallback(
    () => fetchECSClusterDetail(clusterName, activeEndpoint),
    [clusterName, activeEndpoint]
  )
  const { data, loading } = useFetch<{
    cluster: ECSClusterDetail["cluster"]
  }>(fetcher, 10000)
  const cluster = data?.cluster

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Container className="h-5 w-5" />
            {cluster?.clusterName || clusterName}
          </SheetTitle>
          <SheetDescription className="sr-only">
            View details for ECS cluster {cluster?.clusterName || clusterName}
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="space-y-4 mt-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {!loading && cluster && (
          <div className="mt-4 flex flex-col gap-4">
            <Tabs defaultValue="details" className="w-full">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="tags">Tags</TabsTrigger>
                <TabsTrigger value="raw">Raw</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Cluster ARN
                        </span>
                        <span className="font-mono text-xs text-right">
                          {cluster.clusterArn}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant={getStatusVariant(cluster.status)}>
                          {cluster.status}
                        </Badge>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Running Tasks
                          </p>
                          <p className="text-lg font-semibold">
                            {cluster.runningTasksCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Pending Tasks
                          </p>
                          <p className="text-lg font-semibold">
                            {cluster.pendingTasksCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Active Services
                          </p>
                          <p className="text-lg font-semibold">
                            {cluster.activeServicesCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Container Instances
                          </p>
                          <p className="text-lg font-semibold">
                            {cluster.registeredContainerInstancesCount}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {cluster.statistics &&
                  Object.keys(cluster.statistics).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          Statistics
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {Object.entries(cluster.statistics).map(
                            ([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="text-muted-foreground">
                                  {key}
                                </span>
                                <span className="font-mono">{value}</span>
                              </div>
                            )
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
              </TabsContent>
              <TabsContent value="settings" className="space-y-4">
                {cluster.settings &&
                Object.keys(cluster.settings).length > 0 ? (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-2 text-sm">
                        {Object.entries(cluster.settings).map(
                          ([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-muted-foreground">
                                {key}
                              </span>
                              <span className="font-mono">{value}</span>
                            </div>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <EmptyState
                    icon={Settings}
                    title="No Settings"
                    description="No cluster settings configured"
                  />
                )}
              </TabsContent>
              <TabsContent value="tags" className="space-y-4">
                <TagsTab
                  service="ecs"
                  resourceType="clusters"
                  resourceId={clusterName}
                  endpoint={activeEndpoint}
                />
              </TabsContent>
              <TabsContent value="raw" className="space-y-4">
                <JsonViewer data={cluster} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// Service Detail Sheet
function ServiceDetailSheet({
  clusterName,
  serviceName,
  open,
  onOpenChange,
}: {
  clusterName: string
  serviceName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { activeEndpoint } = useEndpoint()
  const fetcher = useCallback(
    () =>
      fetchECSClusterServiceDetail(clusterName, serviceName, activeEndpoint),
    [clusterName, serviceName, activeEndpoint]
  )
  const { data, loading } = useFetch<{ service: ECSServiceDetail["service"] }>(
    fetcher,
    10000
  )
  const service = data?.service

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5" />
            {service?.serviceName || serviceName}
          </SheetTitle>
          <SheetDescription className="sr-only">
            View details for ECS service {service?.serviceName || serviceName}
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="space-y-4 mt-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {!loading && service && (
          <div className="mt-4 flex flex-col gap-4">
            <Tabs defaultValue="details" className="w-full">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="deployments">Deployments</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
                <TabsTrigger value="tags">Tags</TabsTrigger>
                <TabsTrigger value="raw">Raw</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Service ARN
                        </span>
                        <span className="font-mono text-xs text-right">
                          {service.serviceArn}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant={getStatusVariant(service.status)}>
                          {service.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Launch Type
                        </span>
                        <span className="text-xs">{service.launchType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Task Definition
                        </span>
                        <span className="font-mono text-xs">
                          {service.taskDefinition?.split("/")[1] || "—"}
                        </span>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Desired
                          </p>
                          <p className="text-lg font-semibold">
                            {service.desiredCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Running
                          </p>
                          <p className="text-lg font-semibold">
                            {service.runningCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Pending
                          </p>
                          <p className="text-lg font-semibold">
                            {service.pendingCount}
                          </p>
                        </div>
                      </div>
                      {service.loadBalancers &&
                        service.loadBalancers.length > 0 && (
                          <>
                            <Separator />
                            <div>
                              <p className="text-xs text-muted-foreground mb-2">
                                Load Balancers
                              </p>
                              {service.loadBalancers.map((lb, i) => (
                                <div
                                  key={i}
                                  className="text-xs font-mono bg-muted p-2 rounded"
                                >
                                  {JSON.stringify(lb)}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="deployments" className="space-y-4">
                {service.deployments && service.deployments.length > 0 ? (
                  <div className="space-y-2">
                    {service.deployments.map(
                      (dep: Record<string, unknown>, i: number) => (
                        <Card key={i}>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <Badge
                                variant={
                                  dep.status === "PRIMARY"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {dep.status as string}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {dep.runningCount as number} /{" "}
                                {dep.desiredCount as number} running
                              </span>
                            </div>
                            <div className="mt-2 text-xs font-mono">
                              ID: {dep.id as string}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    )}
                  </div>
                ) : (
                  <EmptyState
                    icon={ClipboardList}
                    title="No Deployments"
                    description="No deployments found"
                  />
                )}
              </TabsContent>
              <TabsContent value="events" className="space-y-4">
                {service.events && service.events.length > 0 ? (
                  <div className="space-y-2">
                    {service.events
                      .slice(0, 20)
                      .map((event: Record<string, unknown>, i: number) => (
                        <div
                          key={i}
                          className="text-xs border-b pb-2 last:border-0"
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {formatRelativeTime(event.createdAt as string)}
                            </span>
                          </div>
                          <p className="mt-1">{event.message as string}</p>
                        </div>
                      ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={FileText}
                    title="No Events"
                    description="No service events found"
                  />
                )}
              </TabsContent>
              <TabsContent value="tags" className="space-y-4">
                <TagsTab
                  service="ecs"
                  resourceType="services"
                  resourceId={`${clusterName}/${serviceName}`}
                  endpoint={activeEndpoint}
                />
              </TabsContent>
              <TabsContent value="raw" className="space-y-4">
                <JsonViewer data={service} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// Task Detail Sheet
function TaskDetailSheet({
  clusterName,
  taskId,
  open,
  onOpenChange,
}: {
  clusterName: string
  taskId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { activeEndpoint } = useEndpoint()
  const fetcher = useCallback(
    () => fetchECSClusterTaskDetail(clusterName, taskId, activeEndpoint),
    [clusterName, taskId, activeEndpoint]
  )
  const { data, loading } = useFetch<{ task: ECSTaskDetail["task"] }>(
    fetcher,
    10000
  )
  const task = data?.task

  const getLogGroupLink = (logGroup?: string) => {
    if (!logGroup) return null
    return `/resources/logs?group=${encodeURIComponent(logGroup)}`
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Container className="h-5 w-5" />
            Task {taskId.slice(0, 8)}
          </SheetTitle>
          <SheetDescription className="sr-only">
            View details for ECS task {taskId}
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="space-y-4 mt-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {!loading && task && (
          <div className="mt-4 flex flex-col gap-4">
            <Tabs defaultValue="containers" className="w-full">
              <TabsList>
                <TabsTrigger value="containers">Containers</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="tags">Tags</TabsTrigger>
                <TabsTrigger value="raw">Raw</TabsTrigger>
              </TabsList>
              <TabsContent value="containers" className="space-y-4">
                {task.containers.map((container, i) => {
                  const logGroup =
                    (container.logConfiguration?.options as Record<string, string>)?.["awslogs-group"]
                  return (
                    <Card key={i}>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center justify-between">
                          <span>{container.name}</span>
                          <Badge
                            variant={getStatusVariant(container.healthStatus)}
                          >
                            {container.healthStatus}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Image</span>
                          <span className="font-mono text-xs">
                            {container.image}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Status
                          </span>
                          <Badge
                            variant={getStatusVariant(container.lastStatus)}
                          >
                            {container.lastStatus}
                          </Badge>
                        </div>
                        {container.cpu && (
                          <div className="flex items-center gap-1 text-xs">
                            <Cpu className="h-3 w-3" />
                            <span>{container.cpu} vCPU</span>
                          </div>
                        )}
                        {container.memory && (
                          <div className="flex items-center gap-1 text-xs">
                            <MemoryStick className="h-3 w-3" />
                            <span>{container.memory} MB</span>
                          </div>
                        )}
                        {container.networkBindings &&
                          container.networkBindings.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                Network Bindings
                              </p>
                              {container.networkBindings.map(
                                (
                                  binding: Record<string, unknown>,
                                  j: number
                                ) => {
                                  const hostPort = binding.hostPort as number
                                  const containerPort = binding.containerPort as number
                                  const protocol = binding.protocol as string
                                  return (
                                    <div
                                      key={j}
                                      className="text-xs font-mono bg-muted p-1 rounded"
                                    >
                                      {hostPort}:{containerPort}{" "}
                                      ({protocol})
                                    </div>
                                  )
                                }
                              )}
                            </div>
                          )}
                        {logGroup && (
                          <div className="flex items-center gap-2">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                            <Link
                              to={getLogGroupLink(logGroup) || "#"}
                              className="text-xs text-primary hover:underline"
                            >
                              View Logs →
                            </Link>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </TabsContent>
              <TabsContent value="details" className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Task ARN
                        </span>
                        <span className="font-mono text-xs">
                          {task.taskArn}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant={getStatusVariant(task.lastStatus)}>
                          {task.lastStatus}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Task Definition
                        </span>
                        <span className="font-mono text-xs">
                          {task.taskDefinitionArn?.split("/")[1] || "—"}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Started:
                        </span>
                        <span className="text-xs">
                          {formatDate(task.startedAt)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({formatRelativeTime(task.startedAt)})
                        </span>
                      </div>
                      {task.stoppedAt && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Stopped:
                          </span>
                          <span className="text-xs">
                            {formatDate(task.stoppedAt)}
                          </span>
                        </div>
                      )}
                      {task.stoppedReason && (
                        <div className="bg-destructive/10 p-2 rounded text-xs">
                          <strong>Stop Reason:</strong> {task.stoppedReason}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="raw" className="space-y-4">
                <JsonViewer data={task} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// Task Definition Detail Sheet
function TaskDefinitionDetailSheet({
  family,
  revision,
  open,
  onOpenChange,
}: {
  family: string
  revision: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { activeEndpoint } = useEndpoint()
  const fetcher = useCallback(
    () => fetchECSTaskDefinitionDetail(family, revision, activeEndpoint),
    [family, revision, activeEndpoint]
  )
  const { data, loading } = useFetch<{
    taskDefinition: ECSTaskDefinitionDetail["taskDefinition"]
  }>(fetcher, 10000)
  const taskDef = data?.taskDefinition

  const getLogGroupLink = (logGroup?: string) => {
    if (!logGroup) return null
    return `/resources/logs?group=${encodeURIComponent(logGroup)}`
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            {family}:{revision}
          </SheetTitle>
          <SheetDescription className="sr-only">
            View details for ECS task definition {family}:{revision}
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="space-y-4 mt-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {!loading && taskDef && (
          <div className="mt-4 flex flex-col gap-4">
            <Tabs defaultValue="containers" className="w-full">
              <TabsList>
                <TabsTrigger value="containers">
                  Container Definitions
                </TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="tags">Tags</TabsTrigger>
                <TabsTrigger value="raw">Raw</TabsTrigger>
              </TabsList>
              <TabsContent value="containers" className="space-y-4">
                {taskDef.containerDefinitions.map((container, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>{container.name}</span>
                        <Badge
                          variant={
                            container.essential ? "default" : "secondary"
                          }
                        >
                          {container.essential
                            ? "Essential"
                            : "Non-essential"}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Image</span>
                        <span className="font-mono text-xs">
                          {container.image}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1 text-xs">
                          <Cpu className="h-3 w-3" />
                          <span>{container.cpu} vCPU</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <MemoryStick className="h-3 w-3" />
                          <span>
                            {container.memory || container.memoryReservation}{" "}
                            MB
                          </span>
                        </div>
                      </div>
                      {container.portMappings &&
                        container.portMappings.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Port Mappings
                            </p>
                            {container.portMappings.map((pm, j) => (
                              <div
                                key={j}
                                className="text-xs font-mono bg-muted p-1 rounded inline-block mr-1"
                              >
                                {pm.hostPort || pm.containerPort}:
                                {pm.containerPort}/{pm.protocol || "tcp"}
                              </div>
                            ))}
                          </div>
                        )}
                      {container.environment &&
                        container.environment.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Environment
                            </p>
                            <div className="space-y-1">
                              {container.environment.map((env, j) => (
                                <div
                                  key={j}
                                  className="text-xs font-mono bg-muted p-1 rounded"
                                >
                                  {env.name}={env.value}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      {container.logGroup && (
                        <div className="flex items-center gap-2 mt-2">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <Link
                            to={getLogGroupLink(container.logGroup) || "#"}
                            className="text-xs text-primary hover:underline"
                          >
                            View CloudWatch Logs →
                          </Link>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
              <TabsContent value="details" className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Task Definition ARN
                        </span>
                        <span className="font-mono text-xs">
                          {taskDef.taskDefinitionArn}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant={getStatusVariant(taskDef.status)}>
                          {taskDef.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Network Mode
                        </span>
                        <span className="text-xs">{taskDef.networkMode}</span>
                      </div>
                      {taskDef.taskRoleArn && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Task Role
                          </span>
                          <span className="font-mono text-xs">
                            {taskDef.taskRoleArn}
                          </span>
                        </div>
                      )}
                      {taskDef.executionRoleArn && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Execution Role
                          </span>
                          <span className="font-mono text-xs">
                            {taskDef.executionRoleArn}
                          </span>
                        </div>
                      )}
                      <Separator />
                      <div className="grid grid-cols-2 gap-4">
                        {taskDef.cpu && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              CPU
                            </p>
                            <p className="text-lg font-semibold">
                              {taskDef.cpu}
                            </p>
                          </div>
                        )}
                        {taskDef.memory && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Memory
                            </p>
                            <p className="text-lg font-semibold">
                              {taskDef.memory}
                            </p>
                          </div>
                        )}
                      </div>
                      {taskDef.requiresCompatibilities &&
                        taskDef.requiresCompatibilities.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              Compatibilities
                            </p>
                            <div className="flex gap-1">
                              {taskDef.requiresCompatibilities.map(
                                (compat, i) => (
                                  <Badge key={i} variant="outline">
                                    {compat}
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="tags" className="space-y-4">
                <TagsTab
                  service="ecs"
                  resourceType="task_definitions"
                  resourceId={`${family}:${revision}`}
                  endpoint={activeEndpoint}
                />
              </TabsContent>
              <TabsContent value="raw" className="space-y-4">
                <JsonViewer data={taskDef} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

export function ECSBrowser() {
  const { activeEndpoint } = useEndpoint()
  const [searchParams, setSearchParams] = useSearchParams()

  // Read selected resources from URL params
  const selectedCluster = searchParams.get("cluster")
  const selectedService = searchParams.get("service")
  const selectedTask = searchParams.get("task")
  const selectedTaskDefFamily = searchParams.get("taskdef-family")
  const selectedTaskDefRevision = searchParams.get("taskdef-revision")

  // Helpers to update URL params
  const setSelectedCluster = (cluster: string | null) => {
    const params = new URLSearchParams()
    if (cluster) params.set("cluster", cluster)
    setSearchParams(params)
  }

  const setSelectedService = (service: string | null) => {
    const params = new URLSearchParams()
    if (selectedCluster) params.set("cluster", selectedCluster)
    if (service) params.set("service", service)
    setSearchParams(params)
    setShowServiceDetail(!!service)
  }

  const setSelectedTask = (task: string | null) => {
    const params = new URLSearchParams()
    if (selectedCluster) params.set("cluster", selectedCluster)
    if (task) params.set("task", task)
    setSearchParams(params)
    setShowTaskDetail(!!task)
  }

  const setSelectedTaskDefinition = (
    family: string | null,
    revision: string | null
  ) => {
    const params = new URLSearchParams()
    if (family) params.set("taskdef-family", family)
    if (revision) params.set("taskdef-revision", revision)
    setSearchParams(params)
    setShowTaskDefDetail(!!revision)
  }

  const [clusterSearch, setClusterSearch] = useState("")
  const [serviceSearch, setServiceSearch] = useState("")
  const [taskSearch, setTaskSearch] = useState("")
  const [taskDefSearch, setTaskDefSearch] = useState("")
  const [taskStatusFilter, setTaskStatusFilter] = useState("RUNNING")
  const [refreshing, setRefreshing] = useState(false)

  // Detail sheets state
  const [showClusterDetail, setShowClusterDetail] = useState(false)
  const [showServiceDetail, setShowServiceDetail] = useState(false)
  const [showTaskDetail, setShowTaskDetail] = useState(false)
  const [showTaskDefDetail, setShowTaskDefDetail] = useState(false)

  // Fetch clusters
  const clustersFetcher = useCallback(
    () => fetchECSClusters(activeEndpoint),
    [activeEndpoint]
  )
  const {
    data: clustersData,
    loading: clustersLoading,
    refresh: refreshClusters,
  } = useFetch<{ clusters: ECSCluster[] }>(clustersFetcher, 10000)

  // Fetch services when cluster is selected
  const [servicesData, setServicesData] = useState<{
    services: ECSService[]
  } | null>(null)
  const [servicesLoading, setServicesLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    const loadServices = async () => {
      if (!selectedCluster) {
        setServicesData(null)
        setServicesLoading(false)
        return
      }
      setServicesLoading(true)
      try {
        const result = await fetchECSClusterServices(selectedCluster, activeEndpoint)
        if (!controller.signal.aborted) {
          setServicesData(result)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          toast.error(`Failed to load services: ${err instanceof Error ? err.message : 'Unknown error'}`)
          setServicesData(null)
        }
      } finally {
        if (!controller.signal.aborted) {
          setServicesLoading(false)
        }
      }
    }

    loadServices()

    return () => controller.abort()
  }, [selectedCluster, activeEndpoint])

  // Fetch tasks when cluster is selected
  const [tasksData, setTasksData] = useState<{ tasks: ECSTask[] } | null>(null)
  const [tasksLoading, setTasksLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    const loadTasks = async () => {
      if (!selectedCluster) {
        setTasksData(null)
        setTasksLoading(false)
        return
      }
      setTasksLoading(true)
      try {
        const result = await fetchECSClusterTasks(selectedCluster, taskStatusFilter, activeEndpoint)
        if (!controller.signal.aborted) {
          setTasksData(result)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          toast.error(`Failed to load tasks: ${err instanceof Error ? err.message : 'Unknown error'}`)
          setTasksData(null)
        }
      } finally {
        if (!controller.signal.aborted) {
          setTasksLoading(false)
        }
      }
    }

    loadTasks()

    return () => controller.abort()
  }, [selectedCluster, taskStatusFilter, activeEndpoint])

  // Fetch task definition families
  const taskDefFamiliesFetcher = useCallback(
    () => fetchECSTaskDefinitionFamilies(activeEndpoint),
    [activeEndpoint]
  )
  const { data: taskDefFamiliesData, loading: taskDefFamiliesLoading } =
    useFetch<{ families: string[] }>(taskDefFamiliesFetcher, 10000)

  // Fetch task definition revisions when family is selected
  const [taskDefRevisionsData, setTaskDefRevisionsData] = useState<{
    revisions: Array<{ revision: string; arn: string; family: string }>
    family: string
  } | null>(null)
  const [taskDefRevisionsLoading, setTaskDefRevisionsLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    const loadTaskDefRevisions = async () => {
      if (!selectedTaskDefFamily) {
        setTaskDefRevisionsData(null)
        setTaskDefRevisionsLoading(false)
        return
      }
      setTaskDefRevisionsLoading(true)
      try {
        const result = await fetchECSTaskDefinitionRevisions(selectedTaskDefFamily, activeEndpoint)
        if (!controller.signal.aborted) {
          setTaskDefRevisionsData(result)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          toast.error(`Failed to load task definition revisions: ${err instanceof Error ? err.message : 'Unknown error'}`)
          setTaskDefRevisionsData(null)
        }
      } finally {
        if (!controller.signal.aborted) {
          setTaskDefRevisionsLoading(false)
        }
      }
    }

    loadTaskDefRevisions()

    return () => controller.abort()
  }, [selectedTaskDefFamily, activeEndpoint])

  // Sync detail sheet open state with URL params - derived state, no need for effects
  // The detail sheets are controlled directly by the URL params now

  const filteredClusters =
    clustersData?.clusters.filter((c) =>
      c.clusterName.toLowerCase().includes(clusterSearch.toLowerCase())
    ) || []

  const filteredServices =
    servicesData?.services.filter((s) =>
      s.serviceName.toLowerCase().includes(serviceSearch.toLowerCase())
    ) || []

  const filteredTasks =
    tasksData?.tasks.filter(
      (t) =>
        t.taskId.toLowerCase().includes(taskSearch.toLowerCase()) ||
        t.taskArn.toLowerCase().includes(taskSearch.toLowerCase())
    ) || []

  const filteredFamilies =
    taskDefFamiliesData?.families.filter((f) =>
      f.toLowerCase().includes(taskDefSearch.toLowerCase())
    ) || []

  const runningCount =
    clustersData?.clusters.reduce((sum, c) => sum + c.runningTasksCount, 0) ||
    0
  const pendingCount =
    clustersData?.clusters.reduce((sum, c) => sum + c.pendingTasksCount, 0) ||
    0
  const totalServices =
    clustersData?.clusters.reduce((sum, c) => sum + c.activeServicesCount, 0) ||
    0

  return (
    <div className="space-y-6 p-6 h-full flex flex-col">
      <Breadcrumb
        segments={[
          createHomeSegment(),
          { label: "ECS", icon: getServiceIcon("ecs") },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Container className="h-6 w-6" />
            ECS Browser
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Explore clusters, services, tasks, and task definitions
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={async () => {
            setRefreshing(true)
            await refreshClusters()
            setRefreshing(false)
          }}
          title="Refresh"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <EntityCard
          icon={Container}
          title="Clusters"
          value={clustersData?.clusters.length || 0}
        />
        <EntityCard icon={Boxes} title="Total Services" value={totalServices} />
        <EntityCard icon={Server} title="Running Tasks" value={runningCount} />
        <EntityCard icon={Clock} title="Pending Tasks" value={pendingCount} />
      </div>

      <Tabs defaultValue="clusters" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-fit">
          <TabsTrigger value="clusters">
            Clusters
            {clustersData && (
              <Badge variant="secondary" className="ml-2">
                {clustersData.clusters.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="task-definitions">
            Task Definitions
            {taskDefFamiliesData && (
              <Badge variant="secondary" className="ml-2">
                {taskDefFamiliesData.families.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clusters" className="flex-1 min-h-0">
          <div className="grid grid-cols-[300px,1fr] gap-4 h-full">
            {/* Clusters Panel */}
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Container className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">Clusters</CardTitle>
                    <Badge variant="secondary">{filteredClusters.length}</Badge>
                  </div>
                  {filteredClusters.length > 0 && (
                    <ExportDropdown
                      service="ecs"
                      resourceType="clusters"
                      data={filteredClusters as unknown as Record<string, unknown>[]}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search clusters..."
                    value={clusterSearch}
                    onChange={(e) => setClusterSearch(e.target.value)}
                    className="h-8 text-sm pl-8"
                  />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {clustersLoading && (
                    <>
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </>
                  )}
                  {!clustersLoading && filteredClusters.length === 0 && (
                    <EmptyState
                      icon={Container}
                      title="No clusters"
                      description="No ECS clusters found"
                    />
                  )}
                  {!clustersLoading &&
                    filteredClusters.map((cluster) => (
                      <Card
                        key={cluster.clusterArn}
                        className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedCluster === cluster.clusterName
                            ? "border-primary bg-muted"
                            : ""
                        }`}
                        onClick={() => setSelectedCluster(cluster.clusterName)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div
                              className="text-sm font-medium truncate"
                              title={cluster.clusterName}
                            >
                              {cluster.clusterName}
                            </div>
                            <Badge
                              variant={getStatusVariant(cluster.status)}
                              className="text-xs"
                            >
                              {cluster.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{cluster.activeServicesCount} services</span>
                            <Separator orientation="vertical" className="h-3" />
                            <span>{cluster.runningTasksCount} tasks</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Cluster Detail Panel */}
            <Card className="flex flex-col">
              <CardHeader className="pb-3 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">
                      {selectedCluster ? selectedCluster : "Select a cluster"}
                    </CardTitle>
                  </div>
                  {selectedCluster && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-auto"
                      onClick={() => setShowClusterDetail(true)}
                      title="View cluster details"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
                {!selectedCluster && (
                  <EmptyState
                    icon={Container}
                    title="No cluster selected"
                    description="Select a cluster to view details"
                  />
                )}
                {selectedCluster && (
                  <Tabs
                    defaultValue="services"
                    className="flex-1 flex flex-col min-h-0"
                  >
                    <TabsList>
                      <TabsTrigger value="services">Services</TabsTrigger>
                      <TabsTrigger value="tasks">Tasks</TabsTrigger>
                    </TabsList>

                    {/* SERVICES TAB */}
                    <TabsContent value="services" className="flex-1 min-h-0">
                      <div className="h-full flex flex-col justify-start pt-2">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <Input
                            placeholder="Search services..."
                            value={serviceSearch}
                            onChange={(e) => setServiceSearch(e.target.value)}
                            className="h-8 text-sm"
                          />
                          {filteredServices.length > 0 && (
                            <ExportDropdown
                              service="ecs"
                              resourceType="services"
                              data={filteredServices as unknown as Record<string, unknown>[]}
                            />
                          )}
                        </div>
                        <div className="flex-1 overflow-y-auto">
                          {servicesLoading && (
                            <div className="space-y-2">
                              <Skeleton className="h-12 w-full" />
                              <Skeleton className="h-12 w-full" />
                              <Skeleton className="h-12 w-full" />
                            </div>
                          )}
                          {!servicesLoading &&
                            filteredServices.length === 0 && (
                              <EmptyState
                                icon={Boxes}
                                title="No services"
                                description="No services found in this cluster"
                              />
                            )}
                          {!servicesLoading && filteredServices.length > 0 && (
                            <Table>
                              <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                  <TableHead>Name</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Desired</TableHead>
                                  <TableHead>Running</TableHead>
                                  <TableHead>Pending</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredServices.map((service) => (
                                  <TableRow
                                    key={service.serviceArn}
                                    className="cursor-pointer hover:bg-accent"
                                    onClick={() =>
                                      setSelectedService(service.serviceName)
                                    }
                                  >
                                    <TableCell
                                      className="font-medium truncate max-w-[200px]"
                                      title={service.serviceName}
                                    >
                                      {service.serviceName}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={getStatusVariant(
                                          service.status
                                        )}
                                      >
                                        {service.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {service.desiredCount}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {service.runningCount}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {service.pendingCount}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </div>
                    </TabsContent>

                    {/* TASKS TAB */}
                    <TabsContent value="tasks" className="flex-1 min-h-0">
                      <div className="h-full flex flex-col pt-2">
                        <div className="bg-background pb-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <select
                                value={taskStatusFilter}
                                onChange={(e) =>
                                  setTaskStatusFilter(e.target.value)
                                }
                                className="h-8 text-sm border rounded-md bg-background text-foreground pl-3 pr-8 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
                              >
                                <option value="RUNNING">Running</option>
                                <option value="STOPPED">Stopped</option>
                                <option value="ALL">All</option>
                              </select>
                              <Input
                                placeholder="Search tasks..."
                                value={taskSearch}
                                onChange={(e) => setTaskSearch(e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            {filteredTasks.length > 0 && (
                              <ExportDropdown
                                service="ecs"
                                resourceType="tasks"
                                data={filteredTasks as unknown as Record<string, unknown>[]}
                              />
                            )}
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                          {tasksLoading && (
                            <div className="space-y-2">
                              <Skeleton className="h-12 w-full" />
                              <Skeleton className="h-12 w-full" />
                              <Skeleton className="h-12 w-full" />
                            </div>
                          )}
                          {!tasksLoading && filteredTasks.length === 0 && (
                            <EmptyState
                              icon={Server}
                              title="No tasks"
                              description="No tasks found with this filter"
                            />
                          )}
                          {!tasksLoading && filteredTasks.length > 0 && (
                            <Table>
                              <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                  <TableHead>Task ID</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Containers</TableHead>
                                  <TableHead>Started</TableHead>
                                  {taskStatusFilter !== "RUNNING" && (
                                    <TableHead>Stop Reason</TableHead>
                                  )}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredTasks.map((task) => (
                                  <TableRow
                                    key={task.taskArn}
                                    className="cursor-pointer hover:bg-accent"
                                    onClick={() => setSelectedTask(task.taskId)}
                                  >
                                    <TableCell
                                      className="font-mono text-xs truncate max-w-[150px]"
                                      title={task.taskArn}
                                    >
                                      {task.taskId}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={getStatusVariant(
                                          task.lastStatus
                                        )}
                                      >
                                        {task.lastStatus}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {task.containers.length}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {formatRelativeTime(task.startedAt)}
                                    </TableCell>
                                    {taskStatusFilter !== "RUNNING" && (
                                      <TableCell
                                        className="text-xs truncate max-w-[150px]"
                                        title={task.stoppedReason}
                                      >
                                        {task.stoppedReason || "—"}
                                      </TableCell>
                                    )}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="task-definitions" className="flex-1 min-h-0">
          <div className="grid grid-cols-[300px,1fr] gap-4 h-full">
            {/* Task Definition Families Panel */}
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">Families</CardTitle>
                  <Badge variant="secondary">{filteredFamilies.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search families..."
                    value={taskDefSearch}
                    onChange={(e) => setTaskDefSearch(e.target.value)}
                    className="h-8 text-sm pl-8"
                  />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {taskDefFamiliesLoading && (
                    <>
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </>
                  )}
                  {!taskDefFamiliesLoading && filteredFamilies.length === 0 && (
                    <EmptyState
                      icon={ClipboardList}
                      title="No families"
                      description="No task definition families found"
                    />
                  )}
                  {!taskDefFamiliesLoading &&
                    filteredFamilies.map((family) => (
                      <Card
                        key={family}
                        className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedTaskDefFamily === family
                            ? "border-primary bg-muted"
                            : ""
                        }`}
                        onClick={() => setSelectedTaskDefinition(family, null)}
                      >
                        <CardContent className="p-3">
                          <div
                            className="text-sm font-medium truncate"
                            title={family}
                          >
                            {family}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Task Definition Revisions Panel */}
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <List className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">
                    {selectedTaskDefFamily
                      ? `${selectedTaskDefFamily} Revisions`
                      : "Select a family"}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
                {!selectedTaskDefFamily && (
                  <EmptyState
                    icon={ClipboardList}
                    title="No family selected"
                    description="Select a family to view revisions"
                  />
                )}
                {selectedTaskDefFamily && (
                  <>
                    {taskDefRevisionsLoading && (
                      <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    )}
                    {!taskDefRevisionsLoading &&
                      (!taskDefRevisionsData ||
                        taskDefRevisionsData.revisions.length === 0) && (
                        <EmptyState
                          icon={ClipboardList}
                          title="No revisions"
                          description="No revisions found for this family"
                        />
                      )}
                    {!taskDefRevisionsLoading &&
                      taskDefRevisionsData &&
                      taskDefRevisionsData.revisions.length > 0 && (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Revision</TableHead>
                              <TableHead>ARN</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {taskDefRevisionsData.revisions.map((rev) => (
                              <TableRow
                                key={rev.revision}
                                className={`cursor-pointer hover:bg-accent ${
                                  selectedTaskDefRevision === rev.revision
                                    ? "bg-muted"
                                    : ""
                                }`}
                                onClick={() => {
                                  setSelectedTaskDefinition(
                                    rev.family,
                                    rev.revision
                                  )
                                }}
                              >
                                <TableCell className="font-mono">
                                  {rev.revision}
                                </TableCell>
                                <TableCell
                                  className="font-mono text-xs truncate"
                                  title={rev.arn}
                                >
                                  {rev.arn}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail Sheets */}
      {selectedCluster && (
        <ClusterDetailSheet
          clusterName={selectedCluster}
          open={showClusterDetail}
          onOpenChange={(open) => {
            setShowClusterDetail(open)
            // Don't clear cluster selection when closing the detail sheet
            // This keeps the services and tasks visible in the right panel
          }}
        />
      )}

      {selectedService && selectedCluster && (
        <ServiceDetailSheet
          clusterName={selectedCluster}
          serviceName={selectedService}
          open={showServiceDetail}
          onOpenChange={(open) => {
            setShowServiceDetail(open)
            if (!open) setSelectedService(null)
          }}
        />
      )}

      {selectedTask && selectedCluster && (
        <TaskDetailSheet
          clusterName={selectedCluster}
          taskId={selectedTask}
          open={showTaskDetail}
          onOpenChange={(open) => {
            setShowTaskDetail(open)
            if (!open) setSelectedTask(null)
          }}
        />
      )}

      {selectedTaskDefFamily && selectedTaskDefRevision && (
        <TaskDefinitionDetailSheet
          family={selectedTaskDefFamily}
          revision={selectedTaskDefRevision}
          open={showTaskDefDetail}
          onOpenChange={(open) => {
            setShowTaskDefDetail(open)
            if (!open) setSelectedTaskDefinition(null, null)
          }}
        />
      )}
    </div>
  )
}