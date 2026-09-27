import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddAlerts1787150000000 implements MigrationInterface {
  name = 'AddAlerts1787150000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "alert" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "kind" text NOT NULL,
        "deviceId" uuid,
        "openedAt" timestamptz NOT NULL,
        "resolvedAt" timestamptz,
        "notifiedAt" timestamptz,
        "resolutionNotifiedAt" timestamptz,
        "details" jsonb,
        CONSTRAINT "CHK_alert_kind" CHECK ("kind" IN ('device-low-battery', 'device-offline')),
        CONSTRAINT "FK_alert_device" FOREIGN KEY ("deviceId") REFERENCES "device"("id") ON DELETE CASCADE
      )
    `)

    // At most one active (unresolved) Alert per Rule per Device.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_alert_kind_device_active" ON "alert" ("kind", "deviceId") WHERE "resolvedAt" IS NULL
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "alert"`)
  }
}
