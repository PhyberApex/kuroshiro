import type { Relation } from 'typeorm'
import type { Screen } from '../screens/screens.entity'
import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity()
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'boolean', default: true })
  enabled: boolean

  @Column({ type: 'int', array: true, nullable: true })
  weekdays?: number[] | null

  @Column({ type: 'time', nullable: true })
  startTime?: string | null

  @Column({ type: 'time', nullable: true })
  endTime?: string | null

  @Column({ type: 'date', nullable: true })
  startDate?: string | null

  @Column({ type: 'date', nullable: true })
  endDate?: string | null

  @OneToOne('Screen', (screen: Screen) => screen.schedule, { onDelete: 'CASCADE' })
  @JoinColumn()
  screen: Relation<Screen>

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
