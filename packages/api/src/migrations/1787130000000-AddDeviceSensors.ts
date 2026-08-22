import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddDeviceSensors1787130000000 implements MigrationInterface {
  name = 'AddDeviceSensors1787130000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "device_sensor" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "kind" text NOT NULL,
        "value" double precision NOT NULL,
        "unit" text NOT NULL,
        "deviceId" uuid NOT NULL,
        CONSTRAINT "CHK_device_sensor_kind" CHECK ("kind" IN ('carbon_dioxide', 'humidity', 'pressure', 'temperature')),
        CONSTRAINT "UQ_device_sensor_device_kind" UNIQUE ("deviceId", "kind"),
        CONSTRAINT "FK_device_sensor_device"
          FOREIGN KEY ("deviceId") REFERENCES "device"("id") ON DELETE CASCADE
      )
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "device_sensor"`)
  }
}
