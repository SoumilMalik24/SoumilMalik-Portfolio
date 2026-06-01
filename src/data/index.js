/**
 * Central data module.
 * Edit the CSV files in src/data/ — this file auto-parses them at build time.
 *
 * CSV files use:
 *   - Standard comma separators
 *   - Double-quoted fields for values containing commas
 *   - Pipe | for multi-value fields (e.g. tags)
 */
import { parseCSV } from '../utils/parseCSV';

import projectsRaw   from './projects.csv?raw';
import educationRaw  from './education.csv?raw';
import experienceRaw from './experience.csv?raw';
import stackRaw      from './stack.csv?raw';

export const projects   = parseCSV(projectsRaw);
export const education  = parseCSV(educationRaw);
export const experience = parseCSV(experienceRaw);
export const stack      = parseCSV(stackRaw);

