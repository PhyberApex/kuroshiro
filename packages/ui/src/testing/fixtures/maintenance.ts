import type { RetentionStatus, StorageCheck } from 'kuroshiro-shared'
import { defineBuilder } from './defineBuilder'

const KITCHEN_FOLDER = 'devices/7c9e6679-7425-40de-944b-e07fc1f90ae7'

/** A check of an Instance that has leftovers of every group: four groups of files and one Screen, Holiday photo, whose image is gone. */
export const buildStorageCheck = defineBuilder<StorageCheck>(() => ({
  checkedAt: '2026-10-03T07:35:00.000Z',
  screenImages: { files: 224, bytes: 23_488_102 },
  findings: [
    { id: `unusedImage:${KITCHEN_FOLDER}/8e41.png`, group: 'unusedImage', path: `${KITCHEN_FOLDER}/8e41.png`, bytes: 65_536 },
    { id: `unusedImage:${KITCHEN_FOLDER}/8e41.original`, group: 'unusedImage', path: `${KITCHEN_FOLDER}/8e41.original`, bytes: 192_512 },
    { id: 'deletedDeviceFolder:devices/0d44a1f0-3c5e-4b7a-8d21-6f0e9a4c9b17', group: 'deletedDeviceFolder', path: 'devices/0d44a1f0-3c5e-4b7a-8d21-6f0e9a4c9b17', bytes: 1_363_149, files: 14 },
    { id: `tempFile:${KITCHEN_FOLDER}/tmp-source`, group: 'tempFile', path: `${KITCHEN_FOLDER}/tmp-source`, bytes: 40_960 },
    { id: 'oldUpload:uploads/5b1f0a', group: 'oldUpload', path: 'uploads/5b1f0a', bytes: 1_468_006 },
    { id: 'oldUpload:uploads/aa93e2', group: 'oldUpload', path: 'uploads/aa93e2', bytes: 838_861 },
    {
      id: 'missingImage:3d2c1b0a-9f8e-4d7c-b6a5-0f1e2d3c4b5a',
      group: 'missingImage',
      screen: { id: '3d2c1b0a-9f8e-4d7c-b6a5-0f1e2d3c4b5a', name: 'Holiday photo', kind: 'file', deviceId: '7c9e6679-7425-40de-944b-e07fc1f90ae7', deviceName: 'Kitchen', order: 4 },
    },
  ],
}))

export const buildRetentionStatus = defineBuilder<RetentionStatus>(() => ({
  ages: { alertRetentionDays: 90, deviceLogRetentionDays: 30 },
  lastRun: { ranAt: '2026-10-03T02:00:00.000Z', alertsPruned: 3, deviceLogsPruned: 1284 },
}))
