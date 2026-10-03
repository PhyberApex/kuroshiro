import type { NavItem } from './navItem'

export interface ProblemLine {
  /** An Alert line is one a firing Alert stands behind. It is the only line drawn in the seal colour. */
  kind: 'alert' | 'problem'
  /** The line as the admin reads it. It is also what tells two lines apart. */
  text: string
  /** Where the problem is fixed. */
  link?: NavItem
}
