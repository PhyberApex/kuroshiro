import type { DeepPartial, EntityManager } from 'typeorm'
import { Screen } from './screens.entity.js'

type NewScreen = Omit<DeepPartial<Screen>, 'device' | 'order' | 'isActive'>

async function screensInOrder(manager: EntityManager, deviceId: string): Promise<Screen[]> {
  return manager.getRepository(Screen).find({ where: { device: { id: deviceId } }, order: { order: 'ASC' } })
}

/**
 * How every new Screen enters a Device, whatever its kind: last in the Order
 * and not the Active Screen, so adding never changes what the Device shows.
 *
 * Locks the Device's row for the rest of the (possibly just-opened)
 * transaction first, so two concurrent adds to the same Device read the
 * maximum Order one after the other instead of both reading it before
 * either writes, which would give both Screens the same Order.
 */
export async function joinEndOfOrder(manager: EntityManager, deviceId: string, screen: NewScreen): Promise<Screen> {
  return manager.transaction(async (manager) => {
    await manager.query('SELECT 1 FROM "device" WHERE "id" = $1 FOR UPDATE', [deviceId])
    const screens = manager.getRepository(Screen)
    const lastOrder = await screens.maximum('order', { device: { id: deviceId } }) ?? 0
    return screens.save(screens.create({
      fetchManual: false,
      generatedAt: new Date(),
      ...screen,
      device: { id: deviceId },
      order: lastOrder + 1,
      isActive: false,
    }))
  })
}

/** Numbers the given Screens 1..N in the sequence they come in, writing only the ones that moved. */
export async function writeOrder(manager: EntityManager, screens: Screen[]): Promise<void> {
  const moved = screens.flatMap((screen, index) => screen.order === index + 1 ? [] : [{ id: screen.id, order: index + 1 }])
  await Promise.all(moved.map(({ id, order }) => manager.getRepository(Screen).update({ id }, { order })))
}

/** Closes the gap a removed Screen left in a Device's Order. */
export async function closeGapInOrder(manager: EntityManager, deviceId: string): Promise<void> {
  await writeOrder(manager, await screensInOrder(manager, deviceId))
}
