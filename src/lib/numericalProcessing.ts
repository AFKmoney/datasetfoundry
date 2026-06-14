import { DatasetConfig } from '../types';

function parseCSV(content: string): string[][] {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  return lines.map(l => l.split(','));
}

function stringifyCSV(rows: string[][]): string {
  return rows.map(r => r.join(',')).join('\n');
}

export function preprocessNumericalData(content: string, extension: string, config: DatasetConfig): string {
  if (config.numNormalization === 'none') {
    return content;
  }

  // Very basic CSV parsing to identify numeric columns
  if (extension.toLowerCase() === 'csv') {
    try {
      const rows = parseCSV(content);
      if (rows.length < 2) return content; // Need at least header and one row

      // Detect numeric columns (assuming row 0 is header, check row 1)
      const numCols = new Set<number>();
      for (let j = 0; j < rows[1].length; j++) {
        if (!isNaN(Number(rows[1][j]))) {
          numCols.add(j);
        }
      }

      if (numCols.size === 0) return content;

      // Calculate stats
      const stats: Record<number, { min: number, max: number, mean: number, std: number }> = {};
      
      numCols.forEach(col => {
        const vals = [];
        for (let i = 1; i < rows.length; i++) {
          if (rows[i][col] !== undefined && rows[i][col].trim() !== '') {
            vals.push(Number(rows[i][col]));
          }
        }
        
        let min = Math.min(...vals);
        let max = Math.max(...vals);
        let sum = vals.reduce((a, b) => a + b, 0);
        let mean = sum / vals.length;
        let sqSum = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
        let std = Math.sqrt(sqSum / (vals.length || 1));
        
        if (std === 0) std = 1; // avoid division by zero
        if (max === min) max = min + 1; 

        stats[col] = { min, max, mean, std };
      });

      // Apply transformation
      for (let i = 1; i < rows.length; i++) {
        numCols.forEach(col => {
          const val = Number(rows[i][col]);
          if (!isNaN(val)) {
            if (config.numNormalization === 'minmax') {
              rows[i][col] = ((val - stats[col].min) / (stats[col].max - stats[col].min)).toString();
            } else if (config.numNormalization === 'zscore') {
              rows[i][col] = ((val - stats[col].mean) / stats[col].std).toString();
            }
          }
        });
      }

      return stringifyCSV(rows);
    } catch(e) {
      console.warn("Could not normalize CSV", e);
      return content; // return original if parsing fails
    }
  }

  return content;
}
