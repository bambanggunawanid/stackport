import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { S3Browser } from '@/components/service-views/S3Browser'

const { uploadS3ObjectMock } = vi.hoisted(() => ({
  uploadS3ObjectMock: vi.fn(() =>
    Promise.resolve({
      bucket: 'my-bucket',
      key: 'test.txt',
      size: 1,
      content_type: 'text/plain',
    }),
  ),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}))

vi.mock('@/lib/api', () => ({
  fetchS3Buckets: vi.fn(() =>
    Promise.resolve({
      buckets: [
        {
          name: 'my-bucket',
          created: '2020-01-01T00:00:00',
          region: 'us-east-1',
          object_count: 0,
          total_size: 0,
          versioning: 'Disabled',
          encryption: 'Disabled',
          tags: {},
        },
      ],
    }),
  ),
  fetchS3Objects: vi.fn(() =>
    Promise.resolve({
      bucket: 'my-bucket',
      prefix: '',
      delimiter: '/',
      folders: [],
      files: [],
    }),
  ),
  fetchS3Object: vi.fn(),
  getS3DownloadUrl: vi.fn(() => '/api/s3/buckets/my-bucket/objects/x'),
  uploadS3Object: uploadS3ObjectMock,
  deleteS3Object: vi.fn(),
  deleteS3ObjectsBatch: vi.fn(),
  createS3Folder: vi.fn(),
  fetchS3UploadConfig: vi.fn(() => Promise.resolve({ max_upload_bytes: 104857600 })),
}))

function renderWithBucket(search = '?bucket=my-bucket') {
  return render(
    <MemoryRouter initialEntries={[`/resources/s3${search}`]}>
      <Routes>
        <Route path="/resources/s3" element={<S3Browser />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('S3Browser drag-and-drop', () => {
  it('calls uploadS3Object when a file is dropped on the object list zone', async () => {
    uploadS3ObjectMock.mockClear()

    renderWithBucket()

    await waitFor(() => {
      expect(screen.getByTestId('s3-object-drop-zone')).toBeInTheDocument()
    })

    const zone = screen.getByTestId('s3-object-drop-zone')
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' })
    const dt = {
      files: [file],
      types: ['Files'],
      items: { length: 1 },
    } as unknown as DataTransfer

    fireEvent.dragEnter(zone, {
      dataTransfer: dt,
    })

    fireEvent.drop(zone, {
      dataTransfer: dt,
    })

    await waitFor(() => {
      expect(uploadS3ObjectMock).toHaveBeenCalledTimes(1)
    })

    expect(uploadS3ObjectMock).toHaveBeenCalledWith(
      'my-bucket',
      expect.objectContaining({ name: 'test.txt' }),
      '',
      expect.any(Object),
    )
  })
})
